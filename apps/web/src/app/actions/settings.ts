'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ActionResult {
  success: boolean
  error?: string
  data?: any
}

export interface CompanySettings {
  default_payment_terms_days: number
  invoice_prefix: string
  credit_note_prefix: string
  default_tax_rate: string
  mileage_rate: number
}

export interface CompanyInfo {
  id: string
  name: string
  legal_name: string
  vat_number: string | null
  registration_number: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string
  email: string | null
  phone: string | null
  website: string | null
  logo_url: string | null
  settings: CompanySettings
}

/**
 * Get the current company information
 */
export async function getCompanyInfo(): Promise<ActionResult & { data?: CompanyInfo }> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', membership.company_id)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: company as CompanyInfo }
}

/**
 * Update company information
 */
export async function updateCompanyInfo(data: Partial<Omit<CompanyInfo, 'id' | 'settings'>>): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  if (membership.role !== 'superadmin') {
    return { success: false, error: 'Only superadmins can update company settings' }
  }

  const { error } = await supabase
    .from('companies')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.company_id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

/**
 * Update company settings (JSON settings field)
 */
export async function updateCompanySettings(settings: Partial<CompanySettings>): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  if (membership.role !== 'superadmin') {
    return { success: false, error: 'Only superadmins can update company settings' }
  }

  // Get current settings
  const { data: company } = await supabase
    .from('companies')
    .select('settings')
    .eq('id', membership.company_id)
    .single()

  const currentSettings = (company?.settings || {}) as CompanySettings
  const newSettings = { ...currentSettings, ...settings }

  const { error } = await supabase
    .from('companies')
    .update({
      settings: newSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.company_id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

/**
 * Get current user's profile
 */
export async function getUserProfile(): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Get membership info
  const { data: membership } = await supabase
    .from('company_members')
    .select('role, hourly_rate')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return {
    success: true,
    data: {
      ...profile,
      role: membership?.role || 'employee',
      hourly_rate: membership?.hourly_rate,
    },
  }
}

/**
 * Update current user's profile
 */
export async function updateUserProfile(data: {
  full_name?: string
  phone?: string
  avatar_url?: string
}): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

/**
 * Get dashboard stats for overdue invoices
 */
export async function getDashboardStats(): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('is_active', true)
    .maybeSingle()

  const role = membership?.role || 'employee'

  // Get overdue invoices (for admin/accountant)
  let overdueInvoices: any[] = []
  if (role === 'superadmin' || role === 'accountant') {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('documents')
      .select('id, document_number, total, due_date, customer:customers(name)')
      .eq('document_type', 'invoice')
      .eq('status', 'issued')
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(5)

    overdueInvoices = data || []
  }

  // Get pending time entry approvals (for superadmin)
  let pendingTimeApprovals = 0
  if (role === 'superadmin') {
    const { count } = await supabase
      .from('time_entries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'submitted')

    pendingTimeApprovals = count || 0
  }

  // Get pending expense approvals (for superadmin)
  let pendingExpenseApprovals = 0
  if (role === 'superadmin') {
    const { count } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'submitted')

    pendingExpenseApprovals = count || 0
  }

  return {
    success: true,
    data: {
      overdueInvoices,
      pendingTimeApprovals,
      pendingExpenseApprovals,
    },
  }
}
