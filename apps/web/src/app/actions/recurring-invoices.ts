'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { addDays, addWeeks, addMonths, addQuarters, addYears } from 'date-fns'

interface CompanyMembership {
  company_id: string
  role: string
}

type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

const recurringLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default('pcs'),
  unit_price: z.number().min(0),
  tax_rate: z.enum(['standard_20', 'reduced_10', 'zero']).default('standard_20'),
  project_id: z.string().uuid().optional(),
})

const recurringTemplateSchema = z.object({
  customer_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  day_of_month: z.number().min(1).max(28).optional(),
  day_of_week: z.number().min(0).max(6).optional(),
  payment_terms_days: z.number().int().positive().default(14),
  notes: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(recurringLineSchema).min(1),
})

function calculateNextIssueDate(frequency: RecurrenceFrequency, startDate: Date, dayOfMonth?: number): Date {
  const today = new Date()
  let nextDate = new Date(startDate)

  // If start date is in the past, calculate next occurrence
  while (nextDate <= today) {
    switch (frequency) {
      case 'weekly':
        nextDate = addWeeks(nextDate, 1)
        break
      case 'biweekly':
        nextDate = addWeeks(nextDate, 2)
        break
      case 'monthly':
        nextDate = addMonths(nextDate, 1)
        if (dayOfMonth) {
          nextDate.setDate(Math.min(dayOfMonth, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()))
        }
        break
      case 'quarterly':
        nextDate = addQuarters(nextDate, 1)
        if (dayOfMonth) {
          nextDate.setDate(Math.min(dayOfMonth, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()))
        }
        break
      case 'yearly':
        nextDate = addYears(nextDate, 1)
        if (dayOfMonth) {
          nextDate.setDate(Math.min(dayOfMonth, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()))
        }
        break
    }
  }

  return nextDate
}

export async function createRecurringTemplate(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can create recurring invoices' }
  }

  // Parse JSON data from form
  const jsonData = formData.get('data') as string
  let rawData
  try {
    rawData = JSON.parse(jsonData)
  } catch {
    return { error: 'Invalid JSON data' }
  }

  const result = recurringTemplateSchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input', details: result.error.flatten() }
  }

  const {
    customer_id,
    name,
    description,
    frequency,
    day_of_month,
    day_of_week,
    payment_terms_days,
    notes,
    start_date,
    lines,
  } = result.data

  const nextIssueDate = calculateNextIssueDate(
    frequency,
    new Date(start_date),
    day_of_month
  )

  // Create template
  const { data: template, error: templateError } = await supabase
    .from('recurring_invoice_templates')
    .insert({
      company_id: membership.company_id,
      customer_id,
      name,
      description,
      frequency,
      day_of_month: day_of_month || null,
      day_of_week: day_of_week ?? null,
      payment_terms_days,
      notes,
      next_issue_date: nextIssueDate.toISOString().split('T')[0],
      created_by: user.id,
      is_active: true,
    } as never)
    .select()
    .single()

  if (templateError || !template) {
    console.error('Error creating recurring template:', templateError)
    return { error: templateError?.message || 'Failed to create template' }
  }

  // Create lines
  const lineInserts = lines.map((line, index) => ({
    company_id: membership.company_id,
    template_id: (template as any).id,
    line_number: index + 1,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
    tax_rate: line.tax_rate,
    project_id: line.project_id || null,
  }))

  const { error: linesError } = await supabase
    .from('recurring_invoice_lines')
    .insert(lineInserts as never)

  if (linesError) {
    console.error('Error creating recurring lines:', linesError)
    // Clean up template
    await supabase.from('recurring_invoice_templates').delete().eq('id', (template as any).id)
    return { error: linesError.message }
  }

  revalidatePath('/documents')
  return { data: template }
}

