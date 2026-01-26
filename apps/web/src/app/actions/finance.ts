'use server'

import { createClient } from '@/lib/supabase/server'
import { addDays, addWeeks, startOfWeek, endOfWeek, format, differenceInDays, startOfMonth, endOfMonth } from 'date-fns'
import { revalidatePath } from 'next/cache'
import JSZip from 'jszip'
import { generateInvoicePDF, type InvoiceData } from '@/lib/pdf/invoice-generator'

interface CompanyMembership {
  company_id: string
  role: string
}

export interface FinancialSummary {
  // Current position
  accountsReceivable: number // Unpaid invoices
  accountsPayable: number // Pending expense reimbursements
  overdueAR: number // Overdue invoices

  // Invoices breakdown
  invoicesByAge: {
    current: number // Not yet due
    days1to30: number
    days31to60: number
    days61plus: number
  }

  // Monthly data
  revenueThisMonth: number
  expensesThisMonth: number

  // Forecast data points
  forecast: ForecastDataPoint[]

  // Recent transactions
  recentInvoices: InvoiceSummary[]
  pendingExpenses: ExpenseSummary[]
}

export interface ForecastDataPoint {
  date: string
  week: string
  expectedInflow: number // Expected invoice payments
  expectedOutflow: number // Expected expense reimbursements + recurring
  cumulativeBalance: number
  invoicesDue: number
}

export interface InvoiceSummary {
  id: string
  documentNumber: string | null
  customerName: string
  total: number
  dueDate: string | null
  daysOverdue: number
  status: string
}

export interface ExpenseSummary {
  id: string
  category: string
  amount: number
  description: string | null
  date: string
  userName: string
}

export interface RecurringCost {
  id: string
  name: string
  amount: number
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  dayOfMonth?: number
}

