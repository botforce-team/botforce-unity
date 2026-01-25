import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, FileText, Receipt, FolderKanban } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get user's company membership
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">No Company Access</h2>
        <p className="mt-2 text-gray-600">You are not assigned to any company yet.</p>
      </div>
    )
  }

  const { company_id, role } = membership

  // Fetch dashboard stats based on role
  const isAdmin = role === 'superadmin'
  const isAccountant = role === 'accountant'

  // Time entries stats (for employees and admins)
  let pendingTimeEntries = 0
  let totalHoursThisMonth = 0

  if (!isAccountant) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const timeEntriesQuery = supabase
      .from('time_entries')
      .select('hours, status')
      .eq('company_id', company_id)
      .gte('date', startOfMonth.toISOString().split('T')[0])

    if (!isAdmin) {
      timeEntriesQuery.eq('user_id', user.id)
    }

    const { data: timeEntries } = await timeEntriesQuery

    if (timeEntries) {
      pendingTimeEntries = timeEntries.filter(e => e.status === 'submitted').length
      totalHoursThisMonth = timeEntries.reduce((sum, e) => sum + Number(e.hours), 0)
    }
  }

  // Document stats (for admins and accountants)
  let unpaidInvoices = 0
  let totalRevenue = 0

  if (isAdmin || isAccountant) {
    const { data: documents } = await supabase
      .from('documents')
      .select('total, status')
      .eq('company_id', company_id)
      .eq('document_type', 'invoice')
      .in('status', ['issued', 'paid'])

    if (documents) {
      unpaidInvoices = documents.filter(d => d.status === 'issued').length
      totalRevenue = documents
        .filter(d => d.status === 'paid')
        .reduce((sum, d) => sum + Number(d.total), 0)
    }
  }

  // Project count
  let projectCount = 0
  if (isAdmin) {
    const { count } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company_id)
      .eq('is_active', true)

    projectCount = count || 0
  } else if (!isAccountant) {
    const { count } = await supabase
      .from('project_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)

    projectCount = count || 0
  }

  // Pending expenses (for admins)
  let pendingExpenses = 0
  if (isAdmin) {
    const { count } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company_id)
      .eq('status', 'submitted')

    pendingExpenses = count || 0
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back! Here's an overview of your activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {!isAccountant && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Hours This Month
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalHoursThisMonth.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">
                  Total logged hours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {isAdmin ? 'Pending Approvals' : 'Pending Submissions'}
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingTimeEntries}</div>
                <p className="text-xs text-muted-foreground">
                  Time entries to review
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {(isAdmin || isAccountant) && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Unpaid Invoices
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unpaidInvoices}</div>
                <p className="text-xs text-muted-foreground">
                  Awaiting payment
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  From paid invoices
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {!isAccountant && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isAdmin ? 'Active Projects' : 'Assigned Projects'}
              </CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projectCount}</div>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? 'Currently active' : 'You have access to'}
              </p>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Expenses
              </CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingExpenses}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting approval
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
