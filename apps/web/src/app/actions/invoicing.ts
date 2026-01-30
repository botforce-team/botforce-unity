'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { TaxRate, ActionResult, Document } from '@/types'

export interface UnbilledTimeEntry {
  id: string
  project_id: string
  project_name: string
  project_code: string
  customer_id: string
  customer_name: string
  date: string
  hours: number
  description: string | null
  hourly_rate: number | null
  is_billable: boolean
}

export interface UnbilledExpense {
  id: string
  project_id: string | null
  project_name: string | null
  project_code: string | null
  customer_id: string | null
  customer_name: string | null
  date: string
  amount: number
  tax_rate: TaxRate
  tax_amount: number
  category: string
  description: string | null
  merchant: string | null
  is_reimbursable: boolean
}

export async function getUnbilledTimeEntries(customerId?: string): Promise<UnbilledTimeEntry[]> {
  const supabase = await createClient()

  let query = supabase
    .from('time_entries')
    .select(`
      id, project_id, date, hours, description, hourly_rate, is_billable,
      project:projects(name, code, customer_id, customer:customers(id, name))
    `)
    .eq('status', 'approved')
    .eq('is_billable', true)
    .is('document_id', null)
    .order('date', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching unbilled time entries:', error)
    return []
  }

  // Filter by customer if provided and map to flat structure
  const entries = (data || [])
    .filter((entry: any) => {
      if (!customerId) return true
      return entry.project?.customer?.id === customerId
    })
    .map((entry: any) => ({
      id: entry.id,
      project_id: entry.project_id,
      project_name: entry.project?.name || 'Unknown',
      project_code: entry.project?.code || '',
      customer_id: entry.project?.customer?.id || '',
      customer_name: entry.project?.customer?.name || 'Unknown',
      date: entry.date,
      hours: entry.hours,
      description: entry.description,
      hourly_rate: entry.hourly_rate,
      is_billable: entry.is_billable,
    }))

  return entries
}

export async function getUnbilledExpenses(customerId?: string): Promise<UnbilledExpense[]> {
  const supabase = await createClient()

  let query = supabase
    .from('expenses')
    .select(`
      id, project_id, date, amount, tax_rate, tax_amount, category, description, merchant, is_reimbursable,
      project:projects(name, code, customer_id, customer:customers(id, name))
    `)
    .eq('status', 'approved')
    .eq('is_reimbursable', true)
    .is('export_id', null) // Not yet exported/invoiced
    .order('date', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching unbilled expenses:', error)
    return []
  }

  // Filter by customer if provided and map to flat structure
  const expenses = (data || [])
    .filter((exp: any) => {
      if (!customerId) return true
      return exp.project?.customer?.id === customerId
    })
    .map((exp: any) => ({
      id: exp.id,
      project_id: exp.project_id,
      project_name: exp.project?.name || null,
      project_code: exp.project?.code || null,
      customer_id: exp.project?.customer?.id || null,
      customer_name: exp.project?.customer?.name || null,
      date: exp.date,
      amount: exp.amount,
      tax_rate: exp.tax_rate,
      tax_amount: exp.tax_amount,
      category: exp.category,
      description: exp.description,
      merchant: exp.merchant,
      is_reimbursable: exp.is_reimbursable,
    }))

  return expenses
}

export interface InvoiceFromEntriesInput {
  customer_id: string
  time_entry_ids: string[]
  expense_ids: string[]
  payment_terms_days?: number
  notes?: string | null
  internal_notes?: string | null
  group_by?: 'project' | 'entry' | 'summary'
}

