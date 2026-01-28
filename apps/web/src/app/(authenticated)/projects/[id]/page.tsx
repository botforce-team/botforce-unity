import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Pencil,
  Building2,
  Clock,
  DollarSign,
  Calendar,
  Users,
  FileText,
  TrendingUp
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { getProject, getProjectTeam } from '@/app/actions/projects'
import { createClient } from '@/lib/supabase/server'

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params
  const project = await getProject(id)

  if (!project) {
    notFound()
  }

  const supabase = await createClient()
  const team = await getProjectTeam(id)

  // Fetch time entry stats
  const { data: timeStats } = await supabase
    .from('time_entries')
    .select('hours, status')
    .eq('project_id', id)

  const totalHours = timeStats?.reduce((sum, e) => sum + (e.hours || 0), 0) || 0
  const approvedHours = timeStats?.filter(e => e.status === 'approved' || e.status === 'invoiced')
    .reduce((sum, e) => sum + (e.hours || 0), 0) || 0

  // Fetch recent time entries
  const { data: recentEntries } = await supabase
    .from('time_entries')
    .select('id, date, hours, description, status, profile:profiles(full_name)')
    .eq('project_id', id)
    .order('date', { ascending: false })
    .limit(5)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount)

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <Badge variant="secondary">{project.code}</Badge>
          </div>
          <Link
            href={`/customers/${project.customer_id}`}
            className="flex items-center gap-1.5 text-text-secondary hover:text-primary mt-1"
          >
            <Building2 className="h-4 w-4" />
            {project.customer?.name}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={project.is_active ? 'success' : 'secondary'}>
            {project.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Link href={`/projects/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Link href={`/timesheets/new?project=${id}`}>
            <Button>
              <Clock className="mr-2 h-4 w-4" />
              Log Time
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Total Hours</p>
                <p className="text-2xl font-semibold">{totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success/10 p-2">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Approved</p>
                <p className="text-2xl font-semibold">{approvedHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-2">
                <DollarSign className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">
                  {project.billing_type === 'hourly' ? 'Rate' : 'Fixed Price'}
                </p>
                <p className="text-2xl font-semibold">
                  {project.billing_type === 'hourly'
                    ? project.hourly_rate
                      ? `${formatCurrency(project.hourly_rate)}/h`
                      : '-'
                    : project.fixed_price
                    ? formatCurrency(project.fixed_price)
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2">
                <Users className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Team Members</p>
                <p className="text-2xl font-semibold">{team.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.description && (
              <div>
                <p className="text-sm text-text-secondary">Description</p>
                <p className="mt-1">{project.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-text-secondary">Billing Type</p>
                <p className="font-medium capitalize">{project.billing_type}</p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Time Recording</p>
                <p className="font-medium">
                  {project.time_recording_mode === 'hours' ? 'Hours only' : 'Start/End times'}
                </p>
              </div>
              {project.budget_hours && (
                <div>
                  <p className="text-sm text-text-secondary">Budget Hours</p>
                  <p className="font-medium">{project.budget_hours}h</p>
                </div>
              )}
              {project.budget_amount && (
                <div>
                  <p className="text-sm text-text-secondary">Budget Amount</p>
                  <p className="font-medium">{formatCurrency(project.budget_amount)}</p>
                </div>
              )}
              {project.start_date && (
                <div>
                  <p className="text-sm text-text-secondary">Start Date</p>
                  <p className="font-medium">{formatDate(project.start_date)}</p>
                </div>
              )}
              {project.end_date && (
                <div>
                  <p className="text-sm text-text-secondary">End Date</p>
                  <p className="font-medium">{formatDate(project.end_date)}</p>
                </div>
              )}
            </div>
            <div>
              <Badge variant={project.is_billable ? 'success' : 'secondary'}>
                {project.is_billable ? 'Billable' : 'Non-billable'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Team */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-text-secondary" />
              Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team.length > 0 ? (
              <ul className="space-y-2">
                {team.map((member: any) => (
                  <li key={member.id} className="flex items-center justify-between p-2 rounded-md hover:bg-surface-hover">
                    <div>
                      <p className="font-medium">{member.profile?.full_name || 'Unknown'}</p>
                      <p className="text-sm text-text-muted">{member.profile?.email}</p>
                    </div>
                    {member.hourly_rate_override && (
                      <Badge variant="secondary">
                        {formatCurrency(member.hourly_rate_override)}/h
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted text-sm">No team members assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Time Entries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-text-secondary" />
            Recent Time Entries
          </CardTitle>
          <Link href={`/timesheets?project=${id}`}>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentEntries && recentEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-sm text-text-secondary">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Team Member</th>
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Hours</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentEntries.map((entry: any) => (
                    <tr key={entry.id}>
                      <td className="py-2">{formatDate(entry.date)}</td>
                      <td className="py-2">{entry.profile?.full_name || 'Unknown'}</td>
                      <td className="py-2 text-text-secondary truncate max-w-xs">
                        {entry.description || '-'}
                      </td>
                      <td className="py-2 text-right font-medium">{entry.hours}h</td>
                      <td className="py-2 text-right">
                        <Badge
                          variant={
                            entry.status === 'approved' || entry.status === 'invoiced'
                              ? 'success'
                              : entry.status === 'submitted'
                              ? 'info'
                              : entry.status === 'rejected'
                              ? 'danger'
                              : 'secondary'
                          }
                        >
                          {entry.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-text-muted text-sm">No time entries yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
