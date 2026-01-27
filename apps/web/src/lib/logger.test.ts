import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, captureException } from './logger'

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.NODE_ENV = originalEnv
  })

  describe('info', () => {
    it('logs info messages', () => {
      logger.info('Test info message')
      expect(console.info).toHaveBeenCalled()
    })

    it('includes context in log', () => {
      logger.info('Test message', { userId: '123' })
      expect(console.info).toHaveBeenCalled()
      const logCall = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(logCall).toContain('Test message')
      expect(logCall).toContain('userId')
    })
  })

  describe('warn', () => {
    it('logs warning messages', () => {
      logger.warn('Test warning')
      expect(console.warn).toHaveBeenCalled()
    })

    it('includes context in warning', () => {
      logger.warn('Warning message', { code: 'WARN001' })
      expect(console.warn).toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('logs error messages', () => {
      logger.error('Test error')
      expect(console.error).toHaveBeenCalled()
    })

    it('logs Error objects with stack trace', () => {
      const error = new Error('Test error object')
      logger.error('An error occurred', error)
      expect(console.error).toHaveBeenCalledTimes(2) // Message + stack trace
    })

    it('handles non-Error objects', () => {
      logger.error('An error occurred', { message: 'not an error' })
      expect(console.error).toHaveBeenCalled()
    })

    it('includes context with errors', () => {
      const error = new Error('Test')
      logger.error('Error with context', error, { action: 'test' })
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('apiError', () => {
    it('logs API errors with request context', () => {
      logger.apiError('API request failed', new Error('Network error'), {
        method: 'POST',
        url: '/api/test',
      })
      expect(console.error).toHaveBeenCalled()
    })

    it('handles missing request context', () => {
      logger.apiError('API request failed', new Error('Network error'))
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('dbError', () => {
    it('logs database errors with query context', () => {
      logger.dbError('Query failed', new Error('Connection refused'), {
        table: 'users',
        operation: 'SELECT',
      })
      expect(console.error).toHaveBeenCalled()
    })

    it('handles missing query context', () => {
      logger.dbError('Query failed', new Error('Timeout'))
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('authError', () => {
    it('logs authentication errors', () => {
      logger.authError('Login failed', new Error('Invalid credentials'), 'user123')
      expect(console.error).toHaveBeenCalled()
    })

    it('handles missing user ID', () => {
      logger.authError('Auth error', new Error('Token expired'))
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('captureException', () => {
    it('captures Error objects', () => {
      captureException(new Error('Test exception'))
      expect(console.error).toHaveBeenCalled()
    })

    it('captures non-Error objects', () => {
      captureException('string error')
      expect(console.error).toHaveBeenCalled()
    })

    it('includes context', () => {
      captureException(new Error('Test'), { component: 'TestComponent' })
      expect(console.error).toHaveBeenCalled()
    })
  })
})
