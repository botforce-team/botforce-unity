'use server'

import { createClient } from '@/lib/supabase/server'

export interface FinanceOverview {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  outstandingInvoices: number
  overdueInvoices: number
  overdueAmount: number
  paidThisMonth: number
  pendingExpenses: number
}

export interface MonthlyData {
  month: string
  revenue: number
  expenses: number
}

export interface RevenueByCustomer {
  customerId: string
  customerName: string
  revenue: number
  invoiceCount: number
}

export interface ExpensesByCategory {
  category: string
  amount: number
  count: number
}

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const supabase = await createClient()

  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  // Get revenue from paid invoices
  const { data: paidInvoices } = await supabase
    .from('documents')
    .select('total')
    .eq('document_type', 'invoice')
    .eq('status', 'paid')

  const totalRevenue = paidInvoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

  // Get paid this month
  const { data: paidThisMonthData } = await supabase
    .from('documents')
    .select('total')
    .eq('document_type', 'invoice')
    .eq('status', 'paid')
    .gte('paid_date', startOfMonth)
    .lte('paid_date', endOfMonth)

  const paidThisMonth = paidThisMonthData?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

  // Get outstanding invoices
  const { data: outstandingData } = await supabase
    .from('documents')
    .select('total, due_date')
    .eq('document_type', 'invoice')
    .eq('status', 'issued')

  const outstandingInvoices = outstandingData?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

  // Calculate overdue
  const overdueData = outstandingData?.filter(
    (inv) => inv.due_date && new Date(inv.due_date) < today
  ) || []
  const overdueInvoices = overdueData.length
  const overdueAmount = overdueData.reduce((sum, inv) => sum + (inv.total || 0), 0)

  // Get total expenses (approved)
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('status', 'approved')

  const totalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0

  // Get pending expenses
  const { data: pendingExpensesData } = await supabase
    .from('expenses')
    .select('amount')
    .in('status', ['draft', 'submitted'])

  const pendingExpenses = pendingExpensesData?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0

  return {
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    outstandingInvoices,
    overdueInvoices,
    overdueAmount,
    paidThisMonth,
    pendingExpenses,
  }
}

