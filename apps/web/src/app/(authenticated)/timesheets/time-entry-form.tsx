'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from '@/components/ui'
import { createTimeEntry, updateTimeEntry, type CreateTimeEntryInput } from '@/app/actions/time-entries'
import type { TimeEntry } from '@/types'

interface TimeEntryFormProps {
  entry?: TimeEntry
  projects: { value: string; label: string }[]
  defaultProjectId?: string
  defaultDate?: string
}

export function TimeEntryForm({ entry, projects, defaultProjectId, defaultDate }: TimeEntryFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!entry

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const recordingMode = formData.get('recording_mode') as string

      const input: CreateTimeEntryInput = {
        project_id: formData.get('project_id') as string,
        date: formData.get('date') as string,
        description: (formData.get('description') as string) || null,
        is_billable: formData.get('is_billable') === 'on',
      }

      if (recordingMode === 'hours') {
        input.hours = parseFloat(formData.get('hours') as string) || 0
      } else {
        input.start_time = (formData.get('start_time') as string) || null
        input.end_time = (formData.get('end_time') as string) || null
        input.break_minutes = parseInt(formData.get('break_minutes') as string) || null
      }

      const result = isEditing
        ? await updateTimeEntry(entry.id, input)
        : await createTimeEntry(input)

      if (result.success) {
        router.push('/timesheets')
      } else {
        alert(result.error)
      }
    })
  }

  // Determine default recording mode
  const defaultMode = entry?.start_time ? 'start_end' : 'hours'

  return (
    <form action={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Time Entry Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project_id">Project *</Label>
                <Select
                  id="project_id"
                  name="project_id"
                  required
                  defaultValue={entry?.project_id || defaultProjectId || ''}
                  options={[{ value: '', label: 'Select a project...' }, ...projects]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={entry?.date || defaultDate || today}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recording Mode</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="recording_mode"
                    value="hours"
                    defaultChecked={defaultMode === 'hours'}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Hours only</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="recording_mode"
                    value="start_end"
                    defaultChecked={defaultMode === 'start_end'}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Start/End times</span>
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="hours">Hours</Label>
                <Input
                  id="hours"
                  name="hours"
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  defaultValue={entry?.hours || ''}
                  placeholder="8.0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="time"
                  defaultValue={entry?.start_time?.slice(0, 5) || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="time"
                  defaultValue={entry?.end_time?.slice(0, 5) || ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="break_minutes">Break (minutes)</Label>
              <Input
                id="break_minutes"
                name="break_minutes"
                type="number"
                min="0"
                max="480"
                defaultValue={entry?.break_minutes || ''}
                placeholder="30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={entry?.description || ''}
                placeholder="What did you work on?"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_billable"
                name="is_billable"
                defaultChecked={entry?.is_billable ?? true}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="is_billable" className="cursor-pointer">
                Billable time
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
              ? 'Save Changes'
              : 'Log Time'}
          </Button>
        </div>
      </div>
    </form>
  )
}