export async function createInvoiceFromEntries(
  input: InvoiceFromEntriesInput
): Promise<ActionResult<Document>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const adminClient = await createAdminClient()
  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return { success: false, error: 'No company membership found' }
  }

  // Get customer for payment terms and currency
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', input.customer_id)
    .single()

  if (!customer) {
    return { success: false, error: 'Customer not found' }
  }

  // Fetch selected time entries
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('*, project:projects(name, code, hourly_rate)')
    .in('id', input.time_entry_ids.length > 0 ? input.time_entry_ids : ['none'])
    .eq('status', 'approved')
    .is('document_id', null)

  // Fetch selected expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, project:projects(name, code)')
    .in('id', input.expense_ids.length > 0 ? input.expense_ids : ['none'])
    .eq('status', 'approved')
    .eq('is_reimbursable', true)

  if ((!timeEntries || timeEntries.length === 0) && (!expenses || expenses.length === 0)) {
    return { success: false, error: 'No time entries or expenses selected' }
  }

  // Determine tax rate based on customer
  const defaultTaxRate: TaxRate = customer.reverse_charge
    ? 'reverse_charge'
    : customer.tax_exempt
    ? 'zero'
    : (customer.default_tax_rate as TaxRate) || 'standard_20'

  // Calculate tax multiplier
  const taxRates: Record<TaxRate, number> = {
    standard_20: 0.20,
    reduced_10: 0.10,
    zero: 0,
    reverse_charge: 0,
  }

  // Build invoice lines
  const lines: {
    description: string
    quantity: number
    unit: string
    unit_price: number
    tax_rate: TaxRate
    subtotal: number
    tax_amount: number
    total: number
    time_entry_ids: string[] | null
    expense_ids: string[] | null
    project_id: string | null
  }[] = []

  let lineNumber = 0

  // Group time entries by project
  if (timeEntries && timeEntries.length > 0) {
    if (input.group_by === 'project' || input.group_by === 'summary') {
      // Group by project
      const projectMap = new Map<string, typeof timeEntries>()
      timeEntries.forEach((entry: any) => {
        const key = entry.project_id
        if (!projectMap.has(key)) {
          projectMap.set(key, [])
        }
        projectMap.get(key)!.push(entry)
      })

      projectMap.forEach((entries, projectId) => {
        const project = entries[0].project
        const totalHours = entries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0)

        // Use the first entry's rate, or project rate, or default to 0
        const hourlyRate = entries[0].hourly_rate || project?.hourly_rate || 0
        const subtotal = Math.round(totalHours * hourlyRate * 100) / 100
        const taxAmount = Math.round(subtotal * taxRates[defaultTaxRate] * 100) / 100

        lineNumber++
        lines.push({
          description: input.group_by === 'summary'
            ? `Professional Services - ${project?.name || 'Various'}`
            : `${project?.name || 'Project'} (${project?.code || ''}) - ${totalHours.toFixed(2)} hours`,
          quantity: totalHours,
          unit: 'hours',
          unit_price: hourlyRate,
          tax_rate: defaultTaxRate,
          subtotal,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
          time_entry_ids: entries.map((e: any) => e.id),
          expense_ids: null,
          project_id: projectId,
        })
      })
    } else {
      // Individual entries
      timeEntries.forEach((entry: any) => {
        const hourlyRate = entry.hourly_rate || entry.project?.hourly_rate || 0
        const subtotal = Math.round(entry.hours * hourlyRate * 100) / 100
        const taxAmount = Math.round(subtotal * taxRates[defaultTaxRate] * 100) / 100

        lineNumber++
        lines.push({
          description: `${entry.project?.name || 'Project'} - ${entry.date} - ${entry.description || 'Work performed'}`,
          quantity: entry.hours,
          unit: 'hours',
          unit_price: hourlyRate,
          tax_rate: defaultTaxRate,
          subtotal,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
          time_entry_ids: [entry.id],
          expense_ids: null,
          project_id: entry.project_id,
        })
      })
    }
  }

  // Add expenses as separate lines
  if (expenses && expenses.length > 0) {
    expenses.forEach((exp: any) => {
      const expTaxRate = exp.tax_rate as TaxRate
      lineNumber++
      lines.push({
        description: `Expense: ${exp.merchant || exp.category}${exp.description ? ' - ' + exp.description : ''}`,
        quantity: 1,
        unit: 'flat',
        unit_price: exp.amount,
        tax_rate: expTaxRate,
        subtotal: exp.amount,
        tax_amount: exp.tax_amount,
        total: exp.amount + exp.tax_amount,
        time_entry_ids: null,
        expense_ids: [exp.id],
        project_id: exp.project_id,
      })
    })
  }

  // Calculate totals
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
  const taxAmount = lines.reduce((sum, line) => sum + line.tax_amount, 0)
  const total = subtotal + taxAmount

  // Build tax breakdown
  const taxBreakdown: Record<string, number> = {}
  lines.forEach((line) => {
    if (line.tax_amount > 0) {
      taxBreakdown[line.tax_rate] = (taxBreakdown[line.tax_rate] || 0) + line.tax_amount
    }
  })

  // Determine document-level project_id (if all lines belong to the same project)
  const uniqueProjectIds = [...new Set(lines.map((line) => line.project_id).filter(Boolean))]
  const documentProjectId = uniqueProjectIds.length === 1 ? uniqueProjectIds[0] : null

  // Create document
  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
      company_id: membership.company_id,
      customer_id: input.customer_id,
      project_id: documentProjectId,
      document_type: 'invoice',
      status: 'draft',
      payment_terms_days: input.payment_terms_days || customer.payment_terms_days,
      notes: input.notes || null,
      internal_notes: input.internal_notes || null,
      subtotal,
      tax_amount: taxAmount,
      total,
      tax_breakdown: Object.keys(taxBreakdown).length > 0 ? taxBreakdown : null,
      currency: customer.currency || 'EUR',
    })
    .select()
    .single()

  if (docError) {
    console.error('Error creating document:', docError)
    return { success: false, error: docError.message }
  }

  // Create document lines
  const linesWithDocId = lines.map((line, index) => ({
    document_id: document.id,
    line_number: index + 1,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
    tax_rate: line.tax_rate,
    subtotal: line.subtotal,
    tax_amount: line.tax_amount,
    total: line.total,
    time_entry_ids: line.time_entry_ids,
    expense_ids: line.expense_ids,
    project_id: line.project_id,
  }))

  const { error: linesError } = await supabase
    .from('document_lines')
    .insert(linesWithDocId)

  if (linesError) {
    console.error('Error creating document lines:', linesError)
    await supabase.from('documents').delete().eq('id', document.id)
    return { success: false, error: linesError.message }
  }

  // Mark time entries as linked to this document
  if (input.time_entry_ids.length > 0) {
    await supabase
      .from('time_entries')
      .update({ document_id: document.id })
      .in('id', input.time_entry_ids)
  }

  revalidatePath('/documents')
  revalidatePath('/timesheets')
  return { success: true, data: document as Document }
}

