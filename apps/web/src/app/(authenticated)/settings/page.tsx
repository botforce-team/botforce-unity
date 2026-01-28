import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getCompanyInfo, getUserProfile } from '@/app/actions/settings'
import { CompanyInfoForm, InvoiceSettingsForm, UserProfileForm } from './settings-forms'

export default async function SettingsPage() {
  const supabase = await createClient()

  // Get user role
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('is_active', true)
    .maybeSingle()

  const role = membership?.role || 'employee'
  const isSuperAdmin = role === 'superadmin'

  // Get company info (for superadmins)
  let companyInfo = null
  if (isSuperAdmin) {
    const companyResult = await getCompanyInfo()
    companyInfo = companyResult.data
  }

  // Get user profile
  const profileResult = await getUserProfile()
  const profile = profileResult.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-text-secondary mt-1">
            Manage your account and company settings
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="company">Company</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="invoicing">Invoicing</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          {profile && <UserProfileForm profile={profile} />}
        </TabsContent>

        {isSuperAdmin && companyInfo && (
          <TabsContent value="company" className="mt-6">
            <CompanyInfoForm company={companyInfo} />
          </TabsContent>
        )}

        {isSuperAdmin && companyInfo && (
          <TabsContent value="invoicing" className="mt-6">
            <InvoiceSettingsForm settings={companyInfo.settings} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
