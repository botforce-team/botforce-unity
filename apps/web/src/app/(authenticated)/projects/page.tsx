import Link from 'next/link'
import { Plus, FolderOpen, Building2, Clock, DollarSign } from 'lucide-react'
import { Button, Card, Badge, EmptyState } from '@/components/ui'
import { getProjects } from '@/app/actions/projects'
import { ProjectActions } from './project-actions'

interface ProjectsPageProps {
  searchParams: Promise<{ page?: string; search?: string; active?: string; customer?: string }>
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = params.search || ''
  const customerId = params.customer
  const isActive = params.active === 'false' ? false : params.active === 'true' ? true : undefined

  const { data: projects, total, totalPages } = await getProjects({
    page,
    search,
    customerId,
    isActive,
    limit: 20,
  })

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <form className="flex-1">
          <input
            type="text"
            name="search"
            placeholder="Search projects..."
            defaultValue={search}
            className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Link
            href="/projects"
            className={`px-3 py-1 rounded-md transition-colors ${isActive === undefined ? 'bg-surface-hover text-text-primary' : 'hover:bg-surface-hover'}`}
          >
            All
          </Link>
          <Link
            href="/projects?active=true"
            className={`px-3 py-1 rounded-md transition-colors ${isActive === true ? 'bg-surface-hover text-text-primary' : 'hover:bg-surface-hover'}`}
          >
            Active
          </Link>
          <Link
            href="/projects?active=false"
            className={`px-3 py-1 rounded-md transition-colors ${isActive === false ? 'bg-surface-hover text-text-primary' : 'hover:bg-surface-hover'}`}
          >
            Inactive
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects found"
          description={search ? 'Try adjusting your search terms' : 'Get started by creating your first project'}
          action={
            !search && (
              <Link href="/projects/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-sm font-medium text-text-secondary">
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Billing</th>
                    <th className="px-4 py-3">Budget</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/projects/${project.id}`} className="group">
                          <div className="font-medium text-text-primary group-hover:text-primary">
                            {project.name}
                          </div>
                          <div className="text-sm text-text-muted">{project.code}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                          <Building2 className="h-3.5 w-3.5" />
                          <Link
                            href={`/customers/${project.customer_id}`}
                            className="hover:text-primary"
                          >
                            {project.customer?.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          {project.billing_type === 'hourly' ? (
                            <>
                              <Clock className="h-3.5 w-3.5 text-text-muted" />
                              <span>
                                {project.hourly_rate
                                  ? `${formatCurrency(project.hourly_rate)}/hr`
                                  : 'Hourly'}
                              </span>
                            </>
                          ) : (
                            <>
                              <DollarSign className="h-3.5 w-3.5 text-text-muted" />
                              <span>
                                {project.fixed_price
                                  ? formatCurrency(project.fixed_price)
                                  : 'Fixed'}
                              </span>
                            </>
                          )}
                        </div>
                        {!project.is_billable && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            Non-billable
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {project.budget_hours && (
                          <div>{project.budget_hours}h budget</div>
                        )}
                        {project.budget_amount && (
                          <div>{formatCurrency(project.budget_amount)} budget</div>
                        )}
                        {!project.budget_hours && !project.budget_amount && (
                          <span className="text-text-muted">No budget</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={project.is_active ? 'success' : 'secondary'}>
                          {project.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ProjectActions project={project} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} projects
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link href={`/projects?page=${page - 1}${search ? `&search=${search}` : ''}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/projects?page=${page + 1}${search ? `&search=${search}` : ''}`}>
                    <Button variant="outline" size="sm">
                      Next
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
