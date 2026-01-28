'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Expense, ActionResult, PaginatedResult, ExpenseStatus, ExpenseCategory, TaxRate } from '@/types'

export interface ExpensesFilter {
  projectId?: string
  userId?: string
  status?: ExpenseStatus
  category?: ExpenseCategory
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

type ExpenseWithRelations = Expense & {
  project?: { name: string; code: string }
}

export async function getExpenses(
  filter: ExpensesFilter = {}
): Promise<PaginatedResult<ExpenseWithRelations>> {
  const supabase = await createClient()

  const {
    projectId,
    userId,
    status,
    category,
    dateFrom,
    dateTo,
    page = 1,
    limit = 50,
  } = filter

  let query = supabase
    .from('expenses')
    .select('*, project:projects(name, code)', { count: 'exact' })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  if (userId) {
    query = query.eq('user_id', userId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (category) {
    query = query.eq('category', category)
  }

  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('date', dateTo)
  }

  query = query.order('date', { ascending: false }).order('created_at', { ascending: false })

  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching expenses:', error)
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return {
    data: data as ExpenseWithRelations[],
    total,
    page,
    limit,
    totalPages,
  }
}

export async function getMyExpenses(
  filter: Omit<ExpensesFilter, 'userId'> = {}
): Promise<PaginatedResult<ExpenseWithRelations>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], total: 0, page: 1, limit: 50, totalPages: 0 }
  }

  return getExpenses({ ...filter, userId: user.id })
}

export async function getExpense(id: string): Promise<ExpenseWithRelations | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .select('*, project:projects(name, code)')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching expense:', error)
    return null
  }

  return data as ExpenseWithRelations
}

export interface CreateExpenseInput {
  project_id?: string | null
  date: string
  amount: number
  currency?: string
  tax_rate: TaxRate
  category: ExpenseCategory
  description?: string | null
  merchant?: string | null
  is_reimbursable?: boolean
}

export async function createExpense(
  input: CreateExpenseInput
): Promise<ActionResult<Expense>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return { success: false, error: 'No company membership found' }
  }

  // Calculate tax amount based on rate
  const taxRates: Record<TaxRate, number> = {
    standard_20: 0.20,
    reduced_10: 0.10,
    zero: 0,
    reverse_charge: 0,
  }
  const taxMultiplier = taxRates[input.tax_rate]
  const taxAmount = input.amount * taxMultiplier

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      company_id: membership.company_id,
      user_id: user.id,
      project_id: input.project_id || null,
      date: input.date,
      amount: input.amount,
      currency: input.currency || 'EUR',
      tax_rate: input.tax_rate,
      tax_amount: Math.round(taxAmount * 100) / 100,
      category: input.category,
      description: input.description || null,
      merchant: input.merchant || null,
      is_reimbursable: input.is_reimbursable ?? true,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating expense:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/expenses')
  return { success: true, data: data as Expense }
}

export async function updateExpense(
  id: string,
  input: Partial<CreateExpenseInput>
): Promise<ActionResult<Expense>> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('expenses')
    .select('status')
    .eq('id', id)
    .single()

  if (existing && !['draft', 'rejected'].includes(existing.status)) {
    return { success: false, error: 'Cannot edit submitted or approved expenses' }
  }

  // Recalculate tax if amount or rate changed
  let updateData: any = { ...input, updated_at: new Date().toISOString() }
  if (input.amount !== undefined || input.tax_rate !== undefined) {
    const { data: current } = await supabase
      .from('expenses')
      .select('amount, tax_rate')
      .eq('id', id)
      .single()

    if (current) {
      const amount = input.amount ?? current.amount
      const taxRate = (input.tax_rate ?? current.tax_rate) as TaxRate
      const taxRates: Record<TaxRate, number> = {
        standard_20: 0.20,
        reduced_10: 0.10,
        zero: 0,
        reverse_charge: 0,
      }
      updateData.tax_amount = Math.round(amount * taxRates[taxRate] * 100) / 100
    }
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating expense:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/expenses')
  return { success: true, data: data as Expense }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('expenses')
    .select('status')
    .eq('id', id)
    .single()

  if (existing && !['draft', 'rejected'].includes(existing.status)) {
    return { success: false, error: 'Cannot delete submitted or approved expenses' }
  }

  const { error } = await supabase.from('expenses').delete().eq('id', id)

  if (error) {
    console.error('Error deleting expense:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/expenses')
  return { success: true }
}

export async function submitExpense(id: string): Promise<ActionResult<Expense>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    console.error('Error submitting expense:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/expenses')
  return { success: true, data: data as Expense }
}

export async function approveExpense(id: string): Promise<ActionResult<Expense>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('expenses')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'submitted')
    .select()
    .single()

  if (error) {
    console.error('Error approving expense:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/expenses')
  return { success: true, data: data as Expense }
}

export async function rejectExpense(
  id: string,
  reason: string
): Promise<ActionResult<Expense>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('expenses')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: user?.id,
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'submitted')
    .select()
    .single()

  if (error) {
    console.error('Error rejecting expense:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/expenses')
  return { success: true, data: data as Expense }
}

