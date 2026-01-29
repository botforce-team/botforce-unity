'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface TimeReportEntry {
  project_id: string
  project_name: string
  project_code: string
  customer_name: string
  user_id: string
  user_name: string
  total_hours: number
  billable_hours: number
  non_billable_hours: number
  billable_amount: number
}

export interface TimeReportFilters {
  dateFrom?: string
  dateTo?: string
  projectId?: string
  userId?: string
  customerId?: string
}

export async function getTimeReport(filters: TimeReportFilters): Promise<{
  data: TimeReportEntry[]
  totals: {
    total_hours: number
    billable_hours: number
    non_billable_hours: number
    billable_amount: number
  }
  error?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], totals: { total_hours: 0, billable_hours: 0, non_billable_hours: 0, billable_amount: 0 }, error: 'Not authenticated' }
  }

  const adminClient = await createAdminClient()
  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return { data: [], totals: { total_hours: 0, billable_hours: 0, non_billable_hours: 0, billable_amount: 0 }, error: 'No company membership' }
  }

  // Build query for time entries
  // Note: Join profiles directly instead of company_members (no FK between time_entries and company_members)
  let query = supabase
    .from('time_entries')
    .select(`
      id, hours, is_billable, hourly_rate, user_id,
      project:projects!inner(id, name, code, company_id, customer:customers(name)),
      profile:profiles(full_name)
    `)
    .eq('project.company_id', membership.company_id)
    .eq('status', 'approved')

  if (filters.dateFrom) {
    query = query.gte('date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('date', filters.dateTo)
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId)
  }
  if (filters.userId) {
    query = query.eq('user_id', filters.userId)
  }

  const { data: entries, error } = await query

  if (error) {
    console.error('Error fetching time report:', error)
    return { data: [], totals: { total_hours: 0, billable_hours: 0, non_billable_hours: 0, billable_amount: 0 }, error: error.message }
  }

  // Filter by customer if needed
  let filteredEntries = entries || []
  if (filters.customerId) {
    filteredEntries = filteredEntries.filter((e: any) => e.project?.customer?.id === filters.customerId)
  }

  // Group by project and user
  const reportMap = new Map<string, TimeReportEntry>()

  filteredEntries.forEach((entry: any) => {
    const key = `${entry.project_id}-${entry.user_id}`
    const existing = reportMap.get(key)

    const hours = entry.hours || 0
    const isBillable = entry.is_billable
    const rate = entry.hourly_rate || 0

    if (existing) {
      existing.total_hours += hours
      if (isBillable) {
        existing.billable_hours += hours
        existing.billable_amount += hours * rate
      } else {
        existing.non_billable_hours += hours
      }
    } else {
      reportMap.set(key, {
        project_id: entry.project_id,
        project_name: entry.project?.name || 'Unknown',
        project_code: entry.project?.code || '',
        customer_name: entry.project?.customer?.name || 'Unknown',
        user_id: entry.user_id,
        user_name: entry.profile?.full_name || 'Unknown',
        total_hours: hours,
        billable_hours: isBillable ? hours : 0,
        non_billable_hours: isBillable ? 0 : hours,
        billable_amount: isBillable ? hours * rate : 0,
      })
    }
  })

  const data = Array.from(reportMap.values()).sort((a, b) => b.total_hours - a.total_hours)

  const totals = data.reduce(
    (acc, row) => ({
      total_hours: acc.total_hours + row.total_hours,
      billable_hours: acc.billable_hours + row.billable_hours,
      non_billable_hours: acc.non_billable_hours + row.non_billable_hours,
      billable_amount: acc.billable_amount + row.billable_amount,
    }),
    { total_hours: 0, billable_hours: 0, non_billable_hours: 0, billable_amount: 0 }
  )

  return { data, totals }
}

export interface RevenueReportEntry {
  month: string
  invoiced_amount: number
  paid_amount: number
  outstanding_amount: number
  invoice_count: number
  paid_count: number
}

export interface RevenueReportFilters {
  dateFrom?: string
  dateTo?: string
  customerId?: string
}