export async function getFinancialSummary(startingCashBalance: number = 0, recurringCosts: RecurringCost[] = []): Promise<{ data?: FinancialSummary; error?: string }> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company membership
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || (membership.role !== 'superadmin' && membership.role !== 'accountant')) {
    return { error: 'Access denied' }
  }

  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  // Fetch unpaid invoices (AR)
  const { data: unpaidInvoicesData } = await supabase
    .from('documents')
    .select(`
      id,
      document_number,
      total,
      due_date,
      issue_date,
      status,
      customer:customers(name)
    `)
    .eq('company_id', membership.company_id)
    .eq('document_type', 'invoice')
    .eq('status', 'issued')
    .order('due_date', { ascending: true })

  const unpaidInvoices = unpaidInvoicesData as { id: string; document_number: string | null; total: number; due_date: string | null; issue_date: string | null; status: string; customer: { name: string } | null }[] | null

  // Fetch paid invoices this month
  const { data: paidInvoicesData } = await supabase
    .from('documents')
    .select('total, paid_date')
    .eq('company_id', membership.company_id)
    .eq('document_type', 'invoice')
    .eq('status', 'paid')
    .gte('paid_date', startOfMonth.toISOString().split('T')[0])

  const paidInvoices = paidInvoicesData as { total: number; paid_date: string | null }[] | null

  // Fetch pending expense reimbursements (AP)
  const { data: pendingExpensesData } = await supabase
    .from('expenses')
    .select(`
      id,
      amount,
      category,
      description,
      date,
      profile:profiles(first_name, last_name, email)
    `)
    .eq('company_id', membership.company_id)
    .eq('status', 'approved')
    .eq('is_reimbursable', true)
    .is('reimbursed_at', null)
    .order('date', { ascending: false })

  const pendingExpenses = pendingExpensesData as { id: string; amount: number; category: string; description: string | null; date: string; profile: { first_name: string | null; last_name: string | null; email: string } | null }[] | null

  // Fetch expenses this month (all statuses except draft)
  const { data: monthExpensesData } = await supabase
    .from('expenses')
    .select('amount')
    .eq('company_id', membership.company_id)
    .neq('status', 'draft')
    .gte('date', startOfMonth.toISOString().split('T')[0])

  const monthExpenses = monthExpensesData as { amount: number }[] | null

  // Calculate AR totals and aging
  let accountsReceivable = 0
  let overdueAR = 0
  const invoicesByAge = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61plus: 0,
  }

  const recentInvoices: InvoiceSummary[] = []

  if (unpaidInvoices) {
    for (const inv of unpaidInvoices) {
      const total = Number(inv.total)
      accountsReceivable += total

      const dueDate = inv.due_date ? new Date(inv.due_date) : null
      const daysOverdue = dueDate ? differenceInDays(today, dueDate) : 0

      if (daysOverdue > 0) {
        overdueAR += total
        if (daysOverdue <= 30) {
          invoicesByAge.days1to30 += total
        } else if (daysOverdue <= 60) {
          invoicesByAge.days31to60 += total
        } else {
          invoicesByAge.days61plus += total
        }
      } else {
        invoicesByAge.current += total
      }

      recentInvoices.push({
        id: inv.id,
        documentNumber: inv.document_number,
        customerName: (inv.customer as any)?.name || 'Unknown',
        total,
        dueDate: inv.due_date,
        daysOverdue: Math.max(0, daysOverdue),
        status: inv.status,
      })
    }
  }

  // Calculate AP
  let accountsPayable = 0
  const expenseSummaries: ExpenseSummary[] = []

  if (pendingExpenses) {
    for (const exp of pendingExpenses) {
      const amount = Number(exp.amount)
      accountsPayable += amount

      const profile = exp.profile as any
      expenseSummaries.push({
        id: exp.id,
        category: exp.category,
        amount,
        description: exp.description,
        date: exp.date,
        userName: profile?.first_name || profile?.email || 'Unknown',
      })
    }
  }

  // Calculate monthly totals
  const revenueThisMonth = paidInvoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
  const expensesThisMonth = monthExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0

  // Generate 12-week forecast
  const forecast: ForecastDataPoint[] = []
  let cumulativeBalance = startingCashBalance

  for (let weekOffset = 0; weekOffset < 12; weekOffset++) {
    const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 })
    const weekEnd = endOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 })

    // Expected inflow: invoices due this week
    let expectedInflow = 0
    let invoicesDue = 0
    if (unpaidInvoices) {
      for (const inv of unpaidInvoices) {
        if (inv.due_date) {
          const dueDate = new Date(inv.due_date)
          if (dueDate >= weekStart && dueDate <= weekEnd) {
            expectedInflow += Number(inv.total)
            invoicesDue++
          }
        }
      }
    }

    // Expected outflow: recurring costs
    let expectedOutflow = 0
    for (const cost of recurringCosts) {
      if (cost.frequency === 'weekly') {
        expectedOutflow += cost.amount
      } else if (cost.frequency === 'monthly') {
        // Check if the day of month falls in this week
        const dayOfMonth = cost.dayOfMonth || 1
        for (let d = new Date(weekStart); d <= weekEnd; d = addDays(d, 1)) {
          if (d.getDate() === dayOfMonth) {
            expectedOutflow += cost.amount
            break
          }
        }
      }
    }

    // Add pending expense reimbursements to first week
    if (weekOffset === 0) {
      expectedOutflow += accountsPayable
    }

    cumulativeBalance += expectedInflow - expectedOutflow

    forecast.push({
      date: format(weekStart, 'yyyy-MM-dd'),
      week: `Week ${weekOffset + 1}`,
      expectedInflow,
      expectedOutflow,
      cumulativeBalance,
      invoicesDue,
    })
  }

  return {
    data: {
      accountsReceivable,
      accountsPayable,
      overdueAR,
      invoicesByAge,
      revenueThisMonth,
      expensesThisMonth,
      forecast,
      recentInvoices: recentInvoices.slice(0, 10),
      pendingExpenses: expenseSummaries.slice(0, 10),
    },
  }
}

// Accounting Export Functions