export async function updateRecurringTemplate(id: string, formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can update recurring invoices' }
  }

  // Parse JSON data from form
  const jsonData = formData.get('data') as string
  let rawData
  try {
    rawData = JSON.parse(jsonData)
  } catch {
    return { error: 'Invalid JSON data' }
  }

  const result = recurringTemplateSchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input', details: result.error.flatten() }
  }

  const {
    customer_id,
    name,
    description,
    frequency,
    day_of_month,
    day_of_week,
    payment_terms_days,
    notes,
    start_date,
    lines,
  } = result.data

  const nextIssueDate = calculateNextIssueDate(
    frequency,
    new Date(start_date),
    day_of_month
  )

  // Update template
  const { error: templateError } = await supabase
    .from('recurring_invoice_templates')
    .update({
      customer_id,
      name,
      description,
      frequency,
      day_of_month: day_of_month || null,
      day_of_week: day_of_week ?? null,
      payment_terms_days,
      notes,
      next_issue_date: nextIssueDate.toISOString().split('T')[0],
    } as never)
    .eq('id', id)
    .eq('company_id', membership.company_id)

  if (templateError) {
    console.error('Error updating recurring template:', templateError)
    return { error: templateError.message }
  }

  // Delete existing lines and recreate
  await supabase
    .from('recurring_invoice_lines')
    .delete()
    .eq('template_id', id)

  const lineInserts = lines.map((line, index) => ({
    company_id: membership.company_id,
    template_id: id,
    line_number: index + 1,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
    tax_rate: line.tax_rate,
    project_id: line.project_id || null,
  }))

  const { error: linesError } = await supabase
    .from('recurring_invoice_lines')
    .insert(lineInserts as never)

  if (linesError) {
    console.error('Error updating recurring lines:', linesError)
    return { error: linesError.message }
  }

  revalidatePath('/documents')
  return { success: true }
}

export async function toggleRecurringTemplate(id: string, isActive: boolean) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can modify recurring invoices' }
  }

  const { error } = await supabase
    .from('recurring_invoice_templates')
    .update({ is_active: isActive } as never)
    .eq('id', id)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Error toggling recurring template:', error)
    return { error: error.message }
  }

  revalidatePath('/documents')
  return { success: true }
}

export async function deleteRecurringTemplate(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can delete recurring invoices' }
  }

  const { error } = await supabase
    .from('recurring_invoice_templates')
    .delete()
    .eq('id', id)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Error deleting recurring template:', error)
    return { error: error.message }
  }

  revalidatePath('/documents')
  return { success: true }
}

export async function generateInvoiceFromTemplate(templateId: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can generate invoices' }
  }

  // Get template with lines
  const { data: template, error: templateError } = await supabase
    .from('recurring_invoice_templates')
    .select(`
      *,
      lines:recurring_invoice_lines(*)
    `)
    .eq('id', templateId)
    .eq('company_id', membership.company_id)
    .single()

  if (templateError || !template) {
    return { error: 'Template not found' }
  }

  const t = template as any

  // Create draft invoice
  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
      company_id: membership.company_id,
      customer_id: t.customer_id,
      document_type: 'invoice',
      status: 'draft',
      payment_terms_days: t.payment_terms_days,
      notes: t.notes,
      recurring_template_id: templateId,
    } as never)
    .select()
    .single()

  if (docError || !document) {
    console.error('Error creating invoice from template:', docError)
    return { error: docError?.message || 'Failed to create invoice' }
  }

  // Create document lines
  const lineInserts = (t.lines as any[]).map((line: any) => ({
    company_id: membership.company_id,
    document_id: (document as any).id,
    line_number: line.line_number,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
    tax_rate: line.tax_rate,
    project_id: line.project_id,
  }))

  const { error: linesError } = await supabase
    .from('document_lines')
    .insert(lineInserts as never)

  if (linesError) {
    console.error('Error creating document lines:', linesError)
    // Clean up document
    await supabase.from('documents').delete().eq('id', (document as any).id)
    return { error: linesError.message }
  }

  // Update template's last issued date
  await supabase
    .from('recurring_invoice_templates')
    .update({ last_issued_at: new Date().toISOString() } as never)
    .eq('id', templateId)

  revalidatePath('/documents')
  return { data: document }
}

export async function getRecurringTemplates() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as { company_id: string } | null

  if (!membership) {
    return { error: 'No company membership found' }
  }

  const { data: templates, error } = await supabase
    .from('recurring_invoice_templates')
    .select(`
      *,
      customer:customers(name),
      lines:recurring_invoice_lines(*)
    `)
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching recurring templates:', error)
    return { error: error.message }
  }

  return { data: templates }
}
