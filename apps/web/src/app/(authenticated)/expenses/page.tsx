import Link from 'next/link'
import { Plus, Receipt, Calendar, Building2 } from 'lucide-react'
import { Button, Card, Badge, EmptyState } from '@/components/ui'
import { getMyExpenses } from '@/app/actions/expenses'
import { expenseCategories } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import { ExpenseActions } from './expense-actions'

interface ExpensesPageProps {
  searchParams: Promise<{
    page?: string
    status?: string
    category?: string
    from?: string
    to?: string
  }>
}

const statusColors: Record<string, 'secondary' | 'info' | 'success' | 'danger' | 'warning'> = {
  draft: 'secondary',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  exported: 'warning',
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const status = params.status as any
  const category = params.category as any

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user?.id)
    .eq('is_active', true)
    .maybeSingle()

  const isAdmin = membership?.role === 'superadmin'

  const { data: expenses, total, totalPages } = await getMyExpenses({
    page,
    status,
    category,
    limit: 50,
  })

  const formatCurrency = (amount: number, currency = 'EUR') =>
    new Intl.NumberFormat('de-AT', { style: 'currency', currency }).format(amount)

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))

  const getCategoryLabel = (cat: string) =>
    expenseCategories.find((c) => c.value === cat)?.label || cat

  // Calculate totals
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
  const pendingAmount = expenses
    .filter((e) => e.status === 'draft' || e.status === 'submitted')
    .reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="text-text-secondary mt-1">
            {formatCurrency(totalAmount)} total • {formatCurrency(pendingAmount)} pending
          </p>
        </div>
        <Link href="/expenses/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/expenses"
          className={`px-3 py-1 rounded-md transition-colors ${!status ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
        >
          All
        </Link>
        <Link
          href="/expenses?status=draft"
          className={`px-3 py-1 rounded-md transition-colors ${status === 'draft' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
        >
          Draft
        </Link>
        <Link
          href="/expenses?status=submitted"
          className={`px-3 py-1 rounded-md transition-colors ${status === 'submitted' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
        >
          Submitted
        </Link>
        <Link
          href="/expenses?status=approved"
          className={`px-3 py-1 rounded-md transition-colors ${status === 'approved' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
        >
          Approved
        </Link>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses found"
          description="Track your business expenses by adding your first expense"
          action={
            <Link href="/expenses/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-sm font-medium text-text-secondary">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.map((expense: any) => (
                    <tr key={expense.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-text-muted" />
                          {formatDate(expense.date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {getCategoryLabel(expense.category)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs truncate">
                          {expense.description || '-'}
                        </div>
                        {expense.merchant && (
                          <div className="text-xs text-text-muted">{expense.merchant}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {expense.project ? (
                          <Link
                            href={`/projects/${expense.project_id}`}
                            className="flex items-center gap-1.5 text-sm hover:text-primary"
                          >
                            <Building2 className="h-3.5 w-3.5 text-text-muted" />
                            {expense.project.name}
                          </Link>
                        ) : (
                          <span className="text-text-muted text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium">
                          {formatCurrency(expense.amount, expense.currency)}
                        </div>
                        {expense.tax_amount > 0 && (
                          <div className="text-xs text-text-muted">
                            incl. {formatCurrency(expense.tax_amount)} tax
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusColors[expense.status]}>
                          {expense.status}
                        </Badge>
                        {expense.is_reimbursable && (
                          <Badge variant="info" className="ml-1 text-xs">
                            Reimb.
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ExpenseActions expense={expense} isAdmin={isAdmin} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total} expenses
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link href={`/expenses?page=${page - 1}${status ? `&status=${status}` : ''}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/expenses?page=${page + 1}${status ? `&status=${status}` : ''}`}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
