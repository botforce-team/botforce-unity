'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateCompanyInfo(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company and verify admin role
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can update company settings' }
  }

  const { error } = await supabase
    .from('companies')
    .update({
      name: formData.get('name') as string,
      legal_name: formData.get('legal_name') as string || null,
      vat_number: formData.get('vat_number') as string || null,
      registration_number: formData.get('registration_number') as string || null,
    })
    .eq('id', membership.company_id)

  if (error) {
    console.error('Error updating company info:', error)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function updateCompanyAddress(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company and verify admin role
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can update company settings' }
  }

  const { error } = await supabase
    .from('companies')
    .update({
      address_line1: formData.get('address_line1') as string || null,
      address_line2: formData.get('address_line2') as string || null,
      postal_code: formData.get('postal_code') as string || null,
      city: formData.get('city') as string || null,
      country: formData.get('country') as string || 'AT',
    })
    .eq('id', membership.company_id)

  if (error) {
    console.error('Error updating company address:', error)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function updateCompanyContact(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company and verify admin role
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can update company settings' }
  }

  const { error } = await supabase
    .from('companies')
    .update({
      email: formData.get('email') as string || null,
      phone: formData.get('phone') as string || null,
      website: formData.get('website') as string || null,
    })
    .eq('id', membership.company_id)

  if (error) {
    console.error('Error updating company contact:', error)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}
