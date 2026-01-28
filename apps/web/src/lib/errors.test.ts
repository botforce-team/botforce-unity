import { describe, it, expect, vi } from 'vitest'
import {
  AppError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessError,
  RateLimitError,
  ExternalServiceError,
  getClientSafeMessage,
  getErrorCode,
  logError,
  tryCatch,
  errorToResult,
  assert,
  assertDefined,
} from './errors'

describe('AppError', () => {
  it('creates error with default values', () => {
    const error = new AppError('Test error')
    expect(error.message).toBe('Test error')
    expect(error.code).toBe('UNKNOWN_ERROR')
    expect(error.statusCode).toBe(500)
    expect(error.isOperational).toBe(true)
  })

  it('creates error with custom options', () => {
    const error = new AppError('Custom error', {
      code: 'CUSTOM_CODE',
      statusCode: 400,
      isOperational: false,
      context: { foo: 'bar' },
    })
    expect(error.code).toBe('CUSTOM_CODE')
    expect(error.statusCode).toBe(400)
    expect(error.isOperational).toBe(false)
    expect(error.context).toEqual({ foo: 'bar' })
  })

  it('captures cause error', () => {
    const cause = new Error('Original')
    const error = new AppError('Wrapped', { cause })
    expect(error.cause).toBe(cause)
  })
})

describe('AuthError', () => {
  it('has correct defaults', () => {
    const error = new AuthError()
    expect(error.message).toBe('Authentication required')
    expect(error.code).toBe('AUTH_ERROR')
    expect(error.statusCode).toBe(401)
    expect(error.name).toBe('AuthError')
  })

  it('accepts custom message', () => {
    const error = new AuthError('Please log in')
    expect(error.message).toBe('Please log in')
  })
})

describe('ForbiddenError', () => {
  it('has correct defaults', () => {
    const error = new ForbiddenError()
    expect(error.message).toBe('Access denied')
    expect(error.code).toBe('FORBIDDEN')
    expect(error.statusCode).toBe(403)
  })
})

describe('NotFoundError', () => {
  it('has correct defaults', () => {
    const error = new NotFoundError()
    expect(error.message).toBe('Resource not found')
    expect(error.code).toBe('NOT_FOUND')
    expect(error.statusCode).toBe(404)
  })

  it('formats message with resource name', () => {
    const error = new NotFoundError('User')
    expect(error.message).toBe('User not found')
  })

  it('formats message with ID', () => {
    const error = new NotFoundError('User', '123')
    expect(error.message).toBe('User with ID "123" not found')
  })
})

describe('ValidationError', () => {
  it('has correct defaults', () => {
    const error = new ValidationError('Invalid input')
    expect(error.message).toBe('Invalid input')
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.statusCode).toBe(400)
    expect(error.fieldErrors).toEqual({})
  })

  it('stores field errors', () => {
    const fieldErrors = { email: ['Invalid email'] }
    const error = new ValidationError('Validation failed', fieldErrors)
    expect(error.fieldErrors).toEqual(fieldErrors)
  })
})

describe('BusinessError', () => {
  it('has correct defaults', () => {
    const error = new BusinessError('Cannot delete issued invoice')
    expect(error.code).toBe('BUSINESS_ERROR')
    expect(error.statusCode).toBe(422)
  })

  it('accepts custom code', () => {
    const error = new BusinessError('Error', 'INVOICE_LOCKED')
    expect(error.code).toBe('INVOICE_LOCKED')
  })
})

describe('RateLimitError', () => {
  it('has correct defaults', () => {
    const error = new RateLimitError()
    expect(error.code).toBe('RATE_LIMIT')
    expect(error.statusCode).toBe(429)
  })

  it('stores retry-after', () => {
    const error = new RateLimitError(60)
    expect(error.retryAfter).toBe(60)
  })
})

