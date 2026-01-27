import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { Company, Profile, UserRole } from '@/types'

interface MembershipWithCompany {
  role: UserRole
  company: Company
}

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile and company membership
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null

  const { data: membershipsData } = await supabase
    .from('company_members')
    .select(
      `
      *,
      company:companies(*)
    `
    )
    .eq('user_id', user.id)
    .eq('is_active', true)

  const memberships = (membershipsData || []) as MembershipWithCompany[]
  const currentMembership = memberships[0]
  const currentCompany = currentMembership?.company
  const currentRole = currentMembership?.role

  return (
    <div className="min-h-screen">
      <Sidebar role={currentRole} />
      <div className="lg:pl-[220px]">
        <Header user={user} profile={profile} company={currentCompany} role={currentRole} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