export async function getRevenueReport(filters: RevenueReportFilters): Promise<{
  data: RevenueReportEntry[]
  totals: {
    invoiced_amount: number
    paid_amount: number
    outstanding_amount: number
    invoice_count: number
  }
  error?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], totals: { invoiced_amount: 0, paid_amount: 0, outstanding_amount: 0, invoice_count: 0 }, error: 'Not authenticated' }
  }

  const adminClient = await createAdminClient()
  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return { data: [], totals: { invoiced_amount: 0, paid_amount: 0, outstanding_amount: 0, invoice_count: 0 }, error: 'No company membership' }
  }

  let query = supabase
    .from('documents')
    .select('id, document_type, status, total, issue_date, paid_date, customer_id')
    .eq('company_id', membership.company_id)
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])

  if (filters.dateFrom) {
    query = query.gte('issue_date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('issue_date', filters.dateTo)
  }
  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }

  const { data: documents, error } = await query

  if (error) {
    console.error('Error fetching revenue report:', error)
    return { data: [], totals: { invoiced_amount: 0, paid_amount: 0, outstanding_amount: 0, invoice_count: 0 }, error: error.message }
  }

  // Group by month
  const monthMap = new Map<string, RevenueReportEntry>()

  ;(documents || []).forEach((doc: any) => {
    const month = doc.issue_date.substring(0, 7) // YYYY-MM
    const existing = monthMap.get(month)

    const amount = doc.total || 0
    const isPaid = doc.status === 'paid'

    if (existing) {
      existing.invoiced_amount += amount
      existing.invoice_count += 1
      if (isPaid) {
        existing.paid_amount += amount
        existing.paid_count += 1
      } else {
        existing.outstanding_amount += amount
      }
    } else {
      monthMap.set(month, {
        month,
        invoiced_amount: amount,
        paid_amount: isPaid ? amount : 0,
        outstanding_amount: isPaid ? 0 : amount,
        invoice_count: 1,
        paid_count: isPaid ? 1 : 0,
      })
    }
  })

  const data = Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month))

  const totals = data.reduce(
    (acc, row) => ({
      invoiced_amount: acc.invoiced_amount + row.invoiced_amount,
      paid_amount: acc.paid_amount + row.paid_amount,
      outstanding_amount: acc.outstanding_amount + row.outstanding_amount,
      invoice_count: acc.invoice_count + row.invoice_count,
    }),
    { invoiced_amount: 0, paid_amount: 0, outstanding_amount: 0, invoice_count: 0 }
  )

  return { data, totals }
}

// Export report data as CSV
export async function exportReportCSV(
  type: 'time' | 'revenue',
  filters: TimeReportFilters | RevenueReportFilters
): Promise<{ csv: string; error?: string }> {
  if (type === 'time') {
    const { data, totals, error } = await getTimeReport(filters as TimeReportFilters)
    if (error) return { csv: '', error }

    const headers = ['Project', 'Code', 'Customer', 'Team Member', 'Total Hours', 'Billable Hours', 'Non-Billable Hours', 'Billable Amount']
    const rows = data.map((row) => [
      row.project_name,
      row.project_code,
      row.customer_name,
      row.user_name,
      row.total_hours.toFixed(2),
      row.billable_hours.toFixed(2),
      row.non_billable_hours.toFixed(2),
      row.billable_amount.toFixed(2),
    ])
    rows.push([
      'TOTAL', '', '', '',
      totals.total_hours.toFixed(2),
      totals.billable_hours.toFixed(2),
      totals.non_billable_hours.toFixed(2),
      totals.billable_amount.toFixed(2),
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    return { csv }
  } else {
    const { data, totals, error } = await getRevenueReport(filters as RevenueReportFilters)
    if (error) return { csv: '', error }

    const headers = ['Month', 'Invoiced Amount', 'Paid Amount', 'Outstanding Amount', 'Invoice Count', 'Paid Count']
    const rows = data.map((row) => [
      row.month,
      row.invoiced_amount.toFixed(2),
      row.paid_amount.toFixed(2),
      row.outstanding_amount.toFixed(2),
      row.invoice_count.toString(),
      row.paid_count.toString(),
    ])
    rows.push([
      'TOTAL',
      totals.invoiced_amount.toFixed(2),
      totals.paid_amount.toFixed(2),
      totals.outstanding_amount.toFixed(2),
      totals.invoice_count.toString(),
      '',
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    return { csv }
  }
}
