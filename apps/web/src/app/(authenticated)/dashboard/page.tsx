import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui'
import { Clock, FileText, Receipt, TrendingUp, Users, FolderOpen, Building2, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react'
import { OverdueInvoicesWidget } from '@/components/dashboard/overdue-invoices-widget'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user role
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user?.id)
    .eq('is_active', true)
    .maybeSingle()

  const role = membership?.role || 'employee'

  // Get this week's date range
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay() + 1) // Monday
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  // Get start of month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Fetch time entries for current user this week
  const { data: weeklyTimeEntries } = await supabase
    .from('time_entries')
    .select('hours')
    .eq('user_id', user?.id)
    .gte('date', startOfWeek.toISOString().split('T')[0])
    .lte('date', endOfWeek.toISOString().split('T')[0])

  const weeklyHours = weeklyTimeEntries?.reduce((sum, e) => sum + (e.hours || 0), 0) || 0

  // Fetch outstanding invoices (for admin/accountant)
  let outstandingInvoices = 0
  let outstandingAmount = 0
  let overdueInvoices: any[] = []
  if (role === 'superadmin' || role === 'accountant') {
    const { data: invoices } = await supabase
      .from('documents')
      .select('total')
      .eq('document_type', 'invoice')
      .eq('status', 'issued')

    outstandingInvoices = invoices?.length || 0
    outstandingAmount = invoices?.reduce((sum, d) => sum + (d.total || 0), 0) || 0

    // Get overdue invoices
    const today = new Date().toISOString().split('T')[0]
    const { data: overdue } = await supabase
      .from('documents')
      .select('id, document_number, total, due_date, customer:customers(name)')
      .eq('document_type', 'invoice')
      .eq('status', 'issued')
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(5)

    overdueInvoices = overdue || []
  }

  // Fetch pending expenses
  const { data: pendingExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('user_id', user?.id)
    .in('status', ['draft', 'submitted'])

  const pendingExpenseCount = pendingExpenses?.length || 0
  const pendingExpenseAmount = pendingExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

  // Fetch revenue this month (for admin/accountant)
  let monthlyRevenue = 0
  if (role === 'superadmin' || role === 'accountant') {
    const { data: paidInvoices } = await supabase
      .from('documents')
      .select('total')
      .eq('document_type', 'invoice')
      .eq('status', 'paid')
      .gte('paid_date', startOfMonth.toISOString().split('T')[0])

    monthlyRevenue = paidInvoices?.reduce((sum, d) => sum + (d.total || 0), 0) || 0
  }

  // Fetch counts for quick stats
  const { count: customerCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // Fetch recent time entries
  const { data: recentTimeEntries } = await supabase
    .from('time_entries')
    .select('id, date, hours, description, project:projects(name, code)')
    .eq('user_id', user?.id)
    .order('date', { ascending: false })
    .limit(5)

  // Fetch pending time entry approvals (for superadmin)
  let pendingApprovals: any[] = []
  let pendingExpenseApprovals: any[] = []
  if (role === 'superadmin') {
    const { data } = await supabase
      .from('time_entries')
      .select('id, date, hours, description, profile:profiles(full_name), project:projects(name)')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true })
      .limit(5)

    pendingApprovals = data || []

    // Fetch pending expense approvals
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, date, amount, category, description, profile:profiles(full_name)')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true })
      .limit(5)

    pendingExpenseApprovals = expenses || []
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount)

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit' }).format(new Date(date))

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">
          Welcome back
        </h2>
        <p className="text-text-secondary">
          Here&apos;s an overview of your business activity.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Hours This Week
            </CardTitle>
            <Clock className="h-4 w-4 text-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">{weeklyHours.toFixed(1)}</div>
            <p className="text-xs text-text-muted">
              {weeklyHours > 0 ? 'Keep up the great work!' : 'No time logged yet this week'}
            </p>
          </CardContent>
        </Card>

        {(role === 'superadmin' || role === 'accountant') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                Outstanding Invoices
              </CardTitle>
              <FileText className="h-4 w-4 text-text-muted" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text-primary">{outstandingInvoices}</div>
              <p className="text-xs text-text-muted">
                {outstandingAmount > 0 ? formatCurrency(outstandingAmount) + ' total' : 'All invoices paid'}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Pending Expenses
            </CardTitle>
            <Receipt className="h-4 w-4 text-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">{pendingExpenseCount}</div>
            <p className="text-xs text-text-muted">
              {pendingExpenseAmount > 0 ? formatCurrency(pendingExpenseAmount) + ' total' : 'No pending expenses'}
            </p>
          </CardContent>
        </Card>

        {(role === 'superadmin' || role === 'accountant') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                Revenue This Month
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-text-muted" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text-primary">{formatCurrency(monthlyRevenue)}</div>
              <p className="text-xs text-text-muted">
                {monthlyRevenue > 0 ? 'From paid invoices' : 'No revenue this month'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/customers">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Customers</p>
                    <p className="text-xl font-semibold">{customerCount || 0}</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-text-muted" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/projects">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-success/10 p-2">
                    <FolderOpen className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Active Projects</p>
                    <p className="text-xl font-semibold">{projectCount || 0}</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-text-muted" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/timesheets">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-warning/10 p-2">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Log Time</p>
                    <p className="text-xl font-semibold">Track hours</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-text-muted" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Overdue Invoices Alert */}
      {(role === 'superadmin' || role === 'accountant') && overdueInvoices.length > 0 && (
        <OverdueInvoicesWidget invoices={overdueInvoices} />
      )}

      {/* Recent activity and pending approvals */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Time Entries</CardTitle>
            <Link href="/timesheets">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentTimeEntries && recentTimeEntries.length > 0 ? (
              <div className="space-y-3">
                {recentTimeEntries.map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">
                        {(entry.project as any)?.name || 'Unknown Project'}
                      </p>
                      <p className="text-xs text-text-muted truncate max-w-[200px]">
                        {entry.description || 'No description'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{entry.hours}h</p>
                      <p className="text-xs text-text-muted">{formatDate(entry.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No recent time entries.</p>
            )}
          </CardContent>
        </Card>

        {role === 'superadmin' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pending Time Approvals</CardTitle>
              {pendingApprovals.length > 0 && (
                <Badge variant="warning">{pendingApprovals.length}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {pendingApprovals.length > 0 ? (
                <div className="space-y-3">
                  {pendingApprovals.map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium text-sm">{(entry.profile as any)?.full_name}</p>
                        <p className="text-xs text-text-muted">
                          {(entry.project as any)?.name} - {entry.hours}h
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-muted">{formatDate(entry.date)}</p>
                        <Badge variant="warning" className="text-xs">Pending</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <CheckCircle className="h-4 w-4 text-success" />
                  All time entries approved
                </div>
              )}
              <Link href="/timesheets?status=submitted" className="mt-4 block">
                <Button variant="outline" size="sm" className="w-full">
                  Review Time Entries
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {role === 'superadmin' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pending Expense Approvals</CardTitle>
              {pendingExpenseApprovals.length > 0 && (
                <Badge variant="warning">{pendingExpenseApprovals.length}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {pendingExpenseApprovals.length > 0 ? (
                <div className="space-y-3">
                  {pendingExpenseApprovals.map((expense: any) => (
                    <div key={expense.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium text-sm">{(expense.profile as any)?.full_name}</p>
                        <p className="text-xs text-text-muted">
                          {expense.category} - {expense.description?.slice(0, 30)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{formatCurrency(expense.amount)}</p>
                        <Badge variant="warning" className="text-xs">Pending</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <CheckCircle className="h-4 w-4 text-success" />
                  All expenses approved
                </div>
              )}
              <Link href="/expenses?status=submitted" className="mt-4 block">
                <Button variant="outline" size="sm" className="w-full">
                  Review Expenses
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
