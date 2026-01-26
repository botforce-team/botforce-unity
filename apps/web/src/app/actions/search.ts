'use server'

import { createClient } from '@/lib/supabase/server'

export interface SearchResult {
  type: 'customer' | 'project' | 'document' | 'timesheet' | 'expense' | 'team_member'
  id: string
  title: string
  subtitle?: string
  url: string
  metadata?: Record<string, unknown>
}

export async function globalSearch(query: string): Promise<{ results: SearchResult[]; error?: string }> {
  if (!query || query.length < 2) {
    return { results: [] }
  }

  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { results: [], error: 'Unauthorized' }
  }

  // Get user's company
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membershipData) {
    return { results: [], error: 'No company membership found' }
  }

  const companyId = membershipData.company_id
  const searchPattern = `%${query}%`
  const results: SearchResult[] = []

  // Search customers
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email, city')
    .eq('company_id', companyId)
    .or(`name.ilike.${searchPattern},email.ilike.${searchPattern},vat_number.ilike.${searchPattern}`)
    .limit(5)

  if (customers) {
    results.push(...customers.map(c => ({
      type: 'customer' as const,
      id: c.id,
      title: c.name,
      subtitle: c.email || c.city || undefined,
      url: `/customers/${c.id}`,
    })))
  }

  // Search projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, code, customer:customers(name)')
    .eq('company_id', companyId)
    .or(`name.ilike.${searchPattern},code.ilike.${searchPattern}`)
    .limit(5)

  if (projects) {
    results.push(...projects.map(p => ({
      type: 'project' as const,
      id: p.id,
      title: p.name,
      subtitle: p.code || (p.customer as { name: string } | null)?.name || undefined,
      url: `/projects/${p.id}`,
    })))
  }

  // Search documents (invoices)
  const { data: documents } = await supabase
    .from('documents')
    .select('id, document_number, document_type, total, customer:customers(name)')
    .eq('company_id', companyId)
    .or(`document_number.ilike.${searchPattern}`)
    .limit(5)

  if (documents) {
    results.push(...documents.map(d => ({
      type: 'document' as const,
      id: d.id,
      title: d.document_number || 'Draft',
      subtitle: `${d.document_type === 'invoice' ? 'Invoice' : 'Credit Note'} - ${(d.customer as { name: string } | null)?.name || 'Unknown'}`,
      url: `/documents/${d.id}`,
      metadata: { total: d.total },
    })))
  }

  // Search time entries by description
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('id, date, hours, description, project:projects(name)')
    .eq('company_id', companyId)
    .ilike('description', searchPattern)
    .limit(5)

  if (timeEntries) {
    results.push(...timeEntries.map(t => ({
      type: 'timesheet' as const,
      id: t.id,
      title: t.description || 'Time Entry',
      subtitle: `${t.hours}h on ${t.date} - ${(t.project as { name: string } | null)?.name || 'Unknown'}`,
      url: `/timesheets`,
    })))
  }

  // Search expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, date, amount, description, merchant, category')
    .eq('company_id', companyId)
    .or(`description.ilike.${searchPattern},merchant.ilike.${searchPattern}`)
    .limit(5)

  if (expenses) {
    results.push(...expenses.map(e => ({
      type: 'expense' as const,
      id: e.id,
      title: e.merchant || e.description || e.category,
      subtitle: `€${e.amount} on ${e.date}`,
      url: `/expenses`,
    })))
  }

  // Search team members
  const { data: members } = await supabase
    .from('company_members')
    .select('id, role, profile:profiles(id, first_name, last_name, email)')
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (members) {
    const filteredMembers = members.filter(m => {
      const profile = m.profile as { first_name?: string; last_name?: string; email?: string } | null
      if (!profile) return false
      const searchLower = query.toLowerCase()
      return (
        profile.first_name?.toLowerCase().includes(searchLower) ||
        profile.last_name?.toLowerCase().includes(searchLower) ||
        profile.email?.toLowerCase().includes(searchLower)
      )
    }).slice(0, 5)

    results.push(...filteredMembers.map(m => {
      const profile = m.profile as { id: string; first_name?: string; last_name?: string; email?: string }
      return {
        type: 'team_member' as const,
        id: m.id,
        title: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown',
        subtitle: m.role,
        url: `/team`,
      }
    }))
  }

  return { results }
}
