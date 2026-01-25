'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const projectSchema = z.object({
  customer_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().max(50).optional(),
  description: z.string().optional(),
  billing_type: z.enum(['hourly', 'fixed']),
  hourly_rate: z.number().min(0).optional(),
  fixed_price: z.number().min(0).optional(),
  budget_hours: z.number().min(0).optional(),
  time_recording_mode: z.enum(['hours', 'start_end']).default('hours'),
  is_active: z.boolean().default(true),
})

export async function createProject(formData: FormData) {
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
    return { error: 'Only admins can create projects' }
  }

  // Parse and validate input
  const rawData = {
    customer_id: formData.get('customer_id') as string,
    name: formData.get('name') as string,
    code: formData.get('code') as string || undefined,
    description: formData.get('description') as string || undefined,
    billing_type: formData.get('billing_type') as 'hourly' | 'fixed',
    hourly_rate: formData.get('hourly_rate') ? parseFloat(formData.get('hourly_rate') as string) : undefined,
    fixed_price: formData.get('fixed_price') ? parseFloat(formData.get('fixed_price') as string) : undefined,
    budget_hours: formData.get('budget_hours') ? parseFloat(formData.get('budget_hours') as string) : undefined,
    time_recording_mode: (formData.get('time_recording_mode') as 'hours' | 'start_end') || 'hours',
    is_active: formData.get('is_active') !== 'false',
  }

  const result = projectSchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input', details: result.error.flatten() }
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      company_id: membership.company_id,
      ...result.data,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    return { error: error.message }
  }

  revalidatePath('/projects')
  return { data }
}

export async function updateProject(id: string, formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Parse and validate input
  const rawData = {
    customer_id: formData.get('customer_id') as string,
    name: formData.get('name') as string,
    code: formData.get('code') as string || undefined,
    description: formData.get('description') as string || undefined,
    billing_type: formData.get('billing_type') as 'hourly' | 'fixed',
    hourly_rate: formData.get('hourly_rate') ? parseFloat(formData.get('hourly_rate') as string) : undefined,
    fixed_price: formData.get('fixed_price') ? parseFloat(formData.get('fixed_price') as string) : undefined,
    budget_hours: formData.get('budget_hours') ? parseFloat(formData.get('budget_hours') as string) : undefined,
    time_recording_mode: (formData.get('time_recording_mode') as 'hours' | 'start_end') || 'hours',
    is_active: formData.get('is_active') !== 'false',
  }

  const result = projectSchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input', details: result.error.flatten() }
  }

  const { data, error } = await supabase
    .from('projects')
    .update(result.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating project:', error)
    return { error: error.message }
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  return { data }
}

export async function createCustomer(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can create customers' }
  }

  const country = formData.get('country') as string || 'AT'
  // Auto-enable reverse charge for EU countries outside Austria
  const euCountries = ['DE', 'FR', 'IT', 'NL', 'BE', 'ES', 'PT', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'RO', 'BG', 'GR', 'IE', 'DK', 'SE', 'FI', 'EE', 'LV', 'LT', 'LU', 'MT', 'CY']
  const reverseChargeValue = formData.get('reverse_charge')
  const reverseCharge = reverseChargeValue === 'true' || (reverseChargeValue === null && euCountries.includes(country))

  const { data, error } = await supabase
    .from('customers')
    .insert({
      company_id: membership.company_id,
      name: formData.get('name') as string,
      email: formData.get('email') as string || null,
      phone: formData.get('phone') as string || null,
      vat_number: formData.get('vat_number') as string || null,
      address_line1: formData.get('address_line1') as string || null,
      address_line2: formData.get('address_line2') as string || null,
      city: formData.get('city') as string || null,
      postal_code: formData.get('postal_code') as string || null,
      country: country,
      reverse_charge: reverseCharge,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating customer:', error)
    return { error: error.message }
  }

  revalidatePath('/projects/new')
  revalidatePath('/customers')
  return { data }
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can update customers' }
  }

  const { data, error } = await supabase
    .from('customers')
    .update({
      name: formData.get('name') as string,
      email: formData.get('email') as string || null,
      phone: formData.get('phone') as string || null,
      vat_number: formData.get('vat_number') as string || null,
      address_line1: formData.get('address_line1') as string || null,
      address_line2: formData.get('address_line2') as string || null,
      city: formData.get('city') as string || null,
      postal_code: formData.get('postal_code') as string || null,
      country: formData.get('country') as string || 'AT',
      reverse_charge: formData.get('reverse_charge') === 'true',
    })
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .select()
    .single()

  if (error) {
    console.error('Error updating customer:', error)
    return { error: error.message }
  }

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { data }
}

export async function archiveProject(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can archive projects' }
  }

  const { data, error } = await supabase
    .from('projects')
    .update({ is_active: false })
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .select()
    .single()

  if (error) {
    console.error('Error archiving project:', error)
    return { error: error.message }
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  return { data }
}

export async function deleteProject(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can delete projects' }
  }

  // Check if project has time entries
  const { count: timeEntryCount } = await supabase
    .from('time_entries')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id)

  if (timeEntryCount && timeEntryCount > 0) {
    return { error: `Cannot delete project with ${timeEntryCount} time entries. Archive the project instead.` }
  }

  // Check if project has expenses
  const { count: expenseCount } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id)

  if (expenseCount && expenseCount > 0) {
    return { error: `Cannot delete project with ${expenseCount} expenses. Archive the project instead.` }
  }

  // Check if project appears on any invoice lines
  const { count: invoiceLineCount } = await supabase
    .from('document_lines')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id)

  if (invoiceLineCount && invoiceLineCount > 0) {
    return { error: 'Cannot delete project that appears on invoices. Archive the project instead.' }
  }

  // Safe to delete - no related records
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Error deleting project:', error)
    return { error: error.message }
  }

  revalidatePath('/projects')
  return { success: true }
}

export async function deleteCustomer(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can delete customers' }
  }

  // Check if customer has projects
  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', id)

  if (projectCount && projectCount > 0) {
    return { error: 'Cannot delete customer with existing projects. Delete or reassign projects first.' }
  }

  // Check if customer has invoices
  const { count: invoiceCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', id)

  if (invoiceCount && invoiceCount > 0) {
    return { error: 'Cannot delete customer with existing invoices.' }
  }

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Error deleting customer:', error)
    return { error: error.message }
  }

  revalidatePath('/customers')
  return { success: true }
}
