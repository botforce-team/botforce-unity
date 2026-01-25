import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { formatDate, getStatusColor } from '@/lib/utils'

export default async function TimesheetsPage() {
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
        <p className="text-gray-600">No company access.</p>
      </div>
    )
  }

  const { company_id, role } = membership
  const isAdmin = role === 'superadmin'

  // Fetch time entries based on role
  let timeEntriesQuery = supabase
    .from('time_entries')
    .select(`
      *,
      project:projects(id, name, code),
      profile:profiles(id, email, first_name, last_name)
    `)
    .eq('company_id', company_id)
    .order('date', { ascending: false })
    .limit(50)

  if (!isAdmin) {
    timeEntriesQuery = timeEntriesQuery.eq('user_id', user.id)
  }

  const { data: timeEntries } = await timeEntriesQuery

  // Group by date
  const groupedEntries = (timeEntries || []).reduce((acc, entry) => {
    const date = entry.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(entry)
    return acc
  }, {} as Record<string, typeof timeEntries>)

  const dates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
          <p className="mt-1 text-sm text-gray-600">
            {isAdmin ? 'Review all time entries' : 'Log and manage your time'}
          </p>
        </div>
        {!isAdmin && (
          <Link href="/timesheets/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Log Time
            </Button>
          </Link>
        )}
      </div>

      {/* Quick filters for admin */}
      {isAdmin && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                All
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                Pending Approval
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                Approved
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                Rejected
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {dates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">
              No time entries yet.
              {!isAdmin && ' Click "Log Time" to add your first entry.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => {
            const entries = groupedEntries[date]
            const totalHours = entries?.reduce((sum, e) => sum + Number(e.hours), 0) || 0

            return (
              <Card key={date}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{formatDate(date)}</CardTitle>
                    <span className="text-sm font-medium text-gray-600">
                      {totalHours.toFixed(1)} hours
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {entries?.map((entry) => (
                      <div key={entry.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {entry.project?.name}
                              </span>
                              {entry.project?.code && (
                                <span className="text-xs text-gray-500">
                                  ({entry.project.code})
                                </span>
                              )}
                              <Badge className={getStatusColor(entry.status)}>
                                {entry.status}
                              </Badge>
                            </div>
                            {entry.description && (
                              <p className="mt-1 text-sm text-gray-600">
                                {entry.description}
                              </p>
                            )}
                            {isAdmin && entry.profile && (
                              <p className="mt-1 text-xs text-gray-500">
                                by {entry.profile.first_name || entry.profile.email}
                              </p>
                            )}
                            {entry.status === 'rejected' && entry.rejection_reason && (
                              <p className="mt-1 text-sm text-red-600">
                                Reason: {entry.rejection_reason}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-semibold">
                              {Number(entry.hours).toFixed(1)}h
                            </span>
                            {(entry.status === 'draft' || entry.status === 'rejected') && !isAdmin && (
                              <Link href={`/timesheets/${entry.id}/edit`}>
                                <Button variant="outline" size="sm">
                                  Edit
                                </Button>
                              </Link>
                            )}
                            {entry.status === 'submitted' && isAdmin && (
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="text-green-600">
                                  Approve
                                </Button>
                                <Button variant="outline" size="sm" className="text-red-600">
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
