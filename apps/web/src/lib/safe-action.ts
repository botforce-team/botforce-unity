/**
 * Safe action wrapper for server actions
 * Provides consistent error handling, validation, and authentication
 */

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logError, AppError, AuthError, ValidationError, errorToResult } from '@/lib/errors'
import type { ActionResult } from '@/types'

// ============================================================================
// Types
// ============================================================================

interface ActionContext {
  userId: string
  companyId: string
}

type ActionHandler<TInput, TOutput> = (
  input: TInput,
  context: ActionContext
) => Promise<ActionResult<TOutput>>

type PublicActionHandler<TInput, TOutput> = (
  input: TInput
) => Promise<ActionResult<TOutput>>

// ============================================================================
// Safe Action Creator
// ============================================================================

/**
 * Create a protected server action with authentication and validation
 * @param schema - Zod schema for input validation
 * @param handler - The action handler function
 */
export function createSafeAction<TInput, TOutput = void>(
  schema: z.ZodSchema<TInput>,
  handler: ActionHandler<TInput, TOutput>
): (input: unknown) => Promise<ActionResult<TOutput>> {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    try {
      // 1. Validate input
      const parseResult = schema.safeParse(rawInput)
      if (!parseResult.success) {
        const fieldErrors: Record<string, string[]> = {}
        for (const issue of parseResult.error.issues) {
          const path = issue.path.join('.') || 'input'
          if (!fieldErrors[path]) {
            fieldErrors[path] = []
          }
          fieldErrors[path].push(issue.message)
        }
        throw new ValidationError('Invalid input', fieldErrors)
      }

      const input = parseResult.data

      // 2. Authenticate user
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new AuthError('Please sign in to continue')
      }

      // 3. Get company membership using admin client to bypass RLS
      const adminClient = await createAdminClient()
      const { data: membership, error: membershipError } = await adminClient
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (membershipError || !membership) {
        throw new AuthError('No active company membership found')
      }

      // 4. Create context and execute handler
      const context: ActionContext = {
        userId: user.id,
        companyId: membership.company_id,
      }

      return await handler(input, context)
    } catch (error) {
      return errorToResult(error)
    }
  }
}

/**
 * Create a public server action (no authentication required)
 * @param schema - Zod schema for input validation
 * @param handler - The action handler function
 */
export function createPublicAction<TInput, TOutput = void>(
  schema: z.ZodSchema<TInput>,
  handler: PublicActionHandler<TInput, TOutput>
): (input: unknown) => Promise<ActionResult<TOutput>> {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    try {
      // Validate input
      const parseResult = schema.safeParse(rawInput)
      if (!parseResult.success) {
        const fieldErrors: Record<string, string[]> = {}
        for (const issue of parseResult.error.issues) {
          const path = issue.path.join('.') || 'input'
          if (!fieldErrors[path]) {
            fieldErrors[path] = []
          }
          fieldErrors[path].push(issue.message)
        }
        throw new ValidationError('Invalid input', fieldErrors)
      }

      return await handler(parseResult.data)
    } catch (error) {
      return errorToResult(error)
    }
  }
}

/**
 * Create a protected action that requires specific roles
 */
export function createRoleProtectedAction<TInput, TOutput = void>(
  schema: z.ZodSchema<TInput>,
  allowedRoles: ('superadmin' | 'employee' | 'accountant')[],
  handler: ActionHandler<TInput, TOutput> & { role?: string }
): (input: unknown) => Promise<ActionResult<TOutput>> {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    try {
      // 1. Validate input
      const parseResult = schema.safeParse(rawInput)
      if (!parseResult.success) {
        const fieldErrors: Record<string, string[]> = {}
        for (const issue of parseResult.error.issues) {
          const path = issue.path.join('.') || 'input'
          if (!fieldErrors[path]) {
            fieldErrors[path] = []
          }
          fieldErrors[path].push(issue.message)
        }
        throw new ValidationError('Invalid input', fieldErrors)
      }

      const input = parseResult.data

      // 2. Authenticate user
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new AuthError('Please sign in to continue')
      }

      // 3. Get company membership with role using admin client to bypass RLS
      const adminClient = await createAdminClient()
      const { data: membership, error: membershipError } = await adminClient
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (membershipError || !membership) {
        throw new AuthError('No active company membership found')
      }

      // 4. Check role
      if (!allowedRoles.includes(membership.role)) {
        throw new AppError('You do not have permission to perform this action', {
          code: 'FORBIDDEN',
          statusCode: 403,
        })
      }

      // 5. Create context and execute handler
      const context: ActionContext = {
        userId: user.id,
        companyId: membership.company_id,
      }

      return await handler(input, context)
    } catch (error) {
      return errorToResult(error)
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap an existing action with try-catch error handling
 */
export function withErrorHandling<TArgs extends unknown[], TResult extends ActionResult>(
  action: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await action(...args)
    } catch (error) {
      return errorToResult(error) as TResult
    }
  }
}

/**
 * Assert that an action result is successful
 */
export function assertSuccess<T>(
  result: ActionResult<T>,
  errorMessage = 'Operation failed'
): asserts result is { success: true; data: T } {
  if (!result.success) {
    throw new AppError(result.error || errorMessage)
  }
}

/**
 * Get authenticated user or throw
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthError('Please sign in to continue')
  }

  return user
}

/**
 * Get user's company membership or throw
 */
export async function getUserMembership() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthError('Please sign in to continue')
  }

  // Use admin client to bypass RLS
  const adminClient = await createAdminClient()
  const { data: membership, error: membershipError } = await adminClient
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (membershipError || !membership) {
    throw new AuthError('No active company membership found')
  }

  return { user, membership }
}
