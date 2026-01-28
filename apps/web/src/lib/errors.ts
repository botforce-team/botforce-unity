/**
 * Custom error classes and error handling utilities
 * Provides consistent error handling across the application
 */

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base application error with structured information
 */
export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context?: Record<string, unknown>

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      isOperational?: boolean
      context?: Record<string, unknown>
      cause?: Error
    } = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.code = options.code || 'UNKNOWN_ERROR'
    this.statusCode = options.statusCode || 500
    this.isOperational = options.isOperational ?? true
    this.context = options.context
    this.cause = options.cause

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Authentication-related errors
 */
export class AuthError extends AppError {
  constructor(message = 'Authentication required', context?: Record<string, unknown>) {
    super(message, {
      code: 'AUTH_ERROR',
      statusCode: 401,
      isOperational: true,
      context,
    })
    this.name = 'AuthError'
  }
}

/**
 * Authorization/permission errors
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', context?: Record<string, unknown>) {
    super(message, {
      code: 'FORBIDDEN',
      statusCode: 403,
      isOperational: true,
      context,
    })
    this.name = 'ForbiddenError'
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id?: string) {
    super(id ? `${resource} with ID "${id}" not found` : `${resource} not found`, {
      code: 'NOT_FOUND',
      statusCode: 404,
      isOperational: true,
      context: { resource, id },
    })
    this.name = 'NotFoundError'
  }
}

/**
 * Validation errors with field-level details
 */
export class ValidationError extends AppError {
  public readonly fieldErrors: Record<string, string[]>

  constructor(message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      isOperational: true,
      context: { fieldErrors },
    })
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }
}

/**
 * Business logic errors (e.g., "cannot delete issued invoice")
 */
export class BusinessError extends AppError {
  constructor(message: string, code = 'BUSINESS_ERROR', context?: Record<string, unknown>) {
    super(message, {
      code,
      statusCode: 422,
      isOperational: true,
      context,
    })
    this.name = 'BusinessError'
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number

  constructor(retryAfter?: number) {
    super('Too many requests. Please try again later.', {
      code: 'RATE_LIMIT',
      statusCode: 429,
      isOperational: true,
      context: { retryAfter },
    })
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

/**
 * External service errors (database, API, etc.)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(`External service error: ${service}`, {
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 502,
      isOperational: true,
      context: { service },
      cause: originalError,
    })
    this.name = 'ExternalServiceError'
  }
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Safe error message extraction for client display
 * Never exposes internal error details
 */
export function getClientSafeMessage(error: unknown): string {
  if (error instanceof AppError && error.isOperational) {
    return error.message
  }

  // For non-operational errors, return a generic message
  return 'An unexpected error occurred. Please try again later.'
}

/**
 * Extract error code for client
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof AppError) {
    return error.code
  }
  return 'UNKNOWN_ERROR'
}

/**
 * Log error with context (server-side only)
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString()
  const errorInfo = {
    timestamp,
    ...context,
  }

  if (error instanceof AppError) {
    console.error('[AppError]', {
      ...errorInfo,
      name: error.name,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      context: error.context,
      stack: error.stack,
      cause: error.cause,
    })
  } else if (error instanceof Error) {
    console.error('[Error]', {
      ...errorInfo,
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    })
  } else {
    console.error('[Unknown Error]', {
      ...errorInfo,
      error,
    })
  }
}

/**
 * Wrap async functions to handle errors consistently
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => T | Promise<T>
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    logError(error)
    if (errorHandler) {
      return errorHandler(error)
    }
    throw error
  }
}

/**
 * Create a safe action result from an error
 */
export function errorToResult(error: unknown): { success: false; error: string } {
  logError(error)
  return {
    success: false,
    error: getClientSafeMessage(error),
  }
}

/**
 * Assert a condition or throw an error
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AppError(message, { code: 'ASSERTION_FAILED', statusCode: 500 })
  }
}

/**
 * Assert a value is not null/undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  name = 'Value'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(name)
  }
}
