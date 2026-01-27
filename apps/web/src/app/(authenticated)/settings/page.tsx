import { createClient } from '@/lib/supabase/server'
import { CompanyInfoForm, AddressForm, ContactForm } from './settings-forms'

interface CompanyMembership {
  company_id: string
  role: string
}

export default async function SettingsPage() {
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
        <p className="text-[rgba(232,236,255,0.6)]">You don&apos;t have access to settings.</p>
      </div>
    )
  }

  // Fetch company details
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', membership.company_id)
    .single()

  if (!company) {
    return (
      <div className="py-12 text-center">
        <p className="text-[rgba(232,236,255,0.6)]">Company not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
          Manage your company settings
        </p>
      </div>

      <div className="grid gap-6">
        <CompanyInfoForm company={company} />
        <AddressForm company={company} />
        <ContactForm company={company} />
      </div>
    </div>
  )
}
