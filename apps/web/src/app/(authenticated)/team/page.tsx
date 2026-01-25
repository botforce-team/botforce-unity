import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, UserPlus } from 'lucide-react'

export default async function TeamPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get user's company membership
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">You don't have access to team management.</p>
      </div>
    )
  }

  // Fetch team members
  const { data: members } = await supabase
    .from('company_members')
    .select(`
      *,
      profile:profiles(id, email, first_name, last_name, avatar_url)
    `)
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: true })

  const roleLabels: Record<string, string> = {
    superadmin: 'Admin',
    employee: 'Employee',
    accountant: 'Accountant',
  }

  const roleBadgeColors: Record<string, string> = {
    superadmin: 'bg-purple-100 text-purple-800',
    employee: 'bg-blue-100 text-blue-800',
    accountant: 'bg-green-100 text-green-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage team members and their roles
          </p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {!members || members.length === 0 ? (
            <p className="text-center text-gray-600 py-8">
              No team members yet.
            </p>
          ) : (
            <div className="divide-y">
              {members.map((member) => (
                <div key={member.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {member.profile?.first_name?.[0] || member.profile?.email?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {member.profile?.first_name && member.profile?.last_name
                          ? `${member.profile.first_name} ${member.profile.last_name}`
                          : member.profile?.email}
                      </p>
                      <p className="text-sm text-gray-500">{member.profile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={roleBadgeColors[member.role]}>
                      {roleLabels[member.role]}
                    </Badge>
                    {member.hourly_rate && (
                      <span className="text-sm text-gray-500">
                        €{member.hourly_rate}/hr
                      </span>
                    )}
                    {!member.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
