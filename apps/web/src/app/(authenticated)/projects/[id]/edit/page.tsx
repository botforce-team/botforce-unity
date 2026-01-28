import { notFound } from 'next/navigation'
import { getProject, getCustomersForSelect } from '@/app/actions/projects'
import { ProjectForm } from '../../project-form'

interface EditProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { id } = await params
  const [project, customers] = await Promise.all([
    getProject(id),
    getCustomersForSelect(),
  ])

  if (!project) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Project</h1>
      <ProjectForm project={project} customers={customers} />
    </div>
  )
}
