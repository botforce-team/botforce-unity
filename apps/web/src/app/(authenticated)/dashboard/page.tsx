import { createClient } from '@/lib/supabase/server'
import { Clock, FileText, Receipt, FolderKanban } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface CompanyMembership {
  company_id: string
  role: string
}

interface TimeEntry {
  hours: number
  status: string
}

interface Document {
  total: number
  status: string
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: typeof Clock
}) {
  return (
    <div
      className="rounded-[16px] p-4"
      style={{
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
          {title}
        </span>
        <Icon className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
      </div>
      <div className="text-[24px] font-extrabold tracking-tight text-white">{value}</div>
      <p className="mt-1 text-[11px] text-[rgba(232,236,255,0.5)]">{subtitle}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Get user's company membership
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership) {
    return (
      <div
        className="rounded-[18px] py-12 text-center"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <h2 className="text-xl font-semibold text-white">No Company Access</h2>
        <p className="mt-2 text-[rgba(232,236,255,0.68)]">
          You are not assigned to any company yet.
        </p>
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

    const { data: timeEntriesData } = await timeEntriesQuery
    const timeEntries = (timeEntriesData || []) as TimeEntry[]

    pendingTimeEntries = timeEntries.filter((e) => e.status === 'submitted').length
    totalHoursThisMonth = timeEntries.reduce((sum, e) => sum + Number(e.hours), 0)
  }

  // Document stats (for admins and accountants)
  let unpaidInvoices = 0
  let totalRevenue = 0

  if (isAdmin || isAccountant) {
    const { data: documentsData } = await supabase
      .from('documents')
      .select('total, status')
      .eq('company_id', company_id)
      .eq('document_type', 'invoice')
      .in('status', ['issued', 'paid'])

    const documents = (documentsData || []) as Document[]

    unpaidInvoices = documents.filter((d) => d.status === 'issued').length
    totalRevenue = documents
      .filter((d) => d.status === 'paid')
      .reduce((sum, d) => sum + Number(d.total), 0)
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
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
          Welcome back! Here&apos;s an overview of your activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {!isAccountant && (
          <>
            <MetricCard
              title="Hours This Month"
              value={totalHoursThisMonth.toFixed(1)}
              subtitle="Total logged hours"
              icon={Clock}
            />

            <MetricCard
              title={isAdmin ? 'Pending Approvals' : 'Pending Submissions'}
              value={pendingTimeEntries}
              subtitle="Time entries to review"
              icon={Clock}
            />
          </>
        )}

        {(isAdmin || isAccountant) && (
          <>
            <MetricCard
              title="Unpaid Invoices"
              value={unpaidInvoices}
              subtitle="Awaiting payment"
              icon={FileText}
            />

            <MetricCard
              title="Total Revenue"
              value={formatCurrency(totalRevenue)}
              subtitle="From paid invoices"
              icon={FileText}
            />
          </>
        )}

        {!isAccountant && (
          <MetricCard
            title={isAdmin ? 'Active Projects' : 'Assigned Projects'}
            value={projectCount}
            subtitle={isAdmin ? 'Currently active' : 'You have access to'}
            icon={FolderKanban}
          />
        )}

        {isAdmin && (
          <MetricCard
            title="Pending Expenses"
            value={pendingExpenses}
            subtitle="Awaiting approval"
            icon={Receipt}
          />
        )}
      </div>
    </div>
  )
}