export interface ExportPreview {
  periodStart: string
  periodEnd: string
  invoices: Array<{
    id: string
    documentNumber: string
    customerName: string
    total: number
    issueDate: string
    status: string
  }>
  creditNotes: Array<{
    id: string
    documentNumber: string
    customerName: string
    total: number
    issueDate: string
  }>
  expenses: Array<{
    id: string
    category: string
    amount: number
    date: string
    merchant: string | null
    userName: string
  }>
  totalRevenue: number
  totalExpenses: number
}

export async function getExportPreview(year: number, month: number): Promise<{ data?: ExportPreview; error?: string }> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company membership
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || (membership.role !== 'superadmin' && membership.role !== 'accountant')) {
    return { error: 'Access denied' }
  }

  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = endOfMonth(periodStart)

  const periodStartStr = format(periodStart, 'yyyy-MM-dd')
  const periodEndStr = format(periodEnd, 'yyyy-MM-dd')

  // Fetch invoices
  const { data: invoicesData } = await supabase
    .from('documents')
    .select(`
      id,
      document_number,
      total,
      issue_date,
      status,
      customer:customers(name)
    `)
    .eq('company_id', membership.company_id)
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', periodStartStr)
    .lte('issue_date', periodEndStr)
    .order('issue_date')

  // Fetch credit notes
  const { data: creditNotesData } = await supabase
    .from('documents')
    .select(`
      id,
      document_number,
      total,
      issue_date,
      customer:customers(name)
    `)
    .eq('company_id', membership.company_id)
    .eq('document_type', 'credit_note')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', periodStartStr)
    .lte('issue_date', periodEndStr)
    .order('issue_date')

  // Fetch approved expenses
  const { data: expensesData } = await supabase
    .from('expenses')
    .select(`
      id,
      amount,
      category,
      date,
      merchant,
      profile:profiles(first_name, last_name, email)
    `)
    .eq('company_id', membership.company_id)
    .eq('status', 'approved')
    .gte('date', periodStartStr)
    .lte('date', periodEndStr)
    .order('date')

  const invoices = (invoicesData || []).map((inv: any) => ({
    id: inv.id,
    documentNumber: inv.document_number || 'N/A',
    customerName: inv.customer?.name || 'Unknown',
    total: Number(inv.total),
    issueDate: inv.issue_date,
    status: inv.status,
  }))

  const creditNotes = (creditNotesData || []).map((cn: any) => ({
    id: cn.id,
    documentNumber: cn.document_number || 'N/A',
    customerName: cn.customer?.name || 'Unknown',
    total: Number(cn.total),
    issueDate: cn.issue_date,
  }))

  const expenses = (expensesData || []).map((exp: any) => ({
    id: exp.id,
    category: exp.category,
    amount: Number(exp.amount),
    date: exp.date,
    merchant: exp.merchant,
    userName: exp.profile?.first_name || exp.profile?.email || 'Unknown',
  }))

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0) -
                       creditNotes.reduce((sum, cn) => sum + cn.total, 0)
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)

  return {
    data: {
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      invoices,
      creditNotes,
      expenses,
      totalRevenue,
      totalExpenses,
    },
  }
}