describe('ExternalServiceError', () => {
  it('has correct defaults', () => {
    const error = new ExternalServiceError('Database')
    expect(error.message).toBe('External service error: Database')
    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR')
    expect(error.statusCode).toBe(502)
  })

  it('captures original error', () => {
    const original = new Error('Connection refused')
    const error = new ExternalServiceError('Database', original)
    expect(error.cause).toBe(original)
  })
})

describe('getClientSafeMessage', () => {
  it('returns message for operational errors', () => {
    const error = new AppError('User-friendly message')
    expect(getClientSafeMessage(error)).toBe('User-friendly message')
  })

  it('returns generic message for non-operational errors', () => {
    const error = new AppError('Internal details', { isOperational: false })
    expect(getClientSafeMessage(error)).toBe('An unexpected error occurred. Please try again later.')
  })

  it('returns generic message for regular errors', () => {
    const error = new Error('Internal error')
    expect(getClientSafeMessage(error)).toBe('An unexpected error occurred. Please try again later.')
  })

  it('handles unknown error types', () => {
    expect(getClientSafeMessage('string error')).toBe('An unexpected error occurred. Please try again later.')
    expect(getClientSafeMessage(null)).toBe('An unexpected error occurred. Please try again later.')
  })
})

describe('getErrorCode', () => {
  it('returns code for AppError', () => {
    const error = new AppError('Test', { code: 'TEST_CODE' })
    expect(getErrorCode(error)).toBe('TEST_CODE')
  })

  it('returns UNKNOWN_ERROR for other errors', () => {
    expect(getErrorCode(new Error('Test'))).toBe('UNKNOWN_ERROR')
    expect(getErrorCode('string')).toBe('UNKNOWN_ERROR')
  })
})

describe('logError', () => {
  it('logs AppError with details', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new AppError('Test', { code: 'TEST', context: { id: 123 } })

    logError(error, { action: 'test' })

    expect(consoleSpy).toHaveBeenCalled()
    const loggedData = consoleSpy.mock.calls[0]
    expect(loggedData[0]).toBe('[AppError]')

    consoleSpy.mockRestore()
  })

  it('logs regular errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Test')

    logError(error)

    expect(consoleSpy).toHaveBeenCalledWith('[Error]', expect.any(Object))
    consoleSpy.mockRestore()
  })
})

describe('tryCatch', () => {
  it('returns result on success', async () => {
    const result = await tryCatch(async () => 'success')
    expect(result).toBe('success')
  })

  it('calls error handler on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await tryCatch(
      async () => { throw new Error('Failed') },
      () => 'fallback'
    )

    expect(result).toBe('fallback')
    consoleSpy.mockRestore()
  })

  it('rethrows error without handler', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      tryCatch(async () => { throw new Error('Failed') })
    ).rejects.toThrow('Failed')

    consoleSpy.mockRestore()
  })
})

describe('errorToResult', () => {
  it('converts error to result format', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new AppError('Test error')

    const result = errorToResult(error)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Test error')
    consoleSpy.mockRestore()
  })
})

describe('assert', () => {
  it('passes for truthy conditions', () => {
    expect(() => assert(true, 'Should not throw')).not.toThrow()
    expect(() => assert(1, 'Should not throw')).not.toThrow()
    expect(() => assert('string', 'Should not throw')).not.toThrow()
  })

  it('throws for falsy conditions', () => {
    expect(() => assert(false, 'Condition failed')).toThrow('Condition failed')
    expect(() => assert(null, 'Null value')).toThrow('Null value')
    expect(() => assert(0, 'Zero value')).toThrow('Zero value')
  })
})

describe('assertDefined', () => {
  it('passes for defined values', () => {
    expect(() => assertDefined('value')).not.toThrow()
    expect(() => assertDefined(0)).not.toThrow()
    expect(() => assertDefined(false)).not.toThrow()
  })

  it('throws for null', () => {
    expect(() => assertDefined(null, 'User')).toThrow('User not found')
  })

  it('throws for undefined', () => {
    expect(() => assertDefined(undefined, 'Document')).toThrow('Document not found')
  })
})
