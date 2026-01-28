import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { TeamMembersList } from './team-members-list'
import type { CompanyMember, Profile } from '@/types'

interface TeamMemberWithProfile extends Omit<CompanyMember, 'profile'> {
  profile: Profile | null
}

export default async function TeamPage() {
  const client = await createClient()
  const supabase = await createAdminClient()

  const { data: { user } } = await client.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's membership to check role and company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Team</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-text-muted">No company membership found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isSuperadmin = membership.role === 'superadmin'

  // Get all team members
  const { data: members } = await supabase
    .from('company_members')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: true })

  const teamMembers = (members || []) as TeamMemberWithProfile[]
  const activeCount = teamMembers.filter(m => m.is_active).length
  const inactiveCount = teamMembers.filter(m => !m.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-text-muted">
            Manage your team members and their access
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{teamMembers.length}</div>
            <p className="text-sm text-text-muted">Total Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <p className="text-sm text-text-muted">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-400">{inactiveCount}</div>
            <p className="text-sm text-text-muted">Inactive</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Team Members</CardTitle>
            <div className="flex items-center gap-2">
              {!isSuperadmin && (
                <Badge variant="secondary">View Only</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TeamMembersList
            members={teamMembers}
            currentUserId={user.id}
            isSuperadmin={isSuperadmin}
          />
        </CardContent>
      </Card>
    </div>
  )
}
