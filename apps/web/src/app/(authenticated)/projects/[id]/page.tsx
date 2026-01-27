import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Users, DollarSign, Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { DeleteProjectButton, ArchiveProjectButton } from './actions'

interface CompanyMembership {
  company_id: string
  role: string
}

interface ProjectWithCustomer {
  id: string
  name: string
  code: string | null
  description: string | null
  billing_type: string
  hourly_rate: number | null
  fixed_price: number | null
  budget_hours: number | null
  is_active: boolean
  customer: { id: string; name: string; email: string | null } | null
}

interface TimeEntryData {
  hours: number
  status: string
}

interface AssignmentWithProfile {
  id: string
  hourly_rate: number | null
  profile: { id: string; email: string; first_name: string | null; last_name: string | null } | null
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
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
    return notFound()
  }

  const { company_id, role } = membership
  const isAdmin = role === 'superadmin'

  // Fetch project
  const { data: projectData } = await supabase
    .from('projects')
    .select(
      `
      *,
      customer:customers(id, name, email)
    `
    )
    .eq('id', params.id)
    .eq('company_id', company_id)
    .single()

  const project = projectData as ProjectWithCustomer | null

  if (!project) {
    return notFound()
  }

  // Check access for non-admins
  if (!isAdmin) {
    const { data: assignment } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!assignment) {
      return notFound()
    }
  }

  // Fetch project assignments
  const { data: assignmentsData } = await supabase
    .from('project_assignments')
    .select(
      `
      *,
      profile:profiles(id, email, first_name, last_name)
    `
    )
    .eq('project_id', params.id)
    .eq('is_active', true)

  const assignments = (assignmentsData || []) as AssignmentWithProfile[]

  // Fetch time entries for this project
  const { data: timeEntriesData } = await supabase
    .from('time_entries')
    .select('hours, status')
    .eq('project_id', params.id)

  const timeEntries = (timeEntriesData || []) as TimeEntryData[]

  const totalHours = timeEntries.reduce((sum, e) => sum + Number(e.hours), 0)
  const approvedHours = timeEntries
    .filter((e) => e.status === 'approved' || e.status === 'invoiced')
    .reduce((sum, e) => sum + Number(e.hours), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
              {project.customer?.name} {project.code && `· ${project.code}`}
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[12px] font-medium"
            style={{
              background: project.is_active
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${project.is_active ? 'rgba(34, 197, 94, 0.35)' : 'rgba(255, 255, 255, 0.12)'}`,
              color: project.is_active ? '#4ade80' : 'rgba(255, 255, 255, 0.6)',
            }}
          >
            {project.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div
          className="rounded-[16px] p-4"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
              Total Hours
            </span>
          </div>
          <div className="text-[24px] font-extrabold text-white">{totalHours.toFixed(1)}</div>
          <p className="text-[11px] text-[rgba(232,236,255,0.5)]">
            {approvedHours.toFixed(1)} approved
          </p>
        </div>

        <div
          className="rounded-[16px] p-4"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
              Billing
            </span>
          </div>
          <div className="text-[24px] font-extrabold text-white">
            {project.billing_type === 'hourly'
              ? `${formatCurrency(project.hourly_rate || 0)}/hr`
              : formatCurrency(project.fixed_price || 0)}
          </div>
          <p className="text-[11px] text-[rgba(232,236,255,0.5)]">
            {project.billing_type === 'hourly' ? 'Hourly rate' : 'Fixed price'}
          </p>
        </div>

        <div
          className="rounded-[16px] p-4"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
              Team
            </span>
          </div>
          <div className="text-[24px] font-extrabold text-white">{assignments?.length || 0}</div>
          <p className="text-[11px] text-[rgba(232,236,255,0.5)]">Assigned members</p>
        </div>
      </div>

      {/* Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Project Info */}
        <div
          className="rounded-[18px] p-5"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
            Project Details
          </h3>
          <div className="space-y-3">
            <div
              className="flex justify-between py-2"
              style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.08)' }}
            >
              <span className="text-[13px] text-[rgba(232,236,255,0.6)]">Customer</span>
              <span className="text-[13px] font-medium text-white">{project.customer?.name}</span>
            </div>
            {project.code && (
              <div
                className="flex justify-between py-2"
                style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.08)' }}
              >
                <span className="text-[13px] text-[rgba(232,236,255,0.6)]">Project Code</span>
                <span className="text-[13px] font-medium text-white">{project.code}</span>
              </div>
            )}
            <div
              className="flex justify-between py-2"
              style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.08)' }}
            >
              <span className="text-[13px] text-[rgba(232,236,255,0.6)]">Billing Type</span>
              <span className="text-[13px] font-medium capitalize text-white">
                {project.billing_type}
              </span>
            </div>
            {project.budget_hours && (
              <div
                className="flex justify-between py-2"
                style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.08)' }}
              >
                <span className="text-[13px] text-[rgba(232,236,255,0.6)]">Budget Hours</span>
                <span className="text-[13px] font-medium text-white">{project.budget_hours}h</span>
              </div>
            )}
            {project.description && (
              <div className="pt-2">
                <span className="text-[13px] text-[rgba(232,236,255,0.6)]">Description</span>
                <p className="mt-1 text-[13px] text-white">{project.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Team Members */}
        <div
          className="rounded-[18px] p-5"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
            Team Members
          </h3>
          {!assignments || assignments.length === 0 ? (
            <p className="text-[13px] text-[rgba(232,236,255,0.5)]">
              No team members assigned yet.
            </p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.08)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #1f5bff 100%)' }}
                    >
                      <span className="text-[11px] font-semibold text-white">
                        {assignment.profile?.first_name?.[0] ||
                          assignment.profile?.email?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">
                        {assignment.profile?.first_name && assignment.profile?.last_name
                          ? `${assignment.profile.first_name} ${assignment.profile.last_name}`
                          : assignment.profile?.email}
                      </p>
                    </div>
                  </div>
                  {assignment.hourly_rate && (
                    <span className="text-[12px] text-[rgba(232,236,255,0.6)]">
                      {formatCurrency(assignment.hourly_rate)}/hr
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {isAdmin && (
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/timesheets/new?project=${project.id}`}
            className="rounded-[12px] px-4 py-2 text-[13px] font-medium text-white transition-all"
            style={{ background: '#1f5bff' }}
          >
            Log Time
          </Link>
          <Link
            href={`/documents/new?project=${project.id}`}
            className="rounded-[12px] px-4 py-2 text-[13px] font-medium text-[rgba(255,255,255,0.8)] transition-all"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            Create Invoice
          </Link>
          <Link
            href={`/projects/${project.id}/edit`}
            className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-[13px] font-medium text-[rgba(255,255,255,0.8)] transition-all"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <div className="ml-auto flex gap-3">
            <ArchiveProjectButton projectId={project.id} isActive={project.is_active} />
            <DeleteProjectButton projectId={project.id} />
          </div>
        </div>
      )}
    </div>
  )
}
