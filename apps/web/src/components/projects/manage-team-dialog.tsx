'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, UserMinus, X } from 'lucide-react'
import { Button, Input, Label, Badge } from '@/components/ui'
import { addTeamMember, removeTeamMember, getAvailableTeamMembers } from '@/app/actions/projects'
import { useToast } from '@/components/ui/use-toast'

interface TeamMember {
  id: string
  user_id: string
  hourly_rate_override: number | null
  profile: {
    id: string
    full_name: string | null
    email: string
  } | null
}

interface AvailableMember {
  user_id: string
  role: string
  hourly_rate: number | null
  profile: {
    id: string
    full_name: string | null
    email: string
  } | null
}

interface ManageTeamDialogProps {
  projectId: string
  projectName: string
  currentTeam: TeamMember[]
}

export function ManageTeamDialog({ projectId, projectName, currentTeam }: ManageTeamDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('')
  const [hourlyRateOverride, setHourlyRateOverride] = useState<string>('')
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      loadAvailableMembers()
    }
  }, [isOpen])

  const loadAvailableMembers = async () => {
    setIsLoading(true)
    try {
      const members = await getAvailableTeamMembers(projectId)
      setAvailableMembers(members)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load available members',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedMember) return

    setActionLoading('add')
    try {
      const result = await addTeamMember(
        projectId,
        selectedMember,
        hourlyRateOverride ? parseFloat(hourlyRateOverride) : undefined
      )

      if (result.success) {
        toast({
          title: 'Member added',
          description: 'Team member has been assigned to the project',
        })
        setSelectedMember('')
        setHourlyRateOverride('')
        router.refresh()
        loadAvailableMembers()
      } else {
        toast({
          title: 'Failed to add member',
          description: result.error || 'Please try again',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemoveMember = async (userId: string, memberName: string) => {
    setActionLoading(userId)
    try {
      const result = await removeTeamMember(projectId, userId)

      if (result.success) {
        toast({
          title: 'Member removed',
          description: `${memberName} has been removed from the project`,
        })
        router.refresh()
        loadAvailableMembers()
      } else {
        toast({
          title: 'Failed to remove member',
          description: result.error || 'Please try again',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Users className="mr-2 h-4 w-4" />
        Manage Team
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Manage Team - {projectName}</h2>
          <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Add New Member */}
        <div className="mb-6 rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-medium">Add Team Member</h3>
          {isLoading ? (
            <p className="text-sm text-text-muted">Loading available members...</p>
          ) : availableMembers.length === 0 ? (
            <p className="text-sm text-text-muted">All team members are already assigned</p>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="member">Select Member</Label>
                <select
                  id="member"
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Choose a team member...</option>
                  {availableMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.profile?.full_name || member.profile?.email || 'Unknown'}
                      {member.hourly_rate ? ` (€${member.hourly_rate}/hr)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="rate">Hourly Rate Override (optional)</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRateOverride}
                  onChange={(e) => setHourlyRateOverride(e.target.value)}
                  placeholder="Use default rate"
                />
              </div>
              <Button
                onClick={handleAddMember}
                disabled={!selectedMember || actionLoading === 'add'}
                size="sm"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {actionLoading === 'add' ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          )}
        </div>

        {/* Current Team */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Current Team ({currentTeam.length})</h3>
          {currentTeam.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text-muted">
              No team members assigned yet
            </p>
          ) : (
            <div className="space-y-2">
              {currentTeam.map((member) => {
                const name = member.profile?.full_name || member.profile?.email || 'Unknown'
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-muted text-xs font-medium text-primary">
                        {name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{name}</p>
                        {member.profile?.email && (
                          <p className="text-xs text-text-muted">{member.profile.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.hourly_rate_override && (
                        <Badge variant="secondary" className="text-xs">
                          €{member.hourly_rate_override}/hr
                        </Badge>
                      )}
                      <button
                        onClick={() => handleRemoveMember(member.user_id, name)}
                        disabled={actionLoading === member.user_id}
                        className="rounded p-1 text-text-muted hover:bg-red-50 hover:text-red-600"
                        title="Remove from project"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
