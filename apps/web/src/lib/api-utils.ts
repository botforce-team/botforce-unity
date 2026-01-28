/**
 * API Route Utilities
 * Provides consistent error handling and response formatting for API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logError, AppError, AuthError } from '@/lib/errors'

// ============================================================================
// Types
// ============================================================================

interface ApiContext {
  userId: string
  companyId: string
  request: NextRequest
}

type ApiHandler<T = unknown> = (context: ApiContext) => Promise<T>
type PublicApiHandler<T = unknown> = (request: NextRequest) => Promise<T>

interface ApiErrorResponse {
  error: string
  code?: string
  details?: unknown
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a successful JSON response
 */
export function successResponse<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}

/**
 * Create an error JSON response
 */
export function errorResponse(
  message: string,
  status = 500,
  code?: string,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { error: message }
  if (code) body.code = code
  if (details && process.env.NODE_ENV === 'development') {
    body.details = details
  }

  return NextResponse.json(body, { status })
}

/**
 * Create a not found response
 */
export function notFoundResponse(resource = 'Resource'): NextResponse<ApiErrorResponse> {
  return errorResponse(`${resource} not found`, 404, 'NOT_FOUND')
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message = 'Authentication required'): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 401, 'UNAUTHORIZED')
}

/**
 * Create a forbidden response
 */
export function forbiddenResponse(message = 'Access denied'): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 403, 'FORBIDDEN')
}

/**
 * Create a bad request response
 */
export function badRequestResponse(message: string): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 400, 'BAD_REQUEST')
}

/**
 * Create a rate limit response
 */
export function rateLimitResponse(retryAfter = 60): NextResponse<ApiErrorResponse> {
  const response = errorResponse('Too many requests', 429, 'RATE_LIMITED')
  response.headers.set('Retry-After', String(retryAfter))
  return response
}

// ============================================================================
// Route Wrappers
// ============================================================================

/**
 * Wrap an API route handler with authentication and error handling
 */
export function withAuth<T>(handler: ApiHandler<T>) {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }): Promise<NextResponse> => {
    try {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return unauthorizedResponse()
      }

      // Get company membership using admin client to bypass RLS
      const adminClient = await createAdminClient()
      const { data: membership, error: membershipError } = await adminClient
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (membershipError || !membership) {
        return unauthorizedResponse('No active company membership')
      }

      const apiContext: ApiContext = {
        userId: user.id,
        companyId: membership.company_id,
        request,
      }

      const result = await handler(apiContext)
      return successResponse(result)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Wrap an API route handler with error handling (no auth required)
 */
export function withErrorHandling<T>(handler: PublicApiHandler<T>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const result = await handler(request)
      return successResponse(result)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Convert an error to an appropriate API response
 */
function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  logError(error, { source: 'api-route' })

  if (error instanceof AppError) {
    return errorResponse(
      error.isOperational ? error.message : 'An unexpected error occurred',
      error.statusCode,
      error.code
    )
  }

  if (error instanceof AuthError) {
    return unauthorizedResponse(error.message)
  }

  // Supabase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const supaError = error as { code: string; message?: string }
    if (supaError.code === 'PGRST116') {
      return notFoundResponse()
    }
    if (supaError.code === '42501') {
      return forbiddenResponse('Insufficient permissions')
    }
  }

  // Generic error
  if (error instanceof Error) {
    if (process.env.NODE_ENV === 'development') {
      return errorResponse(error.message, 500, 'INTERNAL_ERROR', {
        stack: error.stack,
      })
    }
  }

  return errorResponse('An unexpected error occurred', 500, 'INTERNAL_ERROR')
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Parse JSON body with error handling
 */
export async function parseBody<T>(request: NextRequest): Promise<T> {
  try {
    return await request.json()
  } catch {
    throw new AppError('Invalid JSON body', { code: 'INVALID_JSON', statusCode: 400 })
  }
}

/**
 * Get a required query parameter
 */
export function getRequiredParam(
  request: NextRequest,
  name: string
): string {
  const value = request.nextUrl.searchParams.get(name)
  if (!value) {
    throw new AppError(`Missing required parameter: ${name}`, {
      code: 'MISSING_PARAM',
      statusCode: 400,
    })
  }
  return value
}

/**
 * Get an optional query parameter with default
 */
export function getOptionalParam(
  request: NextRequest,
  name: string,
  defaultValue: string
): string {
  return request.nextUrl.searchParams.get(name) ?? defaultValue
}

/**
 * Get a numeric query parameter
 */
export function getNumericParam(
  request: NextRequest,
  name: string,
  defaultValue: number
): number {
  const value = request.nextUrl.searchParams.get(name)
  if (!value) return defaultValue
  const num = Number(value)
  if (isNaN(num)) {
    throw new AppError(`Parameter ${name} must be a number`, {
      code: 'INVALID_PARAM',
      statusCode: 400,
    })
  }
  return num
}

// ============================================================================
// Rate Limiting (simple in-memory for demo)
// ============================================================================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Simple rate limiting check
 * In production, use Redis or similar
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || record.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count++
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt }
}

/**
 * Clear old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}
