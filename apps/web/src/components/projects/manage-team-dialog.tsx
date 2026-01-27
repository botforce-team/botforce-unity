'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Trash2, Loader2 } from 'lucide-react'
import {
  getAvailableTeamMembers,
  assignMemberToProject,
  removeMemberFromProject,
  updateAssignmentRate,
} from '@/app/actions/projects'
import { formatCurrency } from '@/lib/utils'

interface Profile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

interface TeamMember {
  user_id: string
  role: string
  hourly_rate: number | null
  profile: Profile | null
}

interface Assignment {
  id: string
  user_id: string
  hourly_rate_override: number | null
  profile: Profile | null
}

interface ManageTeamDialogProps {
  projectId: string
  projectName: string
  projectRate: number | null
  currentAssignments: Assignment[]
}

export function ManageTeamDialog({
  projectId,
  projectName,
  projectRate,
  currentAssignments,
}: ManageTeamDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [availableMembers, setAvailableMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [selectedMember, setSelectedMember] = useState<string>('')
  const [hourlyRate, setHourlyRate] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (open) {
      loadAvailableMembers()
    }
  }, [open])

  async function loadAvailableMembers() {
    setLoadingMembers(true)
    const result = await getAvailableTeamMembers(projectId)
    if (result.data) {
      setAvailableMembers(result.data as TeamMember[])
    }
    setLoadingMembers(false)
  }

  async function handleAddMember() {
    if (!selectedMember) return

    setLoading(true)
    setError(null)

    const rate = hourlyRate ? parseFloat(hourlyRate) : undefined
    const result = await assignMemberToProject(projectId, selectedMember, rate)

    if (result.error) {
      setError(result.error)
    } else {
      setSelectedMember('')
      setHourlyRate('')
      loadAvailableMembers()
      router.refresh()
    }
    setLoading(false)
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Remove this team member from the project?')) return

    setLoading(true)
    const result = await removeMemberFromProject(projectId, userId)
    if (result.error) {
      alert(result.error)
    } else {
      loadAvailableMembers()
      router.refresh()
    }
    setLoading(false)
  }

  async function handleUpdateRate(userId: string, newRate: string) {
    const rate = newRate ? parseFloat(newRate) : null
    const result = await updateAssignmentRate(projectId, userId, rate)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
  }

  function getMemberName(profile: Profile | null): string {
    if (!profile) return 'Unknown'
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`
    }
    return profile.email
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-[13px] font-medium text-[rgba(255,255,255,0.8)] transition-all"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <UserPlus className="h-4 w-4" />
        Manage Team
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="relative w-full max-w-lg rounded-[18px] p-6"
            style={{
              background: 'rgba(20, 25, 40, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Manage Team</h2>
                <p className="text-[13px] text-[rgba(232,236,255,0.6)]">{projectName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 transition-colors hover:bg-[rgba(255,255,255,0.1)]"
              >
                <X className="h-5 w-5 text-[rgba(232,236,255,0.5)]" />
              </button>
            </div>

            {/* Add New Member */}
            <div className="mb-6 space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
                Add Team Member
              </h3>
              <div className="flex gap-3">
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  disabled={loadingMembers || loading}
                  className="flex-1 px-3 py-2.5 text-[14px] text-white focus:outline-none focus:ring-2 focus:ring-[#1f5bff]/50 disabled:opacity-50"
                  style={inputStyle}
                >
                  <option value="">Select team member...</option>
                  {availableMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {getMemberName(member.profile)} ({member.role})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="Rate"
                  disabled={loading}
                  className="w-24 px-3 py-2.5 text-[14px] text-white placeholder-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]/50 disabled:opacity-50"
                  style={inputStyle}
                />
                <button
                  onClick={handleAddMember}
                  disabled={!selectedMember || loading}
                  className="rounded-[10px] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                  style={{ background: '#1f5bff' }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                </button>
              </div>
              {availableMembers.length === 0 && !loadingMembers && (
                <p className="text-[12px] text-[rgba(232,236,255,0.5)]">
                  All team members are already assigned to this project.
                </p>
              )}
              {error && <p className="text-[12px] text-red-400">{error}</p>}
            </div>

            {/* Current Team Members */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
                Current Team ({currentAssignments.length})
              </h3>
              {currentAssignments.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-[rgba(232,236,255,0.5)]">
                  No team members assigned yet.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {currentAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between rounded-[12px] p-3"
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #1f5bff 100%)',
                          }}
                        >
                          <span className="text-[11px] font-semibold text-white">
                            {assignment.profile?.first_name?.[0] ||
                              assignment.profile?.email?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-white">
                            {getMemberName(assignment.profile)}
                          </p>
                          <p className="text-[11px] text-[rgba(232,236,255,0.5)]">
                            {assignment.profile?.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          defaultValue={assignment.hourly_rate_override || ''}
                          placeholder={projectRate ? formatCurrency(projectRate) : 'No rate'}
                          onBlur={(e) => handleUpdateRate(assignment.user_id, e.target.value)}
                          className="w-20 rounded-[8px] px-2 py-1 text-right text-[12px] text-white placeholder-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-1 focus:ring-[#1f5bff]"
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        />
                        <button
                          onClick={() => handleRemoveMember(assignment.user_id)}
                          disabled={loading}
                          className="rounded-lg p-1.5 text-[rgba(232,236,255,0.5)] transition-colors hover:bg-[rgba(239,68,68,0.15)] hover:text-red-400 disabled:opacity-50"
                          title="Remove from project"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div
              className="mt-6 rounded-[10px] p-3"
              style={{ background: 'rgba(31, 91, 255, 0.1)' }}
            >
              <p className="text-[12px] text-[rgba(232,236,255,0.7)]">
                <strong>Rate Override:</strong> Leave blank to use the project rate (
                {projectRate ? formatCurrency(projectRate) : 'not set'}). Enter a value to override
                the rate for this specific team member.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
