'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createTimeEntry } from '@/app/actions/time-entries'

interface Project {
  id: string
  name: string
  code: string | null
  time_recording_mode?: 'hours' | 'start_end' | null
}

interface CompanyMembership {
  company_id: string
  role: string
}

interface ProjectData {
  id: string
  name: string
  code: string | null
  time_recording_mode?: 'hours' | 'start_end' | null
}

interface AssignmentWithProject {
  project: ProjectData | null
}

export default function NewTimeEntryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')
  const [isBillable, setIsBillable] = useState(true)

  // Start/End mode fields
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [breakMinutes, setBreakMinutes] = useState('30')

  // Get selected project
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === projectId)
  }, [projects, projectId])

  const timeMode = selectedProject?.time_recording_mode || 'hours'

  // Calculate hours from start/end time
  const calculatedHours = useMemo(() => {
    if (timeMode !== 'start_end' || !startTime || !endTime) return null

    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)

    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    const breakMins = parseInt(breakMinutes) || 0

    const totalMinutes = endMinutes - startMinutes - breakMins
    if (totalMinutes <= 0) return null

    return Math.round((totalMinutes / 60) * 100) / 100
  }, [timeMode, startTime, endTime, breakMinutes])

  useEffect(() => {
    async function loadProjects() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      // Check if user is superadmin
      const { data: membershipData } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .single()

      const membership = membershipData as CompanyMembership | null

      if (!membership) {
        setProjects([])
        return
      }

      let projectList: Project[] = []

      if (membership.role === 'superadmin') {
        // Superadmins can log time on any active project
        const { data: allProjects, error: projectsError } = await supabase
          .from('projects')
          .select('id, name, code, time_recording_mode')
          .eq('company_id', membership.company_id)
          .eq('is_active', true)
          .order('name')

        if (projectsError) {
          // Fallback: query without time_recording_mode if column doesn't exist
          console.warn('Error fetching with time_recording_mode, trying fallback:', projectsError)
          const { data: fallbackProjects } = await supabase
            .from('projects')
            .select('id, name, code')
            .eq('company_id', membership.company_id)
            .eq('is_active', true)
            .order('name')

          const fallbackData = (fallbackProjects || []) as ProjectData[]
          projectList = fallbackData.map((p) => ({
            ...p,
            time_recording_mode: 'hours' as const,
          }))
        } else {
          const projectsData = (allProjects || []) as ProjectData[]
          projectList = projectsData.map((p) => ({
            ...p,
            time_recording_mode: p.time_recording_mode || 'hours',
          }))
        }
      } else {
        // Regular users: get assigned projects
        const { data: assignments, error: assignError } = await supabase
          .from('project_assignments')
          .select(
            `
            project:projects(id, name, code, time_recording_mode)
          `
          )
          .eq('user_id', userData.user.id)
          .eq('is_active', true)

        if (assignError) {
          // Fallback: query without time_recording_mode
          console.warn('Error fetching with time_recording_mode, trying fallback:', assignError)
          const { data: fallbackAssignments } = await supabase
            .from('project_assignments')
            .select(
              `
              project:projects(id, name, code)
            `
            )
            .eq('user_id', userData.user.id)
            .eq('is_active', true)

          const fallbackData = (fallbackAssignments || []) as AssignmentWithProject[]
          projectList = fallbackData
            .map((a) => {
              const proj = a.project
              return proj
                ? {
                    ...proj,
                    time_recording_mode: 'hours' as const,
                  }
                : null
            })
            .filter(Boolean) as Project[]
        } else {
          const assignmentsData = (assignments || []) as AssignmentWithProject[]
          projectList = assignmentsData
            .map((a) => {
              const proj = a.project
              return proj
                ? {
                    ...proj,
                    time_recording_mode: proj.time_recording_mode || 'hours',
                  }
                : null
            })
            .filter(Boolean) as Project[]
        }
      }

      setProjects(projectList)
    }

    loadProjects()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData()
    formData.set('project_id', projectId)
    formData.set('date', date)
    formData.set('description', description)
    formData.set('is_billable', String(isBillable))

    if (timeMode === 'start_end') {
      formData.set('start_time', startTime)
      formData.set('end_time', endTime)
      formData.set('break_minutes', breakMinutes)
      // Hours will be calculated server-side from the database trigger
      formData.set('hours', String(calculatedHours || 0))
    } else {
      formData.set('hours', hours)
    }

    const result = await createTimeEntry(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/timesheets')
    }
  }

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  const isFormValid =
    projectId && (timeMode === 'hours' ? hours : calculatedHours && calculatedHours > 0)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/timesheets"
          className="mb-4 inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Timesheets
        </Link>
        <h1 className="text-2xl font-bold text-white">Log Time</h1>
        <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
          Record your work hours on a project
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div
          className="space-y-5 rounded-[18px] p-6"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Project */}
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
              Project *
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] focus:outline-none"
              style={inputStyle}
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} {project.code && `(${project.code})`}
                </option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="mt-2 text-[12px] text-[rgba(232,236,255,0.5)]">
                No projects assigned to you yet. Ask an admin to assign you to a project.
              </p>
            )}
            {selectedProject && (
              <p className="mt-2 text-[11px] text-[rgba(232,236,255,0.5)]">
                Time recording:{' '}
                {timeMode === 'hours' ? 'Direct hours entry' : 'Start/end time with break'}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
              Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Time Entry - Mode Dependent */}
          {timeMode === 'hours' ? (
            // Direct Hours Entry
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                Hours *
              </label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                placeholder="1.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
                className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                style={inputStyle}
              />
            </div>
          ) : (
            // Start/End Time Entry
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                  Break (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="480"
                  step="5"
                  placeholder="30"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                  style={inputStyle}
                />
              </div>

              {/* Calculated Hours Display */}
              <div
                className="rounded-[12px] p-3"
                style={{
                  background: 'rgba(31, 91, 255, 0.1)',
                  border: '1px solid rgba(31, 91, 255, 0.3)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[rgba(232,236,255,0.7)]">
                    Calculated working hours:
                  </span>
                  <span className="text-[16px] font-bold text-white">
                    {calculatedHours ? `${calculatedHours} h` : '—'}
                  </span>
                </div>
                {calculatedHours && calculatedHours <= 0 && (
                  <p className="mt-1 text-[11px] text-[#f87171]">
                    End time must be after start time (minus break)
                  </p>
                )}
              </div>
            </>
          )}

          {/* Description */}
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="What did you work on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
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
              className="h-4 w-4 rounded"
            />
            <label htmlFor="billable" className="text-[13px] text-[rgba(232,236,255,0.8)]">
              Billable time
            </label>
          </div>
        </div>

        {error && (
          <div
            className="rounded-[10px] p-3 text-[13px]"
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
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="rounded-[12px] px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#1f5bff' }}
          >
            {loading ? 'Saving...' : 'Save Entry'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-[12px] px-5 py-2.5 text-[13px] text-[rgba(255,255,255,0.6)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
