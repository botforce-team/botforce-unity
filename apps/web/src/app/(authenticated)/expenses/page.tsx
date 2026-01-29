import Link from 'next/link'
import { Plus, Receipt, Calendar, Building2, FileText } from 'lucide-react'
import { Button, Card, Badge, EmptyState } from '@/components/ui'
import { getMyExpenses } from '@/app/actions/expenses'
import { getProjectsForSelect } from '@/app/actions/time-entries'
import { expenseCategories } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import { ExpenseActions } from './expense-actions'
import { ExpenseFilters } from './expense-filters'
import { getMonthYearDisplay, getYearMonthKey } from '@/lib/utils'

interface ExpensesPageProps {
  searchParams: Promise<{
    page?: string
    status?: string
    category?: string
    project?: string
    month?: string
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

const statusLabels: Record<string, string> = {
  draft: 'Entwurf',
  submitted: 'Eingereicht',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  exported: 'Exportiert',
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const status = params.status as any
  const category = params.category as any
  const projectId = params.project
  const yearMonth = params.month

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user?.id)
    .eq('is_active', true)
    .maybeSingle()

  const isAdmin = membership?.role === 'superadmin'

  // Fetch projects for filter dropdown
  const projects = await getProjectsForSelect()

  const { data: expenses, total, totalPages } = await getMyExpenses({
    page,
    status,
    category,
    projectId,
    yearMonth,
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

  // Group by month for summary
  const expensesByMonth = expenses.reduce((acc, expense) => {
    const monthKey = getYearMonthKey(expense.date)
    if (!acc[monthKey]) {
      acc[monthKey] = { total: 0, count: 0 }
    }
    acc[monthKey].total += expense.amount
    acc[monthKey].count++
    return acc
  }, {} as Record<string, { total: number; count: number }>)

  // Build URL helper
  const buildUrl = (newParams: Record<string, string | undefined>) => {
    const urlParams = new URLSearchParams()
    if (status && !('status' in newParams)) urlParams.set('status', status)
    if (projectId && !('project' in newParams)) urlParams.set('project', projectId)
    if (yearMonth && !('month' in newParams)) urlParams.set('month', yearMonth)
    Object.entries(newParams).forEach(([key, value]) => {
      if (value !== undefined) urlParams.set(key, value)
    })
    const query = urlParams.toString()
    return `/expenses${query ? `?${query}` : ''}`
  }

  // Check if we should show invoice creation hint
  const approvedExpensesForProject = projectId && yearMonth
    ? expenses.filter(e => e.status === 'approved').length
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ausgaben</h1>
          <p className="text-text-secondary mt-1">
            {formatCurrency(totalAmount)} gesamt
            {pendingAmount > 0 && ` • ${formatCurrency(pendingAmount)} ausstehend`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {approvedExpensesForProject > 0 && (
            <Link href={`/documents/new-from-project?project=${projectId}&month=${yearMonth}`}>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Rechnung erstellen
              </Button>
            </Link>
          )}
          <Link href="/expenses/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ausgabe hinzufügen
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <ExpenseFilters
        projects={projects}
        selectedProject={projectId}
        selectedMonth={yearMonth}
      />

      {/* Status Filters */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={buildUrl({ status: undefined })}
          className={`px-3 py-1 rounded-md transition-colors ${!status ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
        >
          Alle
        </Link>
        <Link
          href={buildUrl({ status: 'draft' })}
          className={`px-3 py-1 rounded-md transition-colors ${status === 'draft' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
        >
          Entwurf
        </Link>
        <Link
          href={buildUrl({ status: 'submitted' })}
          className={`px-3 py-1 rounded-md transition-colors ${status === 'submitted' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
        >
          Eingereicht
        </Link>
        <Link
          href={buildUrl({ status: 'approved' })}
          className={`px-3 py-1 rounded-md transition-colors ${status === 'approved' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
        >
          Genehmigt
        </Link>
      </div>

      {/* Monthly Summary (when filtering by project) */}
      {projectId && Object.keys(expensesByMonth).length > 1 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(expensesByMonth)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([month, data]) => (
              <Link
                key={month}
                href={buildUrl({ month })}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  yearMonth === month
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-surface border-border hover:border-primary'
                }`}
              >
                {getMonthYearDisplay(month)}
                <span className="ml-2 text-xs opacity-75">
                  {formatCurrency(data.total)}
                </span>
              </Link>
            ))}
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Keine Ausgaben gefunden"
          description={projectId || yearMonth
            ? "Keine Ausgaben für die ausgewählten Filter gefunden"
            : "Verfolge deine Geschäftsausgaben, indem du deine erste Ausgabe hinzufügst"
          }
          action={
            <Link href="/expenses/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Ausgabe hinzufügen
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
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3">Kategorie</th>
                    <th className="px-4 py-3">Beschreibung</th>
                    <th className="px-4 py-3">Projekt</th>
                    <th className="px-4 py-3 text-right">Betrag</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aktionen</th>
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
                            inkl. {formatCurrency(expense.tax_amount)} USt
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusColors[expense.status]}>
                          {statusLabels[expense.status] || expense.status}
                        </Badge>
                        {expense.is_reimbursable && (
                          <Badge variant="info" className="ml-1 text-xs">
                            Erstatt.
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
                Zeige {(page - 1) * 50 + 1} bis {Math.min(page * 50, total)} von {total} Ausgaben
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link href={buildUrl({ page: String(page - 1) })}>
                    <Button variant="outline" size="sm">
                      Zurück
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={buildUrl({ page: String(page + 1) })}>
                    <Button variant="outline" size="sm">
                      Weiter
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
