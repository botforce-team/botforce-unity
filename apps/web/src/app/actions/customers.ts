'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Customer, ActionResult, PaginatedResult } from '@/types'

export interface CustomersFilter {
  search?: string
  isActive?: boolean
  page?: number
  limit?: number
  sortBy?: keyof Customer
  sortOrder?: 'asc' | 'desc'
}

export async function getCustomers(
  filter: CustomersFilter = {}
): Promise<PaginatedResult<Customer>> {
  const supabase = await createClient()

  const {
    search = '',
    isActive,
    page = 1,
    limit = 20,
    sortBy = 'name',
    sortOrder = 'asc',
  } = filter

  let query = supabase.from('customers').select('*', { count: 'exact' })

  // Search filter
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`
    )
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
    console.error('Error fetching customers:', error)
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return {
    data: data as Customer[],
    total,
    page,
    limit,
    totalPages,
  }
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching customer:', error)
    return null
  }

  return data as Customer
}

export interface CreateCustomerInput {
  name: string
  legal_name?: string | null
  vat_number?: string | null
  tax_exempt?: boolean
  reverse_charge?: boolean
  email?: string | null
  phone?: string | null
  address_line1?: string | null
  address_line2?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string
  payment_terms_days?: number
  default_tax_rate?: string
  currency?: string
  notes?: string | null
}

export async function createCustomer(
  input: CreateCustomerInput
): Promise<ActionResult<Customer>> {
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
    .from('customers')
    .insert({
      company_id: membership.company_id,
      name: input.name,
      legal_name: input.legal_name || null,
      vat_number: input.vat_number || null,
      tax_exempt: input.tax_exempt || false,
      reverse_charge: input.reverse_charge || false,
      email: input.email || null,
      phone: input.phone || null,
      address_line1: input.address_line1 || null,
      address_line2: input.address_line2 || null,
      postal_code: input.postal_code || null,
      city: input.city || null,
      country: input.country || 'AT',
      payment_terms_days: input.payment_terms_days || 14,
      default_tax_rate: input.default_tax_rate || 'standard_20',
      currency: input.currency || 'EUR',
      notes: input.notes || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating customer:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/customers')
  return { success: true, data: data as Customer }
}

export async function updateCustomer(
  id: string,
  input: Partial<CreateCustomerInput>
): Promise<ActionResult<Customer>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating customer:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { success: true, data: data as Customer }
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Check if customer has any documents
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', id)

  if (count && count > 0) {
    return {
      success: false,
      error: 'Cannot delete customer with existing documents',
    }
  }

  // Check if customer has any projects
  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', id)

  if (projectCount && projectCount > 0) {
    return {
      success: false,
      error: 'Cannot delete customer with existing projects',
    }
  }

  const { error } = await supabase.from('customers').delete().eq('id', id)

  if (error) {
    console.error('Error deleting customer:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/customers')
  return { success: true }
}

export async function toggleCustomerActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<Customer>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error toggling customer status:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { success: true, data: data as Customer }
}
