import { getProjectsWithUnbilledItems } from '@/app/actions/invoicing'
import { ProjectInvoiceForm } from './form'

interface PageProps {
  searchParams: Promise<{
    project?: string
    month?: string
  }>
}

export default async function NewInvoiceFromProjectPage({ searchParams }: PageProps) {
  const params = await searchParams
  const projects = await getProjectsWithUnbilledItems()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rechnung aus Projekt erstellen</h1>
        <p className="text-text-secondary mt-1">
          Wähle ein Projekt und einen Monat, um eine Rechnung aus den gebuchten Zeiten und Ausgaben zu erstellen.
        </p>
      </div>

      <ProjectInvoiceForm
        projects={projects}
        defaultProjectId={params.project}
        defaultMonth={params.month}
      />
    </div>
  )
}
