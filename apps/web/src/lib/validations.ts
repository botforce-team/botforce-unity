/**
 * Zod validation schemas for all forms and inputs
 * Provides consistent validation across the application
 */

import { z } from 'zod'

// ============================================================================
// Common Schemas
// ============================================================================

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')

export const phoneSchema = z
  .string()
  .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, 'Please enter a valid phone number')
  .optional()
  .or(z.literal(''))

export const urlSchema = z
  .string()
  .url('Please enter a valid URL')
  .optional()
  .or(z.literal(''))

export const positiveNumberSchema = z
  .number()
  .positive('Must be a positive number')

export const nonNegativeNumberSchema = z
  .number()
  .min(0, 'Must be zero or greater')

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date (YYYY-MM-DD)')

export const uuidSchema = z
  .string()
  .uuid('Invalid ID format')

// ============================================================================
// Auth Schemas
// ============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const resetPasswordRequestSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

// ============================================================================
// Customer Schemas
// ============================================================================

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  legal_name: z.string().max(255).optional().nullable(),
  vat_number: z.string().max(50).optional().nullable(),
  tax_exempt: z.boolean().default(false),
  reverse_charge: z.boolean().default(false),
  email: emailSchema.optional().or(z.literal('')).nullable(),
  phone: phoneSchema.nullable(),
  address_line1: z.string().max(255).optional().nullable(),
  address_line2: z.string().max(255).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().min(2).max(2).default('AT'),
  payment_terms_days: z.number().int().min(0).max(365).default(30),
  default_tax_rate: z.enum(['standard_20', 'reduced_10', 'zero', 'reverse_charge']).default('standard_20'),
  currency: z.string().length(3).default('EUR'),
  notes: z.string().max(5000).optional().nullable(),
})

export type CustomerFormData = z.infer<typeof customerSchema>

// ============================================================================
// Project Schemas
// ============================================================================

export const projectSchema = z.object({
  customer_id: uuidSchema,
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().min(1, 'Code is required').max(50),
  description: z.string().max(5000).optional().nullable(),
  billing_type: z.enum(['hourly', 'fixed']),
  hourly_rate: nonNegativeNumberSchema.optional().nullable(),
  fixed_price: nonNegativeNumberSchema.optional().nullable(),
  budget_hours: nonNegativeNumberSchema.optional().nullable(),
  budget_amount: nonNegativeNumberSchema.optional().nullable(),
  start_date: dateSchema.optional().nullable(),
  end_date: dateSchema.optional().nullable(),
  time_recording_mode: z.enum(['hours', 'start_end']).default('hours'),
  is_billable: z.boolean().default(true),
})

export type ProjectFormData = z.infer<typeof projectSchema>

// ============================================================================
// Time Entry Schemas
// ============================================================================

export const timeEntrySchema = z.object({
  project_id: uuidSchema,
  date: dateSchema,
  hours: z.number().min(0.01, 'Hours must be greater than 0').max(24, 'Hours cannot exceed 24'),
  start_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format').optional().nullable(),
  end_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format').optional().nullable(),
  break_minutes: z.number().int().min(0).max(480).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  is_billable: z.boolean().default(true),
})

export type TimeEntryFormData = z.infer<typeof timeEntrySchema>

// ============================================================================
// Expense Schemas
// ============================================================================

export const expenseSchema = z.object({
  project_id: uuidSchema.optional().nullable(),
  date: dateSchema,
  amount: positiveNumberSchema,
  currency: z.string().length(3).default('EUR'),
  tax_rate: z.enum(['standard_20', 'reduced_10', 'zero', 'reverse_charge']).default('standard_20'),
  category: z.enum([
    'mileage',
    'travel_time',
    'materials',
    'accommodation',
    'meals',
    'transport',
    'communication',
    'software',
    'other',
  ]),
  description: z.string().max(5000).optional().nullable(),
  merchant: z.string().max(255).optional().nullable(),
  is_reimbursable: z.boolean().default(true),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>

export const mileageExpenseSchema = z.object({
  project_id: uuidSchema.optional().nullable(),
  date: dateSchema,
  distance_km: positiveNumberSchema,
  from_location: z.string().min(1, 'From location is required').max(255),
  to_location: z.string().min(1, 'To location is required').max(255),
  round_trip: z.boolean().default(false),
})

export type MileageExpenseFormData = z.infer<typeof mileageExpenseSchema>

// ============================================================================
// Document Schemas
// ============================================================================

export const documentLineSchema = z.object({
  description: z.string().min(1, 'Description is required').max(1000),
  quantity: positiveNumberSchema,
  unit: z.string().min(1, 'Unit is required').max(50),
  unit_price: nonNegativeNumberSchema,
  tax_rate: z.enum(['standard_20', 'reduced_10', 'zero', 'reverse_charge']),
  project_id: uuidSchema.optional().nullable(),
})

export const documentSchema = z.object({
  customer_id: uuidSchema,
  document_type: z.enum(['invoice', 'credit_note']),
  payment_terms_days: z.number().int().min(0).max(365).default(30),
  notes: z.string().max(5000).optional().nullable(),
  internal_notes: z.string().max(5000).optional().nullable(),
  lines: z.array(documentLineSchema).min(1, 'At least one line item is required'),
})

export type DocumentFormData = z.infer<typeof documentSchema>

// ============================================================================
// Recurring Invoice Schemas
// ============================================================================

export const recurringInvoiceSchema = z.object({
  customer_id: uuidSchema,
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(5000).optional().nullable(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  day_of_month: z.number().int().min(1).max(31).optional().nullable(),
  day_of_week: z.number().int().min(0).max(6).optional().nullable(),
  payment_terms_days: z.number().int().min(0).max(365).default(30),
  notes: z.string().max(5000).optional().nullable(),
  lines: z.array(documentLineSchema).min(1, 'At least one line item is required'),
})

export type RecurringInvoiceFormData = z.infer<typeof recurringInvoiceSchema>

// ============================================================================
// Settings Schemas
// ============================================================================

export const profileSettingsSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(255),
  phone: phoneSchema.nullable(),
})

export const companySettingsSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  legal_name: z.string().min(1, 'Legal name is required').max(255),
  vat_number: z.string().max(50).optional().nullable(),
  registration_number: z.string().max(50).optional().nullable(),
  address_line1: z.string().max(255).optional().nullable(),
  address_line2: z.string().max(255).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().min(2).max(2).default('AT'),
  email: emailSchema.optional().or(z.literal('')).nullable(),
  phone: phoneSchema.nullable(),
  website: urlSchema.nullable(),
})

export const invoiceSettingsSchema = z.object({
  default_payment_terms_days: z.number().int().min(0).max(365).default(30),
  invoice_prefix: z.string().min(1).max(10).default('INV'),
  credit_note_prefix: z.string().min(1).max(10).default('CN'),
  default_tax_rate: z.enum(['standard_20', 'reduced_10', 'zero', 'reverse_charge']).default('standard_20'),
  mileage_rate: positiveNumberSchema.default(0.42),
})

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate data against a schema and return formatted errors
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || 'root'
    if (!errors[path]) {
      errors[path] = []
    }
    errors[path].push(issue.message)
  }

  return { success: false, errors }
}

/**
 * Get first error message from validation result
 */
export function getFirstError(errors: Record<string, string[]>): string {
  const firstKey = Object.keys(errors)[0]
  return firstKey ? errors[firstKey][0] : 'Validation failed'
}
