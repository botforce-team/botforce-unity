import { describe, it, expect } from 'vitest'
import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  dateSchema,
  loginSchema,
  customerSchema,
  projectSchema,
  timeEntrySchema,
  expenseSchema,
  documentLineSchema,
  validateData,
  getFirstError,
} from './validations'

describe('emailSchema', () => {
  it('accepts valid emails', () => {
    expect(emailSchema.safeParse('test@example.com').success).toBe(true)
    expect(emailSchema.safeParse('user.name@domain.co.at').success).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(emailSchema.safeParse('invalid').success).toBe(false)
    expect(emailSchema.safeParse('missing@').success).toBe(false)
    expect(emailSchema.safeParse('@nodomain.com').success).toBe(false)
  })

  it('rejects empty strings', () => {
    expect(emailSchema.safeParse('').success).toBe(false)
  })
})

describe('passwordSchema', () => {
  it('accepts valid passwords', () => {
    expect(passwordSchema.safeParse('password123').success).toBe(true)
    expect(passwordSchema.safeParse('12345678').success).toBe(true)
  })

  it('rejects short passwords', () => {
    const result = passwordSchema.safeParse('short')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('8 characters')
    }
  })

  it('rejects very long passwords', () => {
    const longPassword = 'a'.repeat(129)
    expect(passwordSchema.safeParse(longPassword).success).toBe(false)
  })
})

describe('phoneSchema', () => {
  it('accepts valid phone numbers', () => {
    expect(phoneSchema.safeParse('+43 1 234 5678').success).toBe(true)
    expect(phoneSchema.safeParse('0664 123 4567').success).toBe(true)
    expect(phoneSchema.safeParse('+1555-123-4567').success).toBe(true)
    expect(phoneSchema.safeParse('(555) 123-4567').success).toBe(true)
  })

  it('accepts empty string (optional)', () => {
    expect(phoneSchema.safeParse('').success).toBe(true)
  })

  it('rejects invalid phone numbers', () => {
    expect(phoneSchema.safeParse('not a phone').success).toBe(false)
    expect(phoneSchema.safeParse('abc123').success).toBe(false)
  })
})

describe('dateSchema', () => {
  it('accepts valid dates', () => {
    expect(dateSchema.safeParse('2024-01-15').success).toBe(true)
    expect(dateSchema.safeParse('2023-12-31').success).toBe(true)
  })

  it('rejects invalid formats', () => {
    expect(dateSchema.safeParse('15-01-2024').success).toBe(false)
    expect(dateSchema.safeParse('2024/01/15').success).toBe(false)
    expect(dateSchema.safeParse('Jan 15, 2024').success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing email', () => {
    const result = loginSchema.safeParse({
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('customerSchema', () => {
  it('accepts valid customer data', () => {
    const result = customerSchema.safeParse({
      name: 'Test Company',
      country: 'AT',
    })
    expect(result.success).toBe(true)
  })

  it('applies default values', () => {
    const result = customerSchema.safeParse({
      name: 'Test Company',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.payment_terms_days).toBe(30)
      expect(result.data.default_tax_rate).toBe('standard_20')
      expect(result.data.currency).toBe('EUR')
      expect(result.data.country).toBe('AT')
    }
  })

  it('rejects missing name', () => {
    const result = customerSchema.safeParse({
      country: 'AT',
    })
    expect(result.success).toBe(false)
  })

  it('validates email format', () => {
    const result = customerSchema.safeParse({
      name: 'Test',
      email: 'invalid-email',
    })
    expect(result.success).toBe(false)
  })
})

describe('projectSchema', () => {
  it('accepts valid project data', () => {
    const result = projectSchema.safeParse({
      customer_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Project',
      code: 'TP-001',
      billing_type: 'hourly',
    })
    expect(result.success).toBe(true)
  })

  it('validates billing type', () => {
    const result = projectSchema.safeParse({
      customer_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test',
      code: 'TP',
      billing_type: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('validates UUID format for customer_id', () => {
    const result = projectSchema.safeParse({
      customer_id: 'not-a-uuid',
      name: 'Test',
      code: 'TP',
      billing_type: 'hourly',
    })
    expect(result.success).toBe(false)
  })
})

describe('timeEntrySchema', () => {
  it('accepts valid time entry', () => {
    const result = timeEntrySchema.safeParse({
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      date: '2024-01-15',
      hours: 8,
    })
    expect(result.success).toBe(true)
  })

  it('validates hours range', () => {
    expect(timeEntrySchema.safeParse({
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      date: '2024-01-15',
      hours: 0,
    }).success).toBe(false)

    expect(timeEntrySchema.safeParse({
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      date: '2024-01-15',
      hours: 25,
    }).success).toBe(false)
  })

  it('validates time format', () => {
    expect(timeEntrySchema.safeParse({
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      date: '2024-01-15',
      hours: 8,
      start_time: '09:00',
      end_time: '17:00',
    }).success).toBe(true)

    expect(timeEntrySchema.safeParse({
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      date: '2024-01-15',
      hours: 8,
      start_time: 'invalid',
    }).success).toBe(false)
  })
})

describe('expenseSchema', () => {
  it('accepts valid expense', () => {
    const result = expenseSchema.safeParse({
      date: '2024-01-15',
      amount: 100,
      category: 'materials',
    })
    expect(result.success).toBe(true)
  })

  it('validates category', () => {
    const result = expenseSchema.safeParse({
      date: '2024-01-15',
      amount: 100,
      category: 'invalid_category',
    })
    expect(result.success).toBe(false)
  })

  it('requires positive amount', () => {
    const result = expenseSchema.safeParse({
      date: '2024-01-15',
      amount: -50,
      category: 'materials',
    })
    expect(result.success).toBe(false)
  })
})

describe('documentLineSchema', () => {
  it('accepts valid line item', () => {
    const result = documentLineSchema.safeParse({
      description: 'Consulting services',
      quantity: 10,
      unit: 'hours',
      unit_price: 150,
      tax_rate: 'standard_20',
    })
    expect(result.success).toBe(true)
  })

  it('requires all fields', () => {
    const result = documentLineSchema.safeParse({
      description: 'Test',
      quantity: 1,
    })
    expect(result.success).toBe(false)
  })

  it('validates tax rate', () => {
    const result = documentLineSchema.safeParse({
      description: 'Test',
      quantity: 1,
      unit: 'pcs',
      unit_price: 10,
      tax_rate: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('validateData helper', () => {
  it('returns success with valid data', () => {
    const result = validateData(emailSchema, 'test@example.com')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('test@example.com')
    }
  })

  it('returns errors with invalid data', () => {
    const result = validateData(emailSchema, 'invalid')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors).toHaveProperty('root')
    }
  })

  it('groups errors by field path', () => {
    const result = validateData(loginSchema, {
      email: 'invalid',
      password: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors).toHaveProperty('email')
      expect(result.errors).toHaveProperty('password')
    }
  })
})

describe('getFirstError helper', () => {
  it('returns first error message', () => {
    const errors = {
      email: ['Invalid email'],
      password: ['Too short'],
    }
    expect(getFirstError(errors)).toBe('Invalid email')
  })

  it('returns default message for empty errors', () => {
    expect(getFirstError({})).toBe('Validation failed')
  })
})