export async function getMonthlyRevenue(months: number = 12): Promise<MonthlyData[]> {
  const supabase = await createClient()

  const today = new Date()
  const startDate = new Date(today.getFullYear(), today.getMonth() - months + 1, 1)

  // Get all paid invoices in the period
  const { data: invoices } = await supabase
    .from('documents')
    .select('total, paid_date')
    .eq('document_type', 'invoice')
    .eq('status', 'paid')
    .gte('paid_date', startDate.toISOString().split('T')[0])
    .order('paid_date')

  // Get all approved expenses in the period
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, date')
    .eq('status', 'approved')
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date')

  // Group by month
  const monthlyMap = new Map<string, { revenue: number; expenses: number }>()

  // Initialize all months
  for (let i = 0; i < months; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - months + 1 + i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthlyMap.set(key, { revenue: 0, expenses: 0 })
  }

  // Add revenue
  invoices?.forEach((inv) => {
    if (inv.paid_date) {
      const date = new Date(inv.paid_date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const existing = monthlyMap.get(key)
      if (existing) {
        existing.revenue += inv.total || 0
      }
    }
  })

  // Add expenses
  expenses?.forEach((exp) => {
    if (exp.date) {
      const date = new Date(exp.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const existing = monthlyMap.get(key)
      if (existing) {
        existing.expenses += exp.amount || 0
      }
    }
  })

  // Convert to array
  return Array.from(monthlyMap.entries()).map(([month, data]) => ({
    month,
    revenue: data.revenue,
    expenses: data.expenses,
  }))
}

export async function getRevenueByCustomer(limit: number = 10): Promise<RevenueByCustomer[]> {
  const supabase = await createClient()

  // Get paid invoices with customer info
  const { data: invoices } = await supabase
    .from('documents')
    .select('total, customer_id, customer:customers(name)')
    .eq('document_type', 'invoice')
    .eq('status', 'paid')

  // Group by customer
  const customerMap = new Map<string, { name: string; revenue: number; count: number }>()

  invoices?.forEach((inv: any) => {
    if (inv.customer_id) {
      const existing = customerMap.get(inv.customer_id)
      if (existing) {
        existing.revenue += inv.total || 0
        existing.count += 1
      } else {
        customerMap.set(inv.customer_id, {
          name: inv.customer?.name || 'Unknown',
          revenue: inv.total || 0,
          count: 1,
        })
      }
    }
  })

  // Convert to array and sort by revenue
  return Array.from(customerMap.entries())
    .map(([customerId, data]) => ({
      customerId,
      customerName: data.name,
      revenue: data.revenue,
      invoiceCount: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

export async function getExpensesByCategory(): Promise<ExpensesByCategory[]> {
  const supabase = await createClient()

  const { data: expenses } = await supabase
    .from('expenses')
    .select('category, amount')
    .eq('status', 'approved')

  // Group by category
  const categoryMap = new Map<string, { amount: number; count: number }>()

  expenses?.forEach((exp) => {
    const existing = categoryMap.get(exp.category)
    if (existing) {
      existing.amount += exp.amount || 0
      existing.count += 1
    } else {
      categoryMap.set(exp.category, {
        amount: exp.amount || 0,
        count: 1,
      })
    }
  })

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount)
}

// Cash forecast - 12 weeks projection
export interface CashForecastWeek {
  weekStart: string
  weekEnd: string
  weekLabel: string
  expectedIncome: number
  expectedExpenses: number
  netCashFlow: number
  cumulativeBalance: number
}

export async function getCashForecast(weeks: number = 12): Promise<CashForecastWeek[]> {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get current outstanding invoices (expected income)
  const { data: outstandingInvoices } = await supabase
    .from('documents')
    .select('id, total, due_date')
    .eq('document_type', 'invoice')
    .eq('status', 'issued')

  // Get recurring invoice templates for future projections
  const { data: recurringTemplates } = await supabase
    .from('recurring_invoice_templates')
    .select('id, total, frequency, next_issue_date, payment_terms_days')
    .eq('is_active', true)

  // Get average weekly expenses from past 8 weeks
  const eightWeeksAgo = new Date(today)
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  const { data: recentExpenses } = await supabase
    .from('expenses')
    .select('amount, date')
    .eq('status', 'approved')
    .gte('date', eightWeeksAgo.toISOString().split('T')[0])

  const totalRecentExpenses = recentExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0
  const avgWeeklyExpenses = totalRecentExpenses / 8

  // Generate weekly forecast
  const forecast: CashForecastWeek[] = []
  let cumulativeBalance = 0

  // Get starting balance (current cash position)
  // For simplicity, we'll start from outstanding invoices minus pending expenses
  const { data: pendingExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .in('status', ['submitted', 'approved'])
    .is('reimbursed_at', null)
    .eq('is_reimbursable', true)

  const pendingExpenseTotal = pendingExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0
  cumulativeBalance = -pendingExpenseTotal // Start with pending obligations

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() + i * 7)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    let expectedIncome = 0

    // Add outstanding invoices due this week
    outstandingInvoices?.forEach((inv) => {
      if (inv.due_date) {
        const dueDate = new Date(inv.due_date)
        if (dueDate >= weekStart && dueDate <= weekEnd) {
          expectedIncome += inv.total || 0
        }
      }
    })

    // Add recurring invoices expected to be issued and paid
    recurringTemplates?.forEach((template: any) => {
      if (template.next_issue_date) {
        const issueDate = new Date(template.next_issue_date)
        const paymentDays = template.payment_terms_days || 14
        const expectedPayDate = new Date(issueDate)
        expectedPayDate.setDate(expectedPayDate.getDate() + paymentDays)

        if (expectedPayDate >= weekStart && expectedPayDate <= weekEnd) {
          expectedIncome += template.total || 0
        }
      }
    })

    const expectedExpenses = Math.round(avgWeeklyExpenses)
    const netCashFlow = expectedIncome - expectedExpenses
    cumulativeBalance += netCashFlow

    // Format week label
    const weekLabel = `W${i + 1} (${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`

    forecast.push({
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      weekLabel,
      expectedIncome,
      expectedExpenses,
      netCashFlow,
      cumulativeBalance,
    })
  }

  return forecast
}

export async function getRecentTransactions(limit: number = 10) {
  const supabase = await createClient()

  // Get recent paid invoices
  const { data: invoices } = await supabase
    .from('documents')
    .select('id, document_number, total, paid_date, customer:customers(name)')
    .eq('document_type', 'invoice')
    .eq('status', 'paid')
    .order('paid_date', { ascending: false })
    .limit(limit)

  // Get recent approved expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, amount, date, category, merchant')
    .eq('status', 'approved')
    .order('date', { ascending: false })
    .limit(limit)

  // Combine and sort
  const transactions: {
    id: string
    type: 'income' | 'expense'
    description: string
    amount: number
    date: string
  }[] = []

  invoices?.forEach((inv: any) => {
    transactions.push({
      id: inv.id,
      type: 'income',
      description: `Invoice ${inv.document_number} - ${inv.customer?.name}`,
      amount: inv.total || 0,
      date: inv.paid_date,
    })
  })

  expenses?.forEach((exp) => {
    transactions.push({
      id: exp.id,
      type: 'expense',
      description: exp.merchant || exp.category,
      amount: exp.amount || 0,
      date: exp.date,
    })
  })

  return transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
}
