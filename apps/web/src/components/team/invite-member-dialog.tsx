'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button, Input, Label, Select } from '@/components/ui'
import { inviteTeamMember } from '@/app/actions/team'
import { useToast } from '@/components/ui/use-toast'
import type { UserRole } from '@/types'

interface InviteMemberDialogProps {
  onSuccess?: () => void
}

export function InviteMemberDialog({ onSuccess }: InviteMemberDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('employee')
  const [hourlyRate, setHourlyRate] = useState('')
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
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
        setIsOpen(false)
        setEmail('')
        setRole('employee')
        setHourlyRate('')
        onSuccess?.()
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
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        Invite Member
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Invite Team Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <p className="mt-1 text-xs text-text-muted">
              {role === 'employee' && 'Can track time and submit expenses'}
              {role === 'accountant' && 'Can manage documents and exports'}
              {role === 'superadmin' && 'Full access to all features'}
            </p>
          </div>

          <div>
            <Label htmlFor="hourlyRate">Default Hourly Rate (optional)</Label>
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

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !email.trim()}>
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
