'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Austrian standard mileage rate (Kilometergeld) - internal constant
const MILEAGE_RATE_DEFAULT = 0.42

export async function createExpense(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company membership
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return { error: 'No company access' }
  }

  // Accountants cannot create expenses
  if (membership.role === 'accountant') {
    return { error: 'Accountants cannot create expenses' }
  }

  const category = formData.get('category') as string
  const projectId = formData.get('project_id') as string || null
  const date = formData.get('date') as string
  const description = formData.get('description') as string || null
  const merchant = formData.get('merchant') as string || null

  let amount: number

  // Calculate amount based on category
  if (category === 'mileage') {
    const distanceKm = parseFloat(formData.get('distance_km') as string) || 0
    const ratePerKm = parseFloat(formData.get('rate_per_km') as string) || MILEAGE_RATE_DEFAULT
    amount = distanceKm * ratePerKm
  } else if (category === 'travel_time') {
    const hours = parseFloat(formData.get('hours') as string) || 0
    const hourlyRate = parseFloat(formData.get('hourly_rate') as string) || 0
    amount = hours * hourlyRate
  } else {
    // Direct amount for reimbursements and other categories
    amount = parseFloat(formData.get('amount') as string) || 0
  }

  if (amount <= 0) {
    return { error: 'Amount must be greater than 0' }
  }

  // Build metadata for specific expense types
  let fullDescription = description || ''
  if (category === 'mileage') {
    const distanceKm = parseFloat(formData.get('distance_km') as string) || 0
    const ratePerKm = parseFloat(formData.get('rate_per_km') as string) || MILEAGE_RATE_DEFAULT
    const route = formData.get('route') as string || ''
    fullDescription = `${route ? route + ' - ' : ''}${distanceKm} km @ €${ratePerKm.toFixed(2)}/km${description ? ' - ' + description : ''}`
  } else if (category === 'travel_time') {
    const hours = parseFloat(formData.get('hours') as string) || 0
    const hourlyRate = parseFloat(formData.get('hourly_rate') as string) || 0
    fullDescription = `${hours}h @ €${hourlyRate.toFixed(2)}/h${description ? ' - ' + description : ''}`
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      company_id: membership.company_id,
      user_id: user.id,
      project_id: projectId || null,
      date,
      amount,
      category,
      description: fullDescription || null,
      merchant,
      status: 'draft',
      is_reimbursable: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating expense:', error)
    return { error: error.message }
  }

  revalidatePath('/expenses')
  return { data }
}

export async function submitExpense(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({ status: 'submitted' })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    console.error('Error submitting expense:', error)
    return { error: error.message }
  }

  revalidatePath('/expenses')
  return { data }
}

export async function approveExpense(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can approve expenses' }
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({
      status: 'approved',
      approved_by: user.id,
    })
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .eq('status', 'submitted')
    .select()
    .single()

  if (error) {
    console.error('Error approving expense:', error)
    return { error: error.message }
  }

  revalidatePath('/expenses')
  return { data }
}

export async function rejectExpense(id: string, reason: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can reject expenses' }
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({
      status: 'rejected',
      rejected_by: user.id,
      rejection_reason: reason,
    })
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .eq('status', 'submitted')
    .select()
    .single()

  if (error) {
    console.error('Error rejecting expense:', error)
    return { error: error.message }
  }

  revalidatePath('/expenses')
  return { data }
}

export async function deleteExpense(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Can only delete own draft expenses
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'draft')

  if (error) {
    console.error('Error deleting expense:', error)
    return { error: error.message }
  }

  revalidatePath('/expenses')
  return { success: true }
}