// Get summary of unbilled items for a customer
export async function getCustomerUnbilledSummary(customerId: string): Promise<{
  totalHours: number
  totalTimeValue: number
  totalExpenses: number
  projectCount: number
}> {
  const [timeEntries, expenses] = await Promise.all([
    getUnbilledTimeEntries(customerId),
    getUnbilledExpenses(customerId),
  ])

  const projects = new Set(timeEntries.map((e) => e.project_id))
  expenses.forEach((e) => {
    if (e.project_id) projects.add(e.project_id)
  })

  return {
    totalHours: timeEntries.reduce((sum, e) => sum + e.hours, 0),
    totalTimeValue: timeEntries.reduce((sum, e) => sum + (e.hours * (e.hourly_rate || 0)), 0),
    totalExpenses: expenses.reduce((sum, e) => sum + e.amount + e.tax_amount, 0),
    projectCount: projects.size,
  }
}

// Get unbilled items for a specific project and month
export async function getUnbilledItemsForProjectMonth(
  projectId: string,
  yearMonth: string
): Promise<{
  timeEntries: UnbilledTimeEntry[]
  expenses: UnbilledExpense[]
  summary: {
    totalHours: number
    totalTimeValue: number
    totalExpenses: number
    estimatedTotal: number
  }
}> {
  const supabase = await createClient()

  // Parse month range
  const [year, month] = yearMonth.split('-').map(Number)
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Fetch time entries for the project and month
  const { data: timeData } = await supabase
    .from('time_entries')
    .select(`
      id, project_id, date, hours, description, hourly_rate, is_billable,
      project:projects(name, code, hourly_rate, customer_id, customer:customers(id, name))
    `)
    .eq('project_id', projectId)
    .eq('status', 'approved')
    .eq('is_billable', true)
    .is('document_id', null)
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .order('date', { ascending: false })

  // Fetch expenses for the project and month
  const { data: expenseData } = await supabase
    .from('expenses')
    .select(`
      id, project_id, date, amount, tax_rate, tax_amount, category, description, merchant, is_reimbursable,
      project:projects(name, code, customer_id, customer:customers(id, name))
    `)
    .eq('project_id', projectId)
    .eq('status', 'approved')
    .eq('is_reimbursable', true)
    .is('export_id', null)
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .order('date', { ascending: false })

  const timeEntries: UnbilledTimeEntry[] = (timeData || []).map((entry: any) => ({
    id: entry.id,
    project_id: entry.project_id,
    project_name: entry.project?.name || 'Unknown',
    project_code: entry.project?.code || '',
    customer_id: entry.project?.customer?.id || '',
    customer_name: entry.project?.customer?.name || 'Unknown',
    date: entry.date,
    hours: entry.hours,
    description: entry.description,
    hourly_rate: entry.hourly_rate || entry.project?.hourly_rate || 0,
    is_billable: entry.is_billable,
  }))

  const expenses: UnbilledExpense[] = (expenseData || []).map((exp: any) => ({
    id: exp.id,
    project_id: exp.project_id,
    project_name: exp.project?.name || null,
    project_code: exp.project?.code || null,
    customer_id: exp.project?.customer?.id || null,
    customer_name: exp.project?.customer?.name || null,
    date: exp.date,
    amount: exp.amount,
    tax_rate: exp.tax_rate,
    tax_amount: exp.tax_amount,
    category: exp.category,
    description: exp.description,
    merchant: exp.merchant,
    is_reimbursable: exp.is_reimbursable,
  }))

  // Calculate summary
  const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0)
  const totalTimeValue = timeEntries.reduce((sum, e) => sum + (e.hours * (e.hourly_rate || 0)), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount + e.tax_amount, 0)

  return {
    timeEntries,
    expenses,
    summary: {
      totalHours,
      totalTimeValue,
      totalExpenses,
      estimatedTotal: totalTimeValue + totalExpenses,
    },
  }
}