export async function createAccountingExport(
  year: number,
  month: number,
  name: string,
  description?: string
): Promise<{ data?: { id: string; csvContent: string }; error?: string }> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company membership
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || (membership.role !== 'superadmin' && membership.role !== 'accountant')) {
    return { error: 'Access denied' }
  }

  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = endOfMonth(periodStart)

  const periodStartStr = format(periodStart, 'yyyy-MM-dd')
  const periodEndStr = format(periodEnd, 'yyyy-MM-dd')

  // Check for existing export for this period
  const { data: existingExport } = await supabase
    .from('accounting_exports')
    .select('id')
    .eq('company_id', membership.company_id)
    .eq('period_start', periodStartStr)
    .eq('period_end', periodEndStr)
    .single()

  if (existingExport) {
    return { error: 'An export for this period already exists' }
  }

  // Get preview data
  const previewResult = await getExportPreview(year, month)
  if (previewResult.error || !previewResult.data) {
    return { error: previewResult.error || 'Failed to get export data' }
  }

  const preview = previewResult.data

  // Create CSV content
  const csvLines: string[] = []
  csvLines.push('Type,Document Number,Date,Customer/Vendor,Category,Amount (EUR),Tax Rate,Tax Amount,Status')

  // Add invoices
  for (const inv of preview.invoices) {
    csvLines.push(`Invoice,${inv.documentNumber},${inv.issueDate},"${inv.customerName}",,${inv.total.toFixed(2)},,,${inv.status}`)
  }

  // Add credit notes
  for (const cn of preview.creditNotes) {
    csvLines.push(`Credit Note,${cn.documentNumber},${cn.issueDate},"${cn.customerName}",,-${cn.total.toFixed(2)},,,issued`)
  }

  // Add expenses
  for (const exp of preview.expenses) {
    csvLines.push(`Expense,,${exp.date},"${exp.merchant || exp.userName}",${exp.category},${exp.amount.toFixed(2)},,,approved`)
  }

  // Add summary
  csvLines.push('')
  csvLines.push('SUMMARY')
  csvLines.push(`Total Revenue,,,,,"${preview.totalRevenue.toFixed(2)}"`)
  csvLines.push(`Total Expenses,,,,,"${preview.totalExpenses.toFixed(2)}"`)
  csvLines.push(`Net,,,,,"${(preview.totalRevenue - preview.totalExpenses).toFixed(2)}"`)

  const csvContent = csvLines.join('\n')

  // Create the export record
  const { data: exportRecord, error: insertError } = await supabase
    .from('accounting_exports')
    .insert({
      company_id: membership.company_id,
      name,
      description,
      period_start: periodStartStr,
      period_end: periodEndStr,
      status: 'completed',
      created_by: user.id,
      completed_at: new Date().toISOString(),
      invoice_count: preview.invoices.length,
      credit_note_count: preview.creditNotes.length,
      expense_count: preview.expenses.length,
      total_revenue: preview.totalRevenue,
      total_expenses: preview.totalExpenses,
    } as never)
    .select()
    .single()

  if (insertError) {
    console.error('Error creating export:', insertError)
    return { error: insertError.message }
  }

  // Mark expenses as exported
  const expenseIds = preview.expenses.map(e => e.id)
  if (expenseIds.length > 0) {
    await supabase
      .from('expenses')
      .update({
        status: 'exported',
        exported_at: new Date().toISOString(),
        export_id: (exportRecord as any).id,
      } as never)
      .in('id', expenseIds)
  }

  revalidatePath('/accounting-export')
  revalidatePath('/expenses')

  return {
    data: {
      id: (exportRecord as any).id,
      csvContent,
    },
  }
}

