import { getCustomersForSelect } from '@/app/actions/projects'
import { ProjectForm } from '../project-form'

interface NewProjectPageProps {
  searchParams: Promise<{ customer?: string }>
}

export default async function NewProjectPage({ searchParams }: NewProjectPageProps) {
  const params = await searchParams
  const customers = await getCustomersForSelect()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New Project</h1>
      <ProjectForm customers={customers} defaultCustomerId={params.customer} />
    </div>
  )
}
