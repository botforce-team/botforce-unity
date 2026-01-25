'use server'

import { createClient } from '@/lib/supabase/server'
import { addDays, addWeeks, startOfWeek, endOfWeek, format, differenceInDays } from 'date-fns'

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
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || (membership.role !== 'superadmin' && membership.role !== 'accountant')) {
    return { error: 'Access denied' }
  }

  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  // Fetch unpaid invoices (AR)
  const { data: unpaidInvoices } = await supabase
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

  // Fetch paid invoices this month
  const { data: paidInvoices } = await supabase
    .from('documents')
    .select('total, paid_date')
    .eq('company_id', membership.company_id)
    .eq('document_type', 'invoice')
    .eq('status', 'paid')
    .gte('paid_date', startOfMonth.toISOString().split('T')[0])

  // Fetch pending expense reimbursements (AP)
  const { data: pendingExpenses } = await supabase
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

  // Fetch expenses this month (all statuses except draft)
  const { data: monthExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('company_id', membership.company_id)
    .neq('status', 'draft')
    .gte('date', startOfMonth.toISOString().split('T')[0])

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