export async function downloadExportPackage(exportId: string): Promise<{ data?: { base64: string; filename: string }; error?: string }> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company membership
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || (membership.role !== 'superadmin' && membership.role !== 'accountant')) {
    return { error: 'Access denied' }
  }

  // Get export details
  const { data: exportRecord } = await supabase
    .from('accounting_exports')
    .select('*')
    .eq('id', exportId)
    .eq('company_id', membership.company_id)
    .single()

  if (!exportRecord) {
    return { error: 'Export not found' }
  }

  const exp = exportRecord as any
  const year = new Date(exp.period_start).getFullYear()
  const month = new Date(exp.period_start).getMonth() + 1

  // Regenerate CSV
  const previewResult = await getExportPreview(year, month)
  if (previewResult.error || !previewResult.data) {
    return { error: previewResult.error || 'Failed to get export data' }
  }

  const preview = previewResult.data

  // Create ZIP file
  const zip = new JSZip()

  // Add CSV
  const csvLines: string[] = []
  csvLines.push('Type,Document Number,Date,Customer/Vendor,Category,Amount (EUR),Tax Rate,Tax Amount,Status')

  for (const inv of preview.invoices) {
    csvLines.push(`Invoice,${inv.documentNumber},${inv.issueDate},"${inv.customerName}",,${inv.total.toFixed(2)},,,${inv.status}`)
  }

  for (const cn of preview.creditNotes) {
    csvLines.push(`Credit Note,${cn.documentNumber},${cn.issueDate},"${cn.customerName}",,-${cn.total.toFixed(2)},,,issued`)
  }

  for (const expense of preview.expenses) {
    csvLines.push(`Expense,,${expense.date},"${expense.merchant || expense.userName}",${expense.category},${expense.amount.toFixed(2)},,,approved`)
  }

  csvLines.push('')
  csvLines.push('SUMMARY')
  csvLines.push(`Total Revenue,,,,,"${preview.totalRevenue.toFixed(2)}"`)
  csvLines.push(`Total Expenses,,,,,"${preview.totalExpenses.toFixed(2)}"`)
  csvLines.push(`Net,,,,,"${(preview.totalRevenue - preview.totalExpenses).toFixed(2)}"`)

  zip.file('export_summary.csv', csvLines.join('\n'))

  // Generate PDFs for invoices
  const invoicesFolder = zip.folder('invoices')

  // Get full document details for PDF generation
  for (const inv of preview.invoices) {
    try {
      const { data: document } = await supabase
        .from('documents')
        .select(`
          *,
          customer:customers(*),
          lines:document_lines(*)
        `)
        .eq('id', inv.id)
        .single()

      if (document) {
        const { data: company } = await supabase
          .from('companies')
          .select('*')
          .eq('id', membership.company_id)
          .single()

        if (company) {
          const invoiceData: InvoiceData = {
            documentNumber: (document as any).document_number || 'DRAFT',
            documentType: 'invoice',
            issueDate: (document as any).issue_date || new Date().toISOString().split('T')[0],
            dueDate: (document as any).due_date || new Date().toISOString().split('T')[0],
            status: (document as any).status,
            company: {
              name: (company as any).name,
              legalName: (company as any).legal_name || undefined,
              vatNumber: (company as any).vat_number || undefined,
              registrationNumber: (company as any).registration_number || undefined,
              addressLine1: (company as any).address_line1 || undefined,
              postalCode: (company as any).postal_code || undefined,
              city: (company as any).city || undefined,
              country: (company as any).country || undefined,
            },
            customer: {
              name: ((document as any).customer as any)?.name || 'Unknown',
              vatNumber: ((document as any).customer as any)?.vat_number || undefined,
              addressLine1: ((document as any).customer as any)?.address_line1 || undefined,
              postalCode: ((document as any).customer as any)?.postal_code || undefined,
              city: ((document as any).customer as any)?.city || undefined,
              country: ((document as any).customer as any)?.country || undefined,
            },
            lines: (((document as any).lines as any[]) || []).map((l: any) => ({
              lineNumber: l.line_number,
              description: l.description,
              quantity: l.quantity,
              unit: l.unit,
              unitPrice: l.unit_price,
              taxRate: l.tax_rate,
              subtotal: l.subtotal,
              taxAmount: l.tax_amount || 0,
              total: l.total || l.subtotal,
            })),
            subtotal: (document as any).subtotal,
            taxAmount: (document as any).tax_amount,
            total: (document as any).total,
            currency: (document as any).currency,
            taxBreakdown: (document as any).tax_breakdown || {},
            notes: (document as any).notes || undefined,
          }

          const pdfBuffer = await generateInvoicePDF(invoiceData)
          invoicesFolder?.file(`${inv.documentNumber}.pdf`, pdfBuffer)
        }
      }
    } catch (err) {
      console.error(`Error generating PDF for invoice ${inv.id}:`, err)
    }
  }

  // Generate ZIP
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  const base64 = zipBuffer.toString('base64')

  const monthName = format(new Date(exp.period_start), 'MMMM_yyyy')

  return {
    data: {
      base64,
      filename: `accounting_export_${monthName}.zip`,
    },
  }
}
