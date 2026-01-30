'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
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
  const adminClient = await createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Use admin client to bypass RLS for company_members
  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  // Use admin client for companies too
  const { data: company, error } = await adminClient
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
  const adminClient = await createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
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
  const adminClient = await createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
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

  // Get membership info using admin client to bypass RLS
  const adminClient = await createAdminClient()
  const { data: membership } = await adminClient
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
 * Upload company logo and update logo_url
 */
export async function uploadCompanyLogo(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  if (membership.role !== 'superadmin') {
    return { success: false, error: 'Only superadmins can update company logo' }
  }

  const file = formData.get('logo') as File
  if (!file || file.size === 0) {
    return { success: false, error: 'No file provided' }
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: 'Invalid file type. Allowed: PNG, JPEG, GIF, SVG, WebP' }
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: 'File too large. Maximum size is 2MB' }
  }

  // Generate unique filename
  const ext = file.name.split('.').pop() || 'png'
  const filename = `${membership.company_id}/logo-${Date.now()}.${ext}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('company-assets')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return { success: false, error: 'Failed to upload logo' }
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('company-assets')
    .getPublicUrl(filename)

  // Update company with new logo URL
  const { error: updateError } = await supabase
    .from('companies')
    .update({
      logo_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.company_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath('/settings')
  return { success: true, data: { logo_url: publicUrl } }
}

/**
 * Remove company logo
 */
export async function removeCompanyLogo(): Promise<ActionResult> {
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  if (membership.role !== 'superadmin') {
    return { success: false, error: 'Only superadmins can remove company logo' }
  }

  // Update company to remove logo URL
  const { error } = await supabase
    .from('companies')
    .update({
      logo_url: null,
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
 * Get dashboard stats for overdue invoices
 */
export async function getDashboardStats(): Promise<ActionResult> {
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: membership } = await adminClient
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
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
