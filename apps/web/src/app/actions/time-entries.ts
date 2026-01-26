'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

interface CompanyMembership {
  company_id: string
  role: string
}

const timeEntrySchema = z.object({
  project_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0.01).max(24),
  description: z.string().optional(),
  is_billable: z.boolean().default(true),
  // Start/End time mode fields
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  break_minutes: z.number().min(0).max(480).optional(),
})

export async function createTimeEntry(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership) {
    return { error: 'No company membership found' }
  }

  // Parse and validate input
  const startTimeVal = formData.get('start_time') as string
  const endTimeVal = formData.get('end_time') as string
  const breakMinutesVal = formData.get('break_minutes') as string

  const rawData = {
    project_id: formData.get('project_id') as string,
    date: formData.get('date') as string,
    hours: parseFloat(formData.get('hours') as string),
    description: formData.get('description') as string || undefined,
    is_billable: formData.get('is_billable') === 'true',
    start_time: startTimeVal || undefined,
    end_time: endTimeVal || undefined,
    break_minutes: breakMinutesVal ? parseInt(breakMinutesVal) : undefined,
  }

  const result = timeEntrySchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input', details: result.error.flatten() }
  }

  const { project_id, date, hours, description, is_billable, start_time, end_time, break_minutes } = result.data

  // Build insert data - only include time columns if the migration has been applied
  const baseInsertData = {
    company_id: membership.company_id,
    project_id,
    user_id: user.id,
    date,
    hours,
    description,
    is_billable,
    status: 'draft',
  }

  // Try insert with all fields first
  let { data, error } = await supabase
    .from('time_entries')
    .insert({
      ...baseInsertData,
      start_time: start_time || null,
      end_time: end_time || null,
      break_minutes: break_minutes ?? 0,
    })
    .select()
    .single()

  // If insert fails due to missing columns, retry without the new columns
  if (error && error.message.includes('column')) {
    console.warn('Retrying insert without time mode columns:', error.message)
    const retryResult = await supabase
      .from('time_entries')
      .insert(baseInsertData)
      .select()
      .single()

    data = retryResult.data
    error = retryResult.error
  }

  if (error) {
    console.error('Error creating time entry:', error)
    return { error: error.message }
  }

  console.log('Time entry created successfully:', data?.id, 'for company_id:', membership.company_id)

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
  const startTimeVal = formData.get('start_time') as string
  const endTimeVal = formData.get('end_time') as string
  const breakMinutesVal = formData.get('break_minutes') as string

  const rawData = {
    project_id: formData.get('project_id') as string,
    date: formData.get('date') as string,
    hours: parseFloat(formData.get('hours') as string),
    description: formData.get('description') as string || undefined,
    is_billable: formData.get('is_billable') === 'true',
    start_time: startTimeVal || undefined,
    end_time: endTimeVal || undefined,
    break_minutes: breakMinutesVal ? parseInt(breakMinutesVal) : undefined,
  }

  const result = timeEntrySchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input', details: result.error.flatten() }
  }

  const { project_id, date, hours, description, is_billable, start_time, end_time, break_minutes } = result.data

  // Build update data - only include time columns if the migration has been applied
  const baseUpdateData = {
    project_id,
    date,
    hours,
    description,
    is_billable,
  }

  // Try update with all fields first
  let { data, error } = await supabase
    .from('time_entries')
    .update({
      ...baseUpdateData,
      start_time: start_time || null,
      end_time: end_time || null,
      break_minutes: break_minutes ?? 0,
    })
    .eq('id', id)
    .select()
    .single()

  // If update fails due to missing columns, retry without the new columns
  if (error && error.message.includes('column')) {
    console.warn('Retrying update without time mode columns:', error.message)
    const retryResult = await supabase
      .from('time_entries')
      .update(baseUpdateData)
      .eq('id', id)
      .select()
      .single()

    data = retryResult.data
    error = retryResult.error
  }

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

// Bulk operations
export async function bulkApproveTimeEntries(ids: string[]) {
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
    return { error: 'Only admins can approve time entries' }
  }

  let successCount = 0
  let errorCount = 0

  for (const id of ids) {
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
      errorCount++
      continue
    }

    const { error } = await supabase
      .from('time_entries')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        hourly_rate: (entry as any).project?.hourly_rate || null,
      })
      .eq('id', id)
      .eq('company_id', membership.company_id)
      .eq('status', 'submitted')

    if (error) {
      errorCount++
    } else {
      successCount++
    }
  }

  revalidatePath('/timesheets')
  return { success: true, approved: successCount, errors: errorCount }
}

export async function bulkRejectTimeEntries(ids: string[], reason: string) {
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
    return { error: 'Only admins can reject time entries' }
  }

  let successCount = 0
  let errorCount = 0

  for (const id of ids) {
    const { error } = await supabase
      .from('time_entries')
      .update({
        status: 'rejected',
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', id)
      .eq('company_id', membership.company_id)
      .in('status', ['submitted', 'approved'])

    if (error) {
      errorCount++
    } else {
      successCount++
    }
  }

  revalidatePath('/timesheets')
  return { success: true, rejected: successCount, errors: errorCount }
}

export async function bulkSubmitTimeEntries(ids: string[]) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  let successCount = 0
  let errorCount = 0

  for (const id of ids) {
    const { error } = await supabase
      .from('time_entries')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'draft')

    if (error) {
      errorCount++
    } else {
      successCount++
    }
  }

  revalidatePath('/timesheets')
  return { success: true, submitted: successCount, errors: errorCount }
}
