import Link from 'next/link'
import { Plus, Clock, Calendar, LayoutList, LayoutGrid } from 'lucide-react'
import { Button, Card, Badge, EmptyState } from '@/components/ui'
import { getMyTimeEntries } from '@/app/actions/time-entries'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { TimeEntryActions } from './time-entry-actions'
import { BulkActions } from './bulk-actions'
import { TimesheetGroupedView } from './timesheet-grouped-view'

interface TimesheetsPageProps {
  searchParams: Promise<{
    page?: string
    project?: string
    status?: string
    from?: string
    to?: string
    view?: string
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
  const viewMode = params.view || 'grouped' // Default to grouped view

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is admin for approval permissions (use admin client to bypass RLS)
  const adminClient = await createAdminClient()
  const { data: membership } = await adminClient
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
    limit: viewMode === 'grouped' ? 200 : 50, // More entries for grouped view
  })

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

  // Build URL with current filters preserved
  const buildUrl = (newParams: Record<string, string | undefined>) => {
    const urlParams = new URLSearchParams()
    if (status && !('status' in newParams)) urlParams.set('status', status)
    if (projectId && !('project' in newParams)) urlParams.set('project', projectId)
    Object.entries(newParams).forEach(([key, value]) => {
      if (value !== undefined) urlParams.set(key, value)
    })
    const query = urlParams.toString()
    return `/timesheets${query ? `?${query}` : ''}`
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) {
      return 'Heute'
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Gestern'
    }
    return new Intl.DateTimeFormat('de-AT', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(d)
  }

  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.slice(0, 5)
  }

  // Group entries by date for list view
  const entriesByDate = entries.reduce((acc, entry) => {
    const date = entry.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(entry)
    return acc
  }, {} as Record<string, typeof entries>)

  const dates = Object.keys(entriesByDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Zeiterfassung</h1>
          <p className="text-text-secondary mt-1">
            {weeklyHours.toFixed(1)} Stunden diese Woche
          </p>
        </div>
        <Link href="/timesheets/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Zeit buchen
          </Button>
        </Link>
      </div>

      {/* Filters, View Toggle and Bulk Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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
          <Link
            href={buildUrl({ status: 'invoiced' })}
            className={`px-3 py-1 rounded-md transition-colors ${status === 'invoiced' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
          >
            Abgerechnet
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <Link
              href={buildUrl({ view: 'grouped' })}
              className={`p-1.5 transition-colors ${viewMode === 'grouped' ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-hover'}`}
              title="Gruppierte Ansicht"
            >
              <LayoutGrid className="h-4 w-4" />
            </Link>
            <Link
              href={buildUrl({ view: 'list' })}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-hover'}`}
              title="Listen-Ansicht"
            >
              <LayoutList className="h-4 w-4" />
            </Link>
          </div>
          <BulkActions draftIds={draftIds} submittedIds={submittedIds} isAdmin={isAdmin} />
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Keine Zeiteinträge gefunden"
          description="Beginne mit der Zeiterfassung, indem du deinen ersten Eintrag erstellst"
          action={
            <Link href="/timesheets/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Zeit buchen
              </Button>
            </Link>
          }
        />
      ) : viewMode === 'grouped' ? (
        <TimesheetGroupedView entries={entries} isAdmin={isAdmin} />
      ) : (
        <>
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
                      {dayTotal.toFixed(1)} Stunden
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
                              {entry.break_minutes ? ` (${entry.break_minutes}min Pause)` : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <div className="text-right">
                            <div className="font-medium">{entry.hours}h</div>
                            {!entry.is_billable && (
                              <span className="text-xs text-text-muted">Nicht abrechenbar</span>
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
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Zeige {(page - 1) * 50 + 1} bis {Math.min(page * 50, total)} von {total} Einträgen
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
