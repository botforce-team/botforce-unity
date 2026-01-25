import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default async function ProjectsPage() {
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

  // Fetch projects based on role
  let projects: any[] = []

  if (isAdmin) {
    // Admin sees all projects
    const { data } = await supabase
      .from('projects')
      .select(`
        *,
        customer:customers(id, name)
      `)
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })

    projects = data || []
  } else {
    // Employee sees only assigned projects
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select(`
        project:projects(
          *,
          customer:customers(id, name)
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    projects = assignments?.map(a => a.project).filter(Boolean) || []
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
            {isAdmin ? 'Manage all projects' : 'Your assigned projects'}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white"
            style={{ background: '#1f5bff' }}
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div
          className="py-12 rounded-[18px] text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <p className="text-[rgba(232,236,255,0.6)]">
            {isAdmin
              ? 'No projects yet. Create your first project to get started.'
              : 'No projects assigned to you yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div
                className="p-5 rounded-[18px] h-full transition-all hover:border-[rgba(255,255,255,0.2)]"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">{project.name}</h3>
                    <p className="text-[12px] text-[rgba(232,236,255,0.5)]">
                      {project.customer?.name}
                    </p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                    style={{
                      background: project.is_active ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                      border: `1px solid ${project.is_active ? 'rgba(34, 197, 94, 0.35)' : 'rgba(255, 255, 255, 0.12)'}`,
                      color: project.is_active ? '#22c55e' : 'rgba(255, 255, 255, 0.5)',
                    }}
                  >
                    {project.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {project.code && (
                  <p className="text-[12px] text-[rgba(232,236,255,0.5)] mb-3">
                    Code: {project.code}
                  </p>
                )}
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[rgba(232,236,255,0.6)]">
                    {project.billing_type === 'hourly' ? 'Hourly' : 'Fixed Price'}
                  </span>
                  {project.billing_type === 'hourly' && project.hourly_rate && (
                    <span className="font-semibold text-white">
                      {formatCurrency(project.hourly_rate)}/hr
                    </span>
                  )}
                  {project.billing_type === 'fixed' && project.fixed_price && (
                    <span className="font-semibold text-white">
                      {formatCurrency(project.fixed_price)}
                    </span>
                  )}
                </div>
                {project.budget_hours && (
                  <p className="text-[11px] text-[rgba(232,236,255,0.5)] mt-2">
                    Budget: {project.budget_hours}h
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
