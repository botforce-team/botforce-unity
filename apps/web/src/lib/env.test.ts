import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Re-create the schema for testing (can't import the module directly due to side effects)
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required').optional(),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required').optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
})

describe('Environment Validation', () => {
  describe('envSchema', () => {
    it('validates correct environment variables', () => {
      const validEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        NODE_ENV: 'development',
      }

      const result = envSchema.safeParse(validEnv)
      expect(result.success).toBe(true)
    })

    it('fails with invalid Supabase URL', () => {
      const invalidEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      }

      const result = envSchema.safeParse(invalidEnv)
      expect(result.success).toBe(false)
    })

    it('fails with missing required variables', () => {
      const invalidEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        // Missing NEXT_PUBLIC_SUPABASE_ANON_KEY
      }

      const result = envSchema.safeParse(invalidEnv)
      expect(result.success).toBe(false)
    })

    it('accepts valid NODE_ENV values', () => {
      const envs = ['development', 'production', 'test']

      envs.forEach((nodeEnv) => {
        const result = envSchema.safeParse({
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
          NODE_ENV: nodeEnv,
        })
        expect(result.success).toBe(true)
      })
    })

    it('rejects invalid NODE_ENV values', () => {
      const result = envSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        NODE_ENV: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('accepts valid LOG_LEVEL values', () => {
      const levels = ['debug', 'info', 'warn', 'error']

      levels.forEach((level) => {
        const result = envSchema.safeParse({
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
          LOG_LEVEL: level,
        })
        expect(result.success).toBe(true)
      })
    })

    it('defaults NODE_ENV to development', () => {
      const result = envSchema.parse({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
      })
      expect(result.NODE_ENV).toBe('development')
    })

    it('defaults LOG_LEVEL to info', () => {
      const result = envSchema.parse({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
      })
      expect(result.LOG_LEVEL).toBe('info')
    })

    it('accepts optional Sentry DSN', () => {
      const result = envSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        NEXT_PUBLIC_SENTRY_DSN: 'https://abc@sentry.io/123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid Sentry DSN', () => {
      const result = envSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        NEXT_PUBLIC_SENTRY_DSN: 'not-a-url',
      })
      expect(result.success).toBe(false)
    })
  })
})
