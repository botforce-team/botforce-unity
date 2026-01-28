'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Project, ActionResult, PaginatedResult } from '@/types'

export interface ProjectsFilter {
  search?: string
  customerId?: string
  isActive?: boolean
  page?: number
  limit?: number
  sortBy?: keyof Project
  sortOrder?: 'asc' | 'desc'
}

export async function getProjects(
  filter: ProjectsFilter = {}
): Promise<PaginatedResult<Project & { customer: { name: string } }>> {
  const supabase = await createClient()

  const {
    search = '',
    customerId,
    isActive,
    page = 1,
    limit = 20,
    sortBy = 'name',
    sortOrder = 'asc',
  } = filter

  let query = supabase
    .from('projects')
    .select('*, customer:customers(name)', { count: 'exact' })

  // Search filter
  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
  }

  // Customer filter
  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  // Active filter
  if (isActive !== undefined) {
    query = query.eq('is_active', isActive)
  }

  // Sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  // Pagination
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching projects:', error)
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return {
    data: data as (Project & { customer: { name: string } })[],
    total,
    page,
    limit,
    totalPages,
  }
}

export async function getProject(id: string): Promise<(Project & { customer: { name: string } }) | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select('*, customer:customers(name)')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching project:', error)
    return null
  }

  return data as Project & { customer: { name: string } }
}

export interface CreateProjectInput {
  customer_id: string
  name: string
  code: string
  description?: string | null
  billing_type: 'hourly' | 'fixed'
  hourly_rate?: number | null
  fixed_price?: number | null
  budget_hours?: number | null
  budget_amount?: number | null
  start_date?: string | null
  end_date?: string | null
  time_recording_mode?: 'hours' | 'start_end'
  is_billable?: boolean
}

export async function createProject(
  input: CreateProjectInput
): Promise<ActionResult<Project>> {
  const supabase = await createClient()

  // Get the user's company
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

  const { data, error } = await supabase
    .from('projects')
    .insert({
      company_id: membership.company_id,
      customer_id: input.customer_id,
      name: input.name,
      code: input.code,
      description: input.description || null,
      billing_type: input.billing_type,
      hourly_rate: input.hourly_rate || null,
      fixed_price: input.fixed_price || null,
      budget_hours: input.budget_hours || null,
      budget_amount: input.budget_amount || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      time_recording_mode: input.time_recording_mode || 'hours',
      is_billable: input.is_billable ?? true,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/projects')
  return { success: true, data: data as Project }
}

export async function updateProject(
  id: string,
  input: Partial<CreateProjectInput>
): Promise<ActionResult<Project>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating project:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  return { success: true, data: data as Project }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Check if project has any time entries
  const { count: timeEntryCount } = await supabase
    .from('time_entries')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id)

  if (timeEntryCount && timeEntryCount > 0) {
    return {
      success: false,
      error: 'Cannot delete project with existing time entries',
    }
  }

  // Check if project has any documents
  const { count: docCount } = await supabase
    .from('document_lines')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id)

  if (docCount && docCount > 0) {
    return {
      success: false,
      error: 'Cannot delete project with existing invoice lines',
    }
  }

  const { error } = await supabase.from('projects').delete().eq('id', id)

  if (error) {
    console.error('Error deleting project:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/projects')
  return { success: true }
}

export async function toggleProjectActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<Project>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error toggling project status:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  return { success: true, data: data as Project }
}

// Get customers for dropdown
export async function getCustomersForSelect(): Promise<{ value: string; label: string }[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('customers')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (data || []).map((c) => ({ value: c.id, label: c.name }))
}

// Project team management
export async function getProjectTeam(projectId: string) {
  const supabase = await createClient()

  // Get assignments first
  const { data: assignments, error } = await supabase
    .from('project_assignments')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching project team:', error)
    return []
  }

  if (!assignments || assignments.length === 0) {
    return []
  }

  // Get user info from company_members
  const userIds = assignments.map((a) => a.user_id)
  const { data: members } = await supabase
    .from('company_members')
    .select('user_id, role')
    .in('user_id', userIds)

  // Combine the data
  return assignments.map((assignment) => ({
    ...assignment,
    member: members?.find((m) => m.user_id === assignment.user_id) || null,
  }))
}

export async function addTeamMember(
  projectId: string,
  userId: string,
  hourlyRateOverride?: number
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase.from('project_assignments').insert({
    project_id: projectId,
    user_id: userId,
    hourly_rate_override: hourlyRateOverride || null,
    assigned_at: new Date().toISOString(),
    is_active: true,
  })

  if (error) {
    console.error('Error adding team member:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function removeTeamMember(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('project_assignments')
    .update({
      is_active: false,
      unassigned_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error removing team member:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
