import { createClient } from '@/lib/supabase/server'
import { FinanceDashboard } from './finance-dashboard'

export default async function FinancePage() {
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

  if (!membership || (membership.role !== 'superadmin' && membership.role !== 'accountant')) {
    return (
      <div className="text-center py-12">
        <p className="text-[rgba(232,236,255,0.6)]">You don't have access to financial reports.</p>
      </div>
    )
  }

  return <FinanceDashboard />
}
