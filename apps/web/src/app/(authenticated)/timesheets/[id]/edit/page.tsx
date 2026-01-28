import { notFound, redirect } from 'next/navigation'
import { getTimeEntry, getProjectsForSelect } from '@/app/actions/time-entries'
import { TimeEntryForm } from '../../time-entry-form'

interface EditTimeEntryPageProps {
  params: Promise<{ id: string }>
}

export default async function EditTimeEntryPage({ params }: EditTimeEntryPageProps) {
  const { id } = await params
  const [entry, projects] = await Promise.all([
    getTimeEntry(id),
    getProjectsForSelect(),
  ])

  if (!entry) {
    notFound()
  }

  // Can only edit draft or rejected entries
  if (!['draft', 'rejected'].includes(entry.status)) {
    redirect('/timesheets')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Time Entry</h1>
      <TimeEntryForm entry={entry} projects={projects} />
    </div>
  )
}
