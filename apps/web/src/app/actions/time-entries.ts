'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { TimeEntry, ActionResult, PaginatedResult, TimeEntryStatus } from '@/types'

export interface TimeEntriesFilter {
  search?: string
  projectId?: string
  userId?: string
  status?: TimeEntryStatus
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

type TimeEntryWithRelations = TimeEntry & {
  project: { name: string; code: string; customer: { name: string } }
}

export async function getTimeEntries(
  filter: TimeEntriesFilter = {}
): Promise<PaginatedResult<TimeEntryWithRelations>> {
  const supabase = await createClient()

  const {
    projectId,
    userId,
    status,
    dateFrom,
    dateTo,
    page = 1,
    limit = 50,
  } = filter

  let query = supabase
    .from('time_entries')
    .select('*, project:projects(name, code, customer:customers(name))', { count: 'exact' })

  // Project filter
  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  // User filter
  if (userId) {
    query = query.eq('user_id', userId)
  }

  // Status filter
  if (status) {
    query = query.eq('status', status)
  }

  // Date filters
  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('date', dateTo)
  }

  // Sorting
  query = query.order('date', { ascending: false }).order('created_at', { ascending: false })

  // Pagination
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching time entries:', error)
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return {
    data: data as TimeEntryWithRelations[],
    total,
    page,
    limit,
    totalPages,
  }
}

export async function getMyTimeEntries(
  filter: Omit<TimeEntriesFilter, 'userId'> = {}
): Promise<PaginatedResult<TimeEntryWithRelations>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], total: 0, page: 1, limit: 50, totalPages: 0 }
  }

  return getTimeEntries({ ...filter, userId: user.id })
}

export async function getTimeEntry(id: string): Promise<TimeEntryWithRelations | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('time_entries')
    .select('*, project:projects(name, code, customer:customers(name))')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching time entry:', error)
    return null
  }

  return data as TimeEntryWithRelations
}

export interface CreateTimeEntryInput {
  project_id: string
  date: string
  hours?: number
  start_time?: string | null
  end_time?: string | null
  break_minutes?: number | null
  description?: string | null
  is_billable?: boolean
}

export async function createTimeEntry(
  input: CreateTimeEntryInput
): Promise<ActionResult<TimeEntry>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get the user's company and project info
  const adminClient = await createAdminClient()
  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id, hourly_rate')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return { success: false, error: 'No company membership found' }
  }

  // Get project info for hourly rate
  const { data: project } = await supabase
    .from('projects')
    .select('hourly_rate, is_billable')
    .eq('id', input.project_id)
    .single()

  // Calculate hours from start/end time if provided
  let hours = input.hours || 0
  if (input.start_time && input.end_time && !input.hours) {
    const start = new Date(`2000-01-01T${input.start_time}`)
    const end = new Date(`2000-01-01T${input.end_time}`)
    const diffMs = end.getTime() - start.getTime()
    const breakMs = (input.break_minutes || 0) * 60 * 1000
    hours = Math.max(0, (diffMs - breakMs) / (1000 * 60 * 60))
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      company_id: membership.company_id,
      project_id: input.project_id,
      user_id: user.id,
      date: input.date,
      hours: Math.round(hours * 100) / 100,
      start_time: input.start_time || null,
      end_time: input.end_time || null,
      break_minutes: input.break_minutes || null,
      description: input.description || null,
      is_billable: input.is_billable ?? project?.is_billable ?? true,
      hourly_rate: project?.hourly_rate || membership.hourly_rate || null,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating time entry:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/timesheets')
  return { success: true, data: data as TimeEntry }
}

export async function updateTimeEntry(
  id: string,
  input: Partial<CreateTimeEntryInput>
): Promise<ActionResult<TimeEntry>> {
  const supabase = await createClient()

  // Check if entry is editable (draft or rejected only)
  const { data: existing } = await supabase
    .from('time_entries')
    .select('status')
    .eq('id', id)
    .single()

  if (existing && !['draft', 'rejected'].includes(existing.status)) {
    return { success: false, error: 'Cannot edit submitted or approved time entries' }
  }

  // Calculate hours if start/end provided
  let hours = input.hours
  if (input.start_time && input.end_time && !input.hours) {
    const start = new Date(`2000-01-01T${input.start_time}`)
    const end = new Date(`2000-01-01T${input.end_time}`)
    const diffMs = end.getTime() - start.getTime()
    const breakMs = (input.break_minutes || 0) * 60 * 1000
    hours = Math.max(0, (diffMs - breakMs) / (1000 * 60 * 60))
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      ...input,
      hours: hours !== undefined ? Math.round(hours * 100) / 100 : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating time entry:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/timesheets')
  return { success: true, data: data as TimeEntry }
}

export async function deleteTimeEntry(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Check if entry is deletable
  const { data: existing } = await supabase
    .from('time_entries')
    .select('status')
    .eq('id', id)
    .single()

  if (existing && !['draft', 'rejected'].includes(existing.status)) {
    return { success: false, error: 'Cannot delete submitted or approved time entries' }
  }

  const { error } = await supabase.from('time_entries').delete().eq('id', id)

  if (error) {
    console.error('Error deleting time entry:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/timesheets')
  return { success: true }
}

export async function submitTimeEntry(id: string): Promise<ActionResult<TimeEntry>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('time_entries')
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
    console.error('Error submitting time entry:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/timesheets')
  return { success: true, data: data as TimeEntry }
}

export async function approveTimeEntry(id: string): Promise<ActionResult<TimeEntry>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('time_entries')
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
    console.error('Error approving time entry:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/timesheets')
  return { success: true, data: data as TimeEntry }
}

export async function rejectTimeEntry(
  id: string,
  reason: string
): Promise<ActionResult<TimeEntry>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('time_entries')
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
    console.error('Error rejecting time entry:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/timesheets')
  return { success: true, data: data as TimeEntry }
}

export async function submitMultipleTimeEntries(ids: string[]): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('time_entries')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('status', 'draft')

  if (error) {
    console.error('Error submitting time entries:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/timesheets')
  return { success: true }
}

export async function approveMultipleTimeEntries(ids: string[]): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('time_entries')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('status', 'submitted')

  if (error) {
    console.error('Error approving time entries:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/timesheets')
  return { success: true }
}

// Get projects for dropdown
export async function getProjectsForSelect(): Promise<{ value: string; label: string }[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('projects')
    .select('id, name, code, customer:customers(name)')
    .eq('is_active', true)
    .order('name')

  return (data || []).map((p: any) => ({
    value: p.id,
    label: `${p.name} (${p.code})${p.customer ? ` - ${p.customer.name}` : ''}`,
  }))
}
