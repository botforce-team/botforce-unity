'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateTimeEntry, submitTimeEntry, deleteTimeEntry } from '@/app/actions/time-entries'

export default function EditTimeEntryPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const supabase = createClient()
  const [entry, setEntry] = useState<any>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState('')
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')
  const [isBillable, setIsBillable] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Load time entry
      const { data: timeEntry } = await supabase
        .from('time_entries')
        .select('*, project:projects(id, name, code)')
        .eq('id', params.id)
        .single()

      if (timeEntry) {
        setEntry(timeEntry)
        setProjectId(timeEntry.project_id)
        setDate(timeEntry.date)
        setHours(String(timeEntry.hours))
        setDescription(timeEntry.description || '')
        setIsBillable(timeEntry.is_billable)
      }

      // Load assigned projects
      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('project:projects(id, name, code)')
        .eq('user_id', user.user.id)
        .eq('is_active', true)

      setProjects(assignments?.map(a => a.project).filter(Boolean) || [])
      setLoading(false)
    }

    loadData()
  }, [supabase, params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const formData = new FormData()
    formData.set('project_id', projectId)
    formData.set('date', date)
    formData.set('hours', hours)
    formData.set('description', description)
    formData.set('is_billable', String(isBillable))

    const result = await updateTimeEntry(params.id, formData)

    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push('/timesheets')
    }
  }

  async function handleSubmitEntry() {
    if (!confirm('Submit this time entry for approval? You won\'t be able to edit it after submission.')) return
    setSaving(true)
    const result = await submitTimeEntry(params.id)
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push('/timesheets')
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this time entry? This cannot be undone.')) return
    setSaving(true)
    const result = await deleteTimeEntry(params.id)
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push('/timesheets')
    }
  }

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[rgba(232,236,255,0.6)]">Loading...</div>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="text-center py-12">
        <p className="text-[rgba(232,236,255,0.6)]">Time entry not found.</p>
        <Link href="/timesheets" className="text-[#1f5bff] hover:underline mt-2 inline-block">
          Back to Timesheets
        </Link>
      </div>
    )
  }

  const canEdit = entry.status === 'draft' || entry.status === 'rejected'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/timesheets"
          className="inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Timesheets
        </Link>
        <h1 className="text-2xl font-bold text-white">Edit Time Entry</h1>
        {entry.status === 'rejected' && entry.rejection_reason && (
          <div
            className="mt-3 p-3 rounded-[10px] text-[13px]"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
            }}
          >
            <strong>Rejected:</strong> {entry.rejection_reason}
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div
          className="p-6 rounded-[18px] space-y-5"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Project */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Project *
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              disabled={!canEdit}
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none disabled:opacity-50"
              style={inputStyle}
            >
              <option value="">Select project</option>
              {projects.map((project: any) => (
                <option key={project.id} value={project.id}>
                  {project.name} {project.code && `(${project.code})`}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={!canEdit}
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none disabled:opacity-50"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Hours *
              </label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
                disabled={!canEdit}
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none disabled:opacity-50"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={!canEdit}
              placeholder="What did you work on?"
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none resize-none disabled:opacity-50"
              style={inputStyle}
            />
          </div>

          {/* Billable */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="billable"
              checked={isBillable}
              onChange={(e) => setIsBillable(e.target.checked)}
              disabled={!canEdit}
              className="h-4 w-4 rounded"
            />
            <label htmlFor="billable" className="text-[13px] text-[rgba(232,236,255,0.8)]">
              Billable time
            </label>
          </div>
        </div>

        {error && (
          <div
            className="text-[13px] p-3 rounded-[10px]"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        {canEdit && (
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: '#1f5bff' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleSubmitEntry}
              disabled={saving}
              className="px-5 py-2.5 rounded-[12px] text-[13px] font-medium text-white disabled:opacity-50"
              style={{ background: '#22c55e' }}
            >
              Submit for Approval
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-5 py-2.5 rounded-[12px] text-[13px] font-medium text-[rgba(239,68,68,0.9)] disabled:opacity-50"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
              }}
            >
              Delete
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
