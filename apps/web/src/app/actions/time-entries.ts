'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const timeEntrySchema = z.object({
  project_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0.25).max(24),
  description: z.string().optional(),
  is_billable: z.boolean().default(true),
})

export async function createTimeEntry(formData: FormData) {
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

  if (!membership) {
    return { error: 'No company membership found' }
  }

  // Parse and validate input
  const rawData = {
    project_id: formData.get('project_id') as string,
    date: formData.get('date') as string,
    hours: parseFloat(formData.get('hours') as string),
    description: formData.get('description') as string || undefined,
    is_billable: formData.get('is_billable') === 'true',
  }

  const result = timeEntrySchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input', details: result.error.flatten() }
  }

  const { project_id, date, hours, description, is_billable } = result.data

  // Create the time entry
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      company_id: membership.company_id,
      project_id,
      user_id: user.id,
      date,
      hours,
      description,
      is_billable,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating time entry:', error)
    return { error: error.message }
  }

  revalidatePath('/timesheets')
  return { data }
}

export async function updateTimeEntry(id: string, formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Parse and validate input
  const rawData = {
    project_id: formData.get('project_id') as string,
    date: formData.get('date') as string,
    hours: parseFloat(formData.get('hours') as string),
    description: formData.get('description') as string || undefined,
    is_billable: formData.get('is_billable') === 'true',
  }

  const result = timeEntrySchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input', details: result.error.flatten() }
  }

  const { project_id, date, hours, description, is_billable } = result.data

  // Update the time entry
  const { data, error } = await supabase
    .from('time_entries')
    .update({
      project_id,
      date,
      hours,
      description,
      is_billable,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating time entry:', error)
    return { error: error.message }
  }

  revalidatePath('/timesheets')
  return { data }
}

export async function submitTimeEntry(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update({ status: 'submitted' })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    console.error('Error submitting time entry:', error)
    return { error: error.message }
  }

  revalidatePath('/timesheets')
  return { data }
}

export async function approveTimeEntry(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get entry to find project rate
  const { data: entry } = await supabase
    .from('time_entries')
    .select(`
      *,
      project:projects(hourly_rate)
    `)
    .eq('id', id)
    .single()

  if (!entry) {
    return { error: 'Time entry not found' }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      status: 'approved',
      approved_by: user.id,
      hourly_rate: entry.project?.hourly_rate || null,
    })
    .eq('id', id)
    .eq('status', 'submitted')
    .select()
    .single()

  if (error) {
    console.error('Error approving time entry:', error)
    return { error: error.message }
  }

  revalidatePath('/timesheets')
  return { data }
}

export async function rejectTimeEntry(id: string, reason: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      status: 'rejected',
      rejected_by: user.id,
      rejection_reason: reason,
    })
    .eq('id', id)
    .in('status', ['submitted', 'approved'])
    .select()
    .single()

  if (error) {
    console.error('Error rejecting time entry:', error)
    return { error: error.message }
  }

  revalidatePath('/timesheets')
  return { data }
}

export async function deleteTimeEntry(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', id)
    .eq('status', 'draft')

  if (error) {
    console.error('Error deleting time entry:', error)
    return { error: error.message }
  }

  revalidatePath('/timesheets')
  return { success: true }
}
