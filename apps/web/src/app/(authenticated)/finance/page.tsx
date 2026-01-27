import { createClient } from '@/lib/supabase/server'
import { FinanceDashboard } from './finance-dashboard'

interface CompanyMembership {
  company_id: string
  role: string
}

export default async function FinancePage() {
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

  if (!membership || (membership.role !== 'superadmin' && membership.role !== 'accountant')) {
    return (
      <div className="py-12 text-center">
        <p className="text-[rgba(232,236,255,0.6)]">
          You don&apos;t have access to financial reports.
        </p>
      </div>
    )
  }

  return <FinanceDashboard />
}
