'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, MoreVertical, UserMinus, UserCheck, Mail } from 'lucide-react'
import { Button, Badge, Input, Label, Select } from '@/components/ui'
import { inviteTeamMember, deactivateMember, reactivateMember, updateTeamMember } from '@/app/actions/team'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { CompanyMember, Profile, UserRole } from '@/types'

interface TeamMemberWithProfile extends Omit<CompanyMember, 'profile'> {
  profile: Profile | null
}

interface TeamMembersListProps {
  members: TeamMemberWithProfile[]
  currentUserId: string
  isSuperadmin: boolean
}

function getRoleBadgeColor(role: UserRole) {
  switch (role) {
    case 'superadmin':
      return 'bg-purple-100 text-purple-800'
    case 'accountant':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function getRoleLabel(role: UserRole) {
  switch (role) {
    case 'superadmin':
      return 'Superadmin'
    case 'accountant':
      return 'Accountant'
    default:
      return 'Employee'
  }
}

export function TeamMembersList({ members, currentUserId, isSuperadmin }: TeamMembersListProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  // Invite form state
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('employee')
  const [hourlyRate, setHourlyRate] = useState('')

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading('invite')
    try {
      const result = await inviteTeamMember(
        email.trim(),
        role,
        hourlyRate ? parseFloat(hourlyRate) : undefined
      )

      if (result.success) {
        toast({
          title: 'Invitation sent',
          description: `An invitation has been sent to ${email}`,
        })
        setIsInviteOpen(false)
        setEmail('')
        setRole('employee')
        setHourlyRate('')
        router.refresh()
      } else {
        toast({
          title: 'Failed to send invitation',
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
      setIsLoading(null)
    }
  }

  const handleDeactivate = async (memberId: string, memberName: string) => {
    setIsLoading(memberId)
    try {
      const result = await deactivateMember(memberId)
      if (result.success) {
        toast({
          title: 'Member deactivated',
          description: `${memberName} has been deactivated`,
        })
        router.refresh()
      } else {
        toast({
          title: 'Failed to deactivate',
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
      setIsLoading(null)
      setMenuOpen(null)
    }
  }

  const handleReactivate = async (memberId: string, memberName: string) => {
    setIsLoading(memberId)
    try {
      const result = await reactivateMember(memberId)
      if (result.success) {
        toast({
          title: 'Member reactivated',
          description: `${memberName} has been reactivated`,
        })
        router.refresh()
      } else {
        toast({
          title: 'Failed to reactivate',
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
      setIsLoading(null)
      setMenuOpen(null)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    setIsLoading(memberId)
    try {
      const result = await updateTeamMember(memberId, { role: newRole })
      if (result.success) {
        toast({
          title: 'Role updated',
          description: `Role has been changed to ${getRoleLabel(newRole)}`,
        })
        setEditingMember(null)
        router.refresh()
      } else {
        toast({
          title: 'Failed to update role',
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
      setIsLoading(null)
    }
  }

  const activeMembers = members.filter(m => m.is_active)
  const inactiveMembers = members.filter(m => !m.is_active)

  return (
    <div className="space-y-6">
      {/* Invite Button */}
      {isSuperadmin && (
        <div>
          {!isInviteOpen ? (
            <Button onClick={() => setIsInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-4">
              <h3 className="mb-4 font-medium">Invite Team Member</h3>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                    >
                      <option value="employee">Employee</option>
                      <option value="accountant">Accountant</option>
                      <option value="superadmin">Superadmin</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="hourlyRate">Hourly Rate (optional)</Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading === 'invite' || !email.trim()}>
                    {isLoading === 'invite' ? 'Sending...' : 'Send Invitation'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsInviteOpen(false)}
                    disabled={isLoading === 'invite'}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Active Members */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-text-muted">Active Members ({activeMembers.length})</h3>
        <div className="space-y-2">
          {activeMembers.map((member) => {
            const name = member.profile?.full_name || member.profile?.email || 'Unknown'
            const email = member.profile?.email || ''
            const isCurrentUser = member.user_id === currentUserId
            const isEditing = editingMember === member.id

            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-muted text-sm font-medium text-primary">
                    {name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{name}</span>
                      {isCurrentUser && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                      <Mail className="h-3 w-3" />
                      {email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {member.hourly_rate && (
                    <span className="text-sm text-text-muted">
                      €{member.hourly_rate.toFixed(2)}/hr
                    </span>
                  )}

                  {isEditing && isSuperadmin ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                        disabled={isLoading === member.id}
                        className="w-32"
                      >
                        <option value="employee">Employee</option>
                        <option value="accountant">Accountant</option>
                        <option value="superadmin">Superadmin</option>
                      </Select>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingMember(null)}
                      >
                        Done
                      </Button>
                    </div>
                  ) : (
                    <Badge className={cn('cursor-default', getRoleBadgeColor(member.role))}>
                      {getRoleLabel(member.role)}
                    </Badge>
                  )}

                  {isSuperadmin && !isCurrentUser && (
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                      {menuOpen === member.id && (
                        <div className="absolute right-0 bottom-full z-10 mb-1 w-48 rounded-md border border-border bg-background py-1 shadow-lg max-h-80 overflow-y-auto">
                          <button
                            onClick={() => {
                              setEditingMember(member.id)
                              setMenuOpen(null)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-surface"
                          >
                            Change Role
                          </button>
                          <button
                            onClick={() => handleDeactivate(member.id, name)}
                            disabled={isLoading === member.id}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-surface"
                          >
                            <UserMinus className="h-4 w-4" />
                            Deactivate
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {activeMembers.length === 0 && (
            <p className="py-4 text-center text-text-muted">No active members</p>
          )}
        </div>
      </div>

      {/* Inactive Members */}
      {inactiveMembers.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-text-muted">
            Inactive Members ({inactiveMembers.length})
          </h3>
          <div className="space-y-2">
            {inactiveMembers.map((member) => {
              const name = member.profile?.full_name || member.profile?.email || 'Unknown'
              const email = member.profile?.email || ''

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-4 opacity-60"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-500">
                      {name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <span className="font-medium">{name}</span>
                      <div className="flex items-center gap-2 text-sm text-text-muted">
                        <Mail className="h-3 w-3" />
                        {email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-gray-500">
                      Inactive
                    </Badge>

                    {isSuperadmin && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleReactivate(member.id, name)}
                        disabled={isLoading === member.id}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
