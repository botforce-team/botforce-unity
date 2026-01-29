'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  RecurringInvoiceTemplate,
  RecurringInvoiceLine,
  RecurringFrequency,
  TaxRate,
  ActionResult,
  PaginatedResult,
} from '@/types'

export interface RecurringInvoicesFilter {
  customerId?: string
  isActive?: boolean
  page?: number
  limit?: number
}

type RecurringTemplateWithRelations = RecurringInvoiceTemplate & {
  customer?: { name: string }
}

export async function getRecurringInvoices(
  filter: RecurringInvoicesFilter = {}
): Promise<PaginatedResult<RecurringTemplateWithRelations>> {
  const supabase = await createClient()

  const { customerId, isActive, page = 1, limit = 50 } = filter

  let query = supabase
    .from('recurring_invoice_templates')
    .select('*, customer:customers(name)', { count: 'exact' })

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  if (isActive !== undefined) {
    query = query.eq('is_active', isActive)
  }

  query = query.order('created_at', { ascending: false })

  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching recurring invoices:', error)
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return {
    data: data as RecurringTemplateWithRelations[],
    total,
    page,
    limit,
    totalPages,
  }
}

export async function getRecurringInvoice(
  id: string
): Promise<RecurringTemplateWithRelations | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recurring_invoice_templates')
    .select('*, customer:customers(name), lines:recurring_invoice_lines(*)')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching recurring invoice:', error)
    return null
  }

  return data as RecurringTemplateWithRelations
}

export interface CreateRecurringLineInput {
  description: string
  quantity: number
  unit: string
  unit_price: number
  tax_rate: TaxRate
  project_id?: string | null
}

export interface CreateRecurringInvoiceInput {
  customer_id: string
  name: string
  description?: string | null
  frequency: RecurringFrequency
  day_of_month?: number | null
  day_of_week?: number | null
  payment_terms_days?: number
  notes?: string | null
  is_active?: boolean
  next_issue_date?: string | null
  lines: CreateRecurringLineInput[]
}

function calculateTax(amount: number, taxRate: TaxRate): number {
  const taxRates: Record<TaxRate, number> = {
    standard_20: 0.20,
    reduced_10: 0.10,
    zero: 0,
    reverse_charge: 0,
  }
  return Math.round(amount * taxRates[taxRate] * 100) / 100
}

export async function createRecurringInvoice(
  input: CreateRecurringInvoiceInput
): Promise<ActionResult<RecurringInvoiceTemplate>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const adminClient = await createAdminClient()
  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return { success: false, error: 'No company membership found' }
  }

  // Calculate totals
  let subtotal = 0
  let totalTax = 0

  const processedLines = input.lines.map((line, index) => {
    const lineSubtotal = Math.round(line.quantity * line.unit_price * 100) / 100
    const lineTax = calculateTax(lineSubtotal, line.tax_rate)
    subtotal += lineSubtotal
    totalTax += lineTax

    return {
      ...line,
      line_number: index + 1,
    }
  })

  const total = subtotal + totalTax

  // Create template
  const { data: template, error: templateError } = await supabase
    .from('recurring_invoice_templates')
    .insert({
      company_id: membership.company_id,
      customer_id: input.customer_id,
      name: input.name,
      description: input.description || null,
      frequency: input.frequency,
      day_of_month: input.day_of_month || null,
      day_of_week: input.day_of_week || null,
      payment_terms_days: input.payment_terms_days || 14,
      notes: input.notes || null,
      is_active: input.is_active ?? true,
      next_issue_date: input.next_issue_date || null,
      subtotal,
      tax_amount: totalTax,
      total,
    })
    .select()
    .single()

  if (templateError) {
    console.error('Error creating recurring invoice:', templateError)
    return { success: false, error: templateError.message }
  }

  // Create lines
  const linesWithTemplateId = processedLines.map((line) => ({
    template_id: template.id,
    line_number: line.line_number,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
    tax_rate: line.tax_rate,
    project_id: line.project_id || null,
  }))

  const { error: linesError } = await supabase
    .from('recurring_invoice_lines')
    .insert(linesWithTemplateId)

  if (linesError) {
    console.error('Error creating recurring invoice lines:', linesError)
    await supabase.from('recurring_invoice_templates').delete().eq('id', template.id)
    return { success: false, error: linesError.message }
  }

  revalidatePath('/documents/recurring')
  return { success: true, data: template as RecurringInvoiceTemplate }
}

export async function updateRecurringInvoice(
  id: string,
  input: Partial<Omit<CreateRecurringInvoiceInput, 'lines'>> & { lines?: CreateRecurringLineInput[] }
): Promise<ActionResult<RecurringInvoiceTemplate>> {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.customer_id) updateData.customer_id = input.customer_id
  if (input.name) updateData.name = input.name
  if (input.description !== undefined) updateData.description = input.description
  if (input.frequency) updateData.frequency = input.frequency
  if (input.day_of_month !== undefined) updateData.day_of_month = input.day_of_month
  if (input.day_of_week !== undefined) updateData.day_of_week = input.day_of_week
  if (input.payment_terms_days !== undefined) updateData.payment_terms_days = input.payment_terms_days
  if (input.notes !== undefined) updateData.notes = input.notes
  if (input.is_active !== undefined) updateData.is_active = input.is_active
  if (input.next_issue_date !== undefined) updateData.next_issue_date = input.next_issue_date

  // If lines are provided, recalculate totals
  if (input.lines) {
    let subtotal = 0
    let totalTax = 0

    const processedLines = input.lines.map((line, index) => {
      const lineSubtotal = Math.round(line.quantity * line.unit_price * 100) / 100
      const lineTax = calculateTax(lineSubtotal, line.tax_rate)
      subtotal += lineSubtotal
      totalTax += lineTax

      return {
        template_id: id,
        line_number: index + 1,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
        project_id: line.project_id || null,
      }
    })

    updateData.subtotal = subtotal
    updateData.tax_amount = totalTax
    updateData.total = subtotal + totalTax

    // Delete existing lines
    await supabase.from('recurring_invoice_lines').delete().eq('template_id', id)

    // Insert new lines
    const { error: linesError } = await supabase
      .from('recurring_invoice_lines')
      .insert(processedLines)

    if (linesError) {
      console.error('Error updating recurring invoice lines:', linesError)
      return { success: false, error: linesError.message }
    }
  }

  const { data, error } = await supabase
    .from('recurring_invoice_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating recurring invoice:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/documents/recurring')
  revalidatePath(`/documents/recurring/${id}`)
  return { success: true, data: data as RecurringInvoiceTemplate }
}

export async function deleteRecurringInvoice(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Delete lines first
  await supabase.from('recurring_invoice_lines').delete().eq('template_id', id)

  const { error } = await supabase
    .from('recurring_invoice_templates')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting recurring invoice:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/documents/recurring')
  return { success: true }
}

export async function toggleRecurringInvoiceActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<RecurringInvoiceTemplate>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recurring_invoice_templates')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error toggling recurring invoice status:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/documents/recurring')
  return { success: true, data: data as RecurringInvoiceTemplate }
}

// Get customers for dropdown
export async function getCustomersForRecurringSelect(): Promise<{ value: string; label: string }[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error fetching customers:', error)
    return []
  }

  return data.map((c) => ({ value: c.id, label: c.name }))
}