// Get projects with unbilled items for quick invoice dropdown
export async function getProjectsWithUnbilledItems(): Promise<{
  value: string
  label: string
  code: string
  customerId: string
  customerName: string
  unbilledHours: number
  unbilledExpenseCount: number
  unbilledMonths: string[]
}[]> {
  const supabase = await createClient()

  // Get all projects with unbilled time entries
  const { data: timeData } = await supabase
    .from('time_entries')
    .select(`
      project_id, date, hours,
      project:projects(id, name, code, customer:customers(id, name))
    `)
    .eq('status', 'approved')
    .eq('is_billable', true)
    .is('document_id', null)

  // Get all projects with unbilled expenses
  const { data: expenseData } = await supabase
    .from('expenses')
    .select(`
      project_id, date,
      project:projects(id, name, code, customer:customers(id, name))
    `)
    .eq('status', 'approved')
    .eq('is_reimbursable', true)
    .is('export_id', null)
    .not('project_id', 'is', null)

  // Aggregate by project
  const projectMap = new Map<string, {
    project: any
    hours: number
    expenseCount: number
    months: Set<string>
  }>()

  ;(timeData || []).forEach((entry: any) => {
    if (!entry.project_id || !entry.project) return
    const key = entry.project_id
    if (!projectMap.has(key)) {
      projectMap.set(key, {
        project: entry.project,
        hours: 0,
        expenseCount: 0,
        months: new Set(),
      })
    }
    const data = projectMap.get(key)!
    data.hours += entry.hours || 0
    data.months.add(entry.date.substring(0, 7))
  })

  ;(expenseData || []).forEach((exp: any) => {
    if (!exp.project_id || !exp.project) return
    const key = exp.project_id
    if (!projectMap.has(key)) {
      projectMap.set(key, {
        project: exp.project,
        hours: 0,
        expenseCount: 0,
        months: new Set(),
      })
    }
    const data = projectMap.get(key)!
    data.expenseCount++
    data.months.add(exp.date.substring(0, 7))
  })

  // Convert to array and sort by hours (most work first)
  return Array.from(projectMap.entries())
    .map(([projectId, data]) => ({
      value: projectId,
      label: `${data.project.name} (${data.project.code})`,
      code: data.project.code || '',
      customerId: data.project.customer?.id || '',
      customerName: data.project.customer?.name || 'Unknown',
      unbilledHours: Math.round(data.hours * 100) / 100,
      unbilledExpenseCount: data.expenseCount,
      unbilledMonths: Array.from(data.months).sort((a, b) => b.localeCompare(a)),
    }))
    .sort((a, b) => b.unbilledHours - a.unbilledHours)
}

// Create invoice for a specific project and month
export interface InvoiceForProjectMonthInput {
  project_id: string
  year_month: string
  include_time_entries?: boolean
  include_expenses?: boolean
  payment_terms_days?: number
  notes?: string | null
  group_by?: 'project' | 'entry' | 'summary'
}

export async function createInvoiceForProjectMonth(
  input: InvoiceForProjectMonthInput
): Promise<ActionResult<Document>> {
  const {
    project_id,
    year_month,
    include_time_entries = true,
    include_expenses = true,
    payment_terms_days,
    notes,
    group_by = 'project',
  } = input

  // Get unbilled items for this project and month
  const { timeEntries, expenses } = await getUnbilledItemsForProjectMonth(project_id, year_month)

  // Get customer from project
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('customer_id')
    .eq('id', project_id)
    .single()

  if (!project?.customer_id) {
    return { success: false, error: 'Project has no customer assigned' }
  }

  // Build the input for createInvoiceFromEntries
  const createInput: InvoiceFromEntriesInput = {
    customer_id: project.customer_id,
    time_entry_ids: include_time_entries ? timeEntries.map(e => e.id) : [],
    expense_ids: include_expenses ? expenses.map(e => e.id) : [],
    payment_terms_days,
    notes,
    group_by,
  }

  return createInvoiceFromEntries(createInput)
}
