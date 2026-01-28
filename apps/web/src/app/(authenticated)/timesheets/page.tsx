import Link from 'next/link'
import { Plus, Clock, Calendar } from 'lucide-react'
import { Button, Card, Badge, EmptyState } from '@/components/ui'
import { getMyTimeEntries } from '@/app/actions/time-entries'
import { createClient } from '@/lib/supabase/server'
import { TimeEntryActions } from './time-entry-actions'
import { BulkActions } from './bulk-actions'

interface TimesheetsPageProps {
  searchParams: Promise<{
    page?: string
    project?: string
    status?: string
    from?: string
    to?: string
  }>
}

const statusColors: Record<string, 'secondary' | 'info' | 'success' | 'danger' | 'warning'> = {
  draft: 'secondary',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  invoiced: 'warning',
}

export default async function TimesheetsPage({ searchParams }: TimesheetsPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const projectId = params.project
  const status = params.status as any
  const dateFrom = params.from
  const dateTo = params.to

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is admin for approval permissions
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user?.id)
    .eq('is_active', true)
    .maybeSingle()

  const isAdmin = membership?.role === 'superadmin'

  const { data: entries, total, totalPages } = await getMyTimeEntries({
    page,
    projectId,
    status,
    dateFrom,
    dateTo,
    limit: 50,
  })

  // Group entries by date
  const entriesByDate = entries.reduce((acc, entry) => {
    const date = entry.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(entry)
    return acc
  }, {} as Record<string, typeof entries>)

  const dates = Object.keys(entriesByDate).sort((a, b) => b.localeCompare(a))

  const formatDate = (date: string) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) {
      return 'Today'
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(d)
  }

  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.slice(0, 5)
  }

  // Calculate weekly summary
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay() + 1)
  const weeklyHours = entries
    .filter((e) => new Date(e.date) >= startOfWeek)
    .reduce((sum, e) => sum + (e.hours || 0), 0)

  // Get IDs for bulk actions
  const draftIds = entries.filter((e) => e.status === 'draft').map((e) => e.id)
  const submittedIds = entries.filter((e) => e.status === 'submitted').map((e) => e.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Timesheets</h1>
          <p className="text-text-secondary mt-1">
            {weeklyHours.toFixed(1)} hours logged this week
          </p>
        </div>
        <Link href="/timesheets/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Log Time
          </Button>
        </Link>
      </div>

      {/* Filters and Bulk Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/timesheets"
            className={`px-3 py-1 rounded-md transition-colors ${!status ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
          >
            All
          </Link>
          <Link
            href="/timesheets?status=draft"
            className={`px-3 py-1 rounded-md transition-colors ${status === 'draft' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
          >
            Draft
          </Link>
          <Link
            href="/timesheets?status=submitted"
            className={`px-3 py-1 rounded-md transition-colors ${status === 'submitted' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
          >
            Submitted
          </Link>
          <Link
            href="/timesheets?status=approved"
            className={`px-3 py-1 rounded-md transition-colors ${status === 'approved' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
          >
            Approved
          </Link>
        </div>
        <BulkActions draftIds={draftIds} submittedIds={submittedIds} isAdmin={isAdmin} />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No time entries found"
          description="Start tracking your work by logging your first time entry"
          action={
            <Link href="/timesheets/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Log Time
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {dates.map((date) => {
            const dayEntries = entriesByDate[date]
            const dayTotal = dayEntries.reduce((sum, e) => sum + (e.hours || 0), 0)

            return (
              <Card key={date}>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-text-muted" />
                    <span className="font-medium">{formatDate(date)}</span>
                  </div>
                  <span className="text-sm text-text-secondary">
                    {dayTotal.toFixed(1)} hours
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {dayEntries.map((entry: any) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/projects/${entry.project_id}`}
                            className="font-medium hover:text-primary"
                          >
                            {entry.project?.name}
                          </Link>
                          <span className="text-text-muted text-sm">
                            {entry.project?.code}
                          </span>
                        </div>
                        {entry.description && (
                          <p className="text-sm text-text-secondary truncate mt-0.5">
                            {entry.description}
                          </p>
                        )}
                        {entry.start_time && entry.end_time && (
                          <p className="text-xs text-text-muted mt-0.5">
                            {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                            {entry.break_minutes ? ` (${entry.break_minutes}min break)` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-right">
                          <div className="font-medium">{entry.hours}h</div>
                          {!entry.is_billable && (
                            <span className="text-xs text-text-muted">Non-billable</span>
                          )}
                        </div>
                        <Badge variant={statusColors[entry.status]}>
                          {entry.status}
                        </Badge>
                        <TimeEntryActions entry={entry} isAdmin={isAdmin} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total} entries
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link href={`/timesheets?page=${page - 1}${status ? `&status=${status}` : ''}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/timesheets?page=${page + 1}${status ? `&status=${status}` : ''}`}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
