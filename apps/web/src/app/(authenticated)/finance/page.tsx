import Link from 'next/link'
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import {
  getFinanceOverview,
  getMonthlyRevenue,
  getRevenueByCustomer,
  getExpensesByCategory,
  getRecentTransactions,
  getCashForecast,
} from '@/app/actions/finance'
import {
  getRevolutConnection,
  getRevolutAccounts,
  getRevolutBalances,
  getRecentRevolutTransactions,
} from '@/app/actions/revolut'
import { formatCurrency, formatDate } from '@/lib/utils'
import { RevenueChart } from './revenue-chart'
import { CashFlowChart } from './cash-flow-chart'
import { RevolutBalanceCard } from '@/components/finance/revolut-balance-card'
import { RevolutTransactions } from '@/components/finance/revolut-transactions'

export default async function FinancePage() {
  const [
    overview,
    monthlyData,
    topCustomers,
    expensesByCategory,
    recentTransactions,
    cashForecast,
    revolutConnection,
    revolutAccounts,
    revolutBalances,
    revolutTransactions,
  ] = await Promise.all([
    getFinanceOverview(),
    getMonthlyRevenue(6),
    getRevenueByCustomer(5),
    getExpensesByCategory(),
    getRecentTransactions(8),
    getCashForecast(12),
    getRevolutConnection(),
    getRevolutAccounts(),
    getRevolutBalances(),
    getRecentRevolutTransactions(10),
  ])

  const isRevolutConnected = revolutConnection.data?.status === 'active'

  const categoryLabels: Record<string, string> = {
    mileage: 'Mileage',
    travel_time: 'Travel Time',
    materials: 'Materials',
    accommodation: 'Accommodation',
    meals: 'Meals',
    transport: 'Transport',
    communication: 'Communication',
    software: 'Software',
    other: 'Other',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Finance</h1>
        <p className="mt-1 text-text-secondary">
          Overview of your financial performance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Total Revenue</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(overview.totalRevenue)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
            <p className="mt-2 text-sm text-text-muted">
              {formatCurrency(overview.paidThisMonth)} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Total Expenses</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(overview.totalExpenses)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
                <TrendingDown className="h-6 w-6 text-danger" />
              </div>
            </div>
            <p className="mt-2 text-sm text-text-muted">
              {formatCurrency(overview.pendingExpenses)} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Net Income</p>
                <p className={`text-2xl font-bold ${overview.netIncome >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(overview.netIncome)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="mt-2 text-sm text-text-muted">
              Revenue minus expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Outstanding</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(overview.outstandingInvoices)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
            {overview.overdueInvoices > 0 ? (
              <p className="mt-2 text-sm text-danger flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overview.overdueInvoices} overdue ({formatCurrency(overview.overdueAmount)})
              </p>
            ) : (
              <p className="mt-2 text-sm text-success flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                No overdue invoices
              </p>
            )}
          </CardContent>
        </Card>

        {/* Bank Balance Card */}
        <RevolutBalanceCard
          accounts={revolutAccounts.data || []}
          balances={revolutBalances.data || {}}
          isConnected={isRevolutConnected}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={monthlyData} />
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-text-muted py-8 text-center">No revenue data yet</p>
            ) : (
              <div className="space-y-4">
                {topCustomers.map((customer, index) => {
                  const maxRevenue = topCustomers[0]?.revenue || 1
                  const percentage = (customer.revenue / maxRevenue) * 100
                  return (
                    <div key={customer.customerId}>
                      <div className="flex items-center justify-between mb-1">
                        <Link
                          href={`/customers/${customer.customerId}`}
                          className="text-sm font-medium text-text-primary hover:text-primary"
                        >
                          {customer.customerName}
                        </Link>
                        <span className="text-sm font-medium text-text-primary">
                          {formatCurrency(customer.revenue)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-hover">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        {customer.invoiceCount} {customer.invoiceCount === 1 ? 'invoice' : 'invoices'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cash Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>12-Week Cash Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={cashForecast} />
        </CardContent>
      </Card>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <p className="text-sm text-text-muted py-8 text-center">No expenses yet</p>
            ) : (
              <div className="space-y-3">
                {expensesByCategory.map((cat) => {
                  const maxAmount = expensesByCategory[0]?.amount || 1
                  const percentage = (cat.amount / maxAmount) * 100
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-text-primary">
                          {categoryLabels[cat.category] || cat.category}
                        </span>
                        <span className="text-sm font-medium text-text-primary">
                          {formatCurrency(cat.amount)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-hover">
                        <div
                          className="h-2 rounded-full bg-danger/70 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions (Invoices/Expenses) */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoice/Expense Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-text-muted py-8 text-center">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          tx.type === 'income' ? 'bg-success/10' : 'bg-danger/10'
                        }`}
                      >
                        {tx.type === 'income' ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-danger" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary truncate max-w-[200px]">
                          {tx.description}
                        </p>
                        <p className="text-xs text-text-muted">{formatDate(tx.date)}</p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        tx.type === 'income' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bank Transactions (from Revolut) */}
      {isRevolutConnected && (revolutTransactions.data?.length || 0) > 0 && (
        <RevolutTransactions
          transactions={revolutTransactions.data || []}
          total={revolutTransactions.data?.length || 0}
        />
      )}
    </div>
  )
}
