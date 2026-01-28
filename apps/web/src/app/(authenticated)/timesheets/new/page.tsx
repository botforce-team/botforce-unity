import { getProjectsForSelect } from '@/app/actions/time-entries'
import { TimeEntryForm } from '../time-entry-form'

interface NewTimeEntryPageProps {
  searchParams: Promise<{ project?: string; date?: string }>
}

export default async function NewTimeEntryPage({ searchParams }: NewTimeEntryPageProps) {
  const params = await searchParams
  const projects = await getProjectsForSelect()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Log Time</h1>
      <TimeEntryForm
        projects={projects}
        defaultProjectId={params.project}
        defaultDate={params.date}
      />
    </div>
  )
}
