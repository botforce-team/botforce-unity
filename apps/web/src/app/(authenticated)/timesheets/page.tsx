import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { TimesheetFilters } from './filters'
import { DayEntries } from './day-entries'

// Force dynamic rendering to always show fresh data
export const dynamic = 'force-dynamic'

interface SearchParams {
  project?: string
  month?: string
  year?: string
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
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
        <p className="text-[rgba(232,236,255,0.6)]">No company access.</p>
      </div>
    )
  }

  const { company_id, role } = membership
  const isAdmin = role === 'superadmin'

  // Fetch projects for filter
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, code')
    .eq('company_id', company_id)
    .eq('is_active', true)
    .order('name')

  // Fetch time entries based on role
  let timeEntriesQuery = supabase
    .from('time_entries')
    .select(`
      *,
      project:projects(id, name, code),
      profile:profiles!time_entries_user_id_fkey(id, email, first_name, last_name)
    `)
    .eq('company_id', company_id)
    .order('date', { ascending: false })
    .limit(200)

  if (!isAdmin) {
    timeEntriesQuery = timeEntriesQuery.eq('user_id', user.id)
  }

  // Apply project filter
  if (searchParams.project) {
    timeEntriesQuery = timeEntriesQuery.eq('project_id', searchParams.project)
  }

  // Apply date filters
  const filterYear = searchParams.year || (searchParams.month ? new Date().getFullYear().toString() : null)

  if (searchParams.month && filterYear) {
    // Filter by specific month and year
    const startDate = `${filterYear}-${searchParams.month}-01`
    const endDate = new Date(parseInt(filterYear), parseInt(searchParams.month), 0)
    const endDateStr = `${filterYear}-${searchParams.month}-${endDate.getDate().toString().padStart(2, '0')}`
    timeEntriesQuery = timeEntriesQuery.gte('date', startDate).lte('date', endDateStr)
  } else if (filterYear) {
    // Filter by year only
    const startDate = `${filterYear}-01-01`
    const endDate = `${filterYear}-12-31`
    timeEntriesQuery = timeEntriesQuery.gte('date', startDate).lte('date', endDate)
  }

  const { data: timeEntries } = await timeEntriesQuery

  // Group by project, then by month, then by day
  const groupedByProject = (timeEntries || []).reduce((acc, entry) => {
    const projectId = entry.project_id
    const projectName = entry.project?.name || 'Unknown Project'
    const projectCode = entry.project?.code || ''
    const projectKey = `${projectId}|${projectName}|${projectCode}`

    if (!acc[projectKey]) {
      acc[projectKey] = {
        projectId,
        projectName,
        projectCode,
        months: {} as Record<string, Record<string, typeof timeEntries>>
      }
    }

    // Group by month (YYYY-MM format)
    const month = entry.date.substring(0, 7)
    if (!acc[projectKey].months[month]) {
      acc[projectKey].months[month] = {}
    }

    // Group by day within month
    const day = entry.date
    if (!acc[projectKey].months[month][day]) {
      acc[projectKey].months[month][day] = []
    }
    acc[projectKey].months[month][day].push(entry)

    return acc
  }, {} as Record<string, { projectId: string; projectName: string; projectCode: string; months: Record<string, Record<string, typeof timeEntries>> }>)

  const projectKeys = Object.keys(groupedByProject).sort((a, b) => {
    const nameA = a.split('|')[1]
    const nameB = b.split('|')[1]
    return nameA.localeCompare(nameB)
  })

  const statusStyles: Record<string, { bg: string; border: string; color: string }> = {
    draft: { bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.12)', color: 'rgba(255, 255, 255, 0.6)' },
    submitted: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', color: '#f59e0b' },
    approved: { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.35)', color: '#22c55e' },
    rejected: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', color: '#ef4444' },
    invoiced: { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.35)', color: '#a78bfa' },
  }

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Timesheets</h1>
          <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
            {isAdmin ? 'Review all time entries' : 'Log and manage your time'}
          </p>
        </div>
        <Link
          href="/timesheets/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white"
          style={{ background: '#1f5bff' }}
        >
          <Plus className="h-4 w-4" />
          Log Time
        </Link>
      </div>

      {/* Filters */}
      <TimesheetFilters
        projects={projects || []}
        selectedProject={searchParams.project}
        selectedMonth={searchParams.month}
        selectedYear={searchParams.year}
      />

      {projectKeys.length === 0 ? (
        <div
          className="py-12 rounded-[18px] text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <p className="text-[rgba(232,236,255,0.6)]">
            No time entries yet.
            {!isAdmin && ' Click "Log Time" to add your first entry.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {projectKeys.map((projectKey) => {
            const { projectId, projectName, projectCode, months } = groupedByProject[projectKey]
            const monthKeys = Object.keys(months).sort((a, b) => b.localeCompare(a))
            // Calculate total hours across all months and days
            const totalProjectHours = Object.values(months).reduce((monthSum, days) => {
              return monthSum + Object.values(days).flat().reduce((daySum, e) => daySum + Number(e?.hours || 0), 0)
            }, 0)

            return (
              <div key={projectKey} className="space-y-4">
                {/* Project Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[18px] font-bold text-white">{projectName}</h2>
                    {projectCode && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium text-[rgba(232,236,255,0.5)]" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        {projectCode}
                      </span>
                    )}
                  </div>
                  <span className="text-[15px] font-semibold text-[#1f5bff]">
                    {totalProjectHours.toFixed(1)} hours total
                  </span>
                </div>

                {/* Months */}
                {monthKeys.map((month) => {
                  const days = months[month]
                  const dayKeys = Object.keys(days).sort((a, b) => b.localeCompare(a))
                  const monthHours = Object.values(days).flat().reduce((sum, e) => sum + Number(e?.hours || 0), 0)

                  return (
                    <div
                      key={month}
                      className="rounded-[18px] overflow-hidden"
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      {/* Month Header */}
                      <div
                        className="px-5 py-3 flex items-center justify-between"
                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
                      >
                        <h3 className="text-[15px] font-semibold text-white">{formatMonth(month)}</h3>
                        <span className="text-[13px] font-medium text-[rgba(232,236,255,0.6)]">
                          {monthHours.toFixed(1)} hours
                        </span>
                      </div>

                      {/* Days */}
                      <div className="divide-y" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                        {dayKeys.map((day) => (
                          <DayEntries
                            key={day}
                            date={day}
                            entries={days[day] || []}
                            isAdmin={isAdmin}
                            currentUserId={user.id}
                            statusStyles={statusStyles}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
