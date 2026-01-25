import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
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
        <p className="text-gray-600">No company access.</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-600">
            {isAdmin ? 'Manage all projects' : 'Your assigned projects'}
          </p>
        </div>
        {isAdmin && (
          <Link href="/projects/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">
              {isAdmin
                ? 'No projects yet. Create your first project to get started.'
                : 'No projects assigned to you yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {project.customer?.name}
                      </p>
                    </div>
                    <Badge variant={project.is_active ? 'default' : 'secondary'}>
                      {project.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {project.code && (
                    <p className="text-sm text-gray-500 mb-2">
                      Code: {project.code}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {project.billing_type === 'hourly' ? 'Hourly' : 'Fixed Price'}
                    </span>
                    {project.billing_type === 'hourly' && project.hourly_rate && (
                      <span className="font-medium">
                        {formatCurrency(project.hourly_rate)}/hr
                      </span>
                    )}
                    {project.billing_type === 'fixed' && project.fixed_price && (
                      <span className="font-medium">
                        {formatCurrency(project.fixed_price)}
                      </span>
                    )}
                  </div>
                  {project.budget_hours && (
                    <p className="text-sm text-gray-500 mt-1">
                      Budget: {project.budget_hours}h
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
