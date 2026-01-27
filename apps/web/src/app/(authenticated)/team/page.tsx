import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { InviteMemberDialog } from '@/components/team/invite-member-dialog'

interface CompanyMembership {
  company_id: string
  role: string
}

interface MemberWithProfile {
  id: string
  role: string
  hourly_rate: number | null
  is_active: boolean
  profile: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

function getRoleStyle(role: string) {
  switch (role) {
    case 'superadmin':
      return {
        background: 'rgba(168, 85, 247, 0.12)',
        border: '1px solid rgba(168, 85, 247, 0.35)',
        color: '#a855f7',
      }
    case 'employee':
      return {
        background: 'rgba(59, 130, 246, 0.12)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        color: '#3b82f6',
      }
    case 'accountant':
      return {
        background: 'rgba(34, 197, 94, 0.12)',
        border: '1px solid rgba(34, 197, 94, 0.35)',
        color: '#22c55e',
      }
    default:
      return {
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: 'rgba(255, 255, 255, 0.5)',
      }
  }
}

const roleLabels: Record<string, string> = {
  superadmin: 'Admin',
  employee: 'Employee',
  accountant: 'Accountant',
}

export default async function TeamPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Get user's company membership
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return (
      <div className="py-12 text-center">
        <p className="text-[rgba(232,236,255,0.6)]">
          You don&apos;t have access to team management.
        </p>
      </div>
    )
  }

  // Fetch team members
  const { data: membersData } = await supabase
    .from('company_members')
    .select(
      `
      *,
      profile:profiles(id, email, first_name, last_name, avatar_url)
    `
    )
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: true })

  const members = (membersData || []) as MemberWithProfile[]

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
            Manage team members and their roles
          </p>
        </div>
        <InviteMemberDialog />
      </div>

      <div className="overflow-hidden rounded-[18px]" style={cardStyle}>
        <div className="border-b p-5" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">Team Members</h2>
        </div>
        <div className="p-5">
          {!members || members.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[rgba(232,236,255,0.6)]">
              No team members yet.
            </p>
          ) : (
            <div className="space-y-1">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="-mx-3 flex items-center justify-between rounded-[12px] px-3 py-4 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                      }}
                    >
                      <span className="text-[13px] font-medium text-[rgba(232,236,255,0.7)]">
                        {member.profile?.first_name?.[0] ||
                          member.profile?.email?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-white">
                        {member.profile?.first_name && member.profile?.last_name
                          ? `${member.profile.first_name} ${member.profile.last_name}`
                          : member.profile?.email}
                      </p>
                      <p className="text-[12px] text-[rgba(232,236,255,0.5)]">
                        {member.profile?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={getRoleStyle(member.role)}
                    >
                      {roleLabels[member.role]}
                    </span>
                    {member.hourly_rate && (
                      <span className="text-[12px] text-[rgba(232,236,255,0.5)]">
                        {formatCurrency(member.hourly_rate)}/hr
                      </span>
                    )}
                    {!member.is_active && (
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: 'rgba(255, 255, 255, 0.5)',
                        }}
                      >
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
