import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getCompanyInfo, getUserProfile } from '@/app/actions/settings'
import { getRevolutConnection } from '@/app/actions/revolut'
import { CompanyInfoForm, InvoiceSettingsForm, UserProfileForm } from './settings-forms'
import { RevolutSettings } from '@/components/integrations/revolut-settings'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; success?: string; message?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get user role using admin client to bypass RLS
  const { data: membership } = await adminClient
    .from('company_members')
    .select('role')
    .eq('user_id', user?.id || '')
    .eq('is_active', true)
    .maybeSingle()

  const role = membership?.role || 'employee'
  const isSuperAdmin = role === 'superadmin'

  // Get company info (for superadmins)
  let companyInfo = null
  let companyError = null
  let revolutConnection = null
  if (isSuperAdmin) {
    const companyResult = await getCompanyInfo()
    companyInfo = companyResult.data
    if (!companyResult.success) {
      companyError = companyResult.error
      console.error('Failed to load company info:', companyResult.error)
    }

    // Get Revolut connection status
    const revolutResult = await getRevolutConnection()
    revolutConnection = revolutResult.data
  }

  // Get user profile
  const profileResult = await getUserProfile()
  const profile = profileResult.data

  // Determine default tab
  const defaultTab = params.tab || 'profile'

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

      {/* URL-based notifications */}
      {params.error && (
        <div className="p-4 bg-danger-muted text-danger rounded-lg">
          {params.error === 'already_connected' && 'Revolut is already connected.'}
          {params.error === 'oauth_denied' && `Connection was denied: ${params.message || 'Unknown error'}`}
          {params.error === 'state_mismatch' && 'Security validation failed. Please try again.'}
          {params.error === 'session_expired' && 'Session expired. Please try connecting again.'}
          {params.error === 'callback_failed' && 'Connection failed. Please try again.'}
          {!['already_connected', 'oauth_denied', 'state_mismatch', 'session_expired', 'callback_failed'].includes(params.error) && params.error}
        </div>
      )}

      {params.success && (
        <div className="p-4 bg-success-muted text-success rounded-lg">
          {params.success === 'revolut_connected' && 'Successfully connected to Revolut Business! Your data will sync automatically.'}
          {params.success !== 'revolut_connected' && params.success}
        </div>
      )}

      {/* Debug info - remove after fixing */}
      <div className="p-3 bg-yellow-100 text-yellow-800 rounded text-xs font-mono">
        <p>Debug: isSuperAdmin={String(isSuperAdmin)}, role={role}</p>
        <p>companyInfo={companyInfo ? 'loaded' : 'null'}, companyError={companyError || 'none'}</p>
        <p>user={user?.id ? 'authenticated' : 'not authenticated'}</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="company">Company</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="invoicing">Invoicing</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          {profile && <UserProfileForm profile={profile} />}
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="company" className="mt-6">
            {companyError ? (
              <div className="p-4 bg-danger-muted text-danger rounded-lg">
                Failed to load company info: {companyError}
              </div>
            ) : companyInfo ? (
              <CompanyInfoForm company={companyInfo} />
            ) : (
              <div className="p-4 text-text-muted">Loading...</div>
            )}
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="invoicing" className="mt-6">
            {companyError ? (
              <div className="p-4 bg-danger-muted text-danger rounded-lg">
                Failed to load company settings: {companyError}
              </div>
            ) : companyInfo ? (
              <InvoiceSettingsForm settings={companyInfo.settings} />
            ) : (
              <div className="p-4 text-text-muted">Loading...</div>
            )}
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="integrations" className="mt-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Integrations</h2>
                <p className="text-text-secondary text-sm">
                  Connect external services to enhance your workflow
                </p>
              </div>

              <RevolutSettings connection={revolutConnection || null} />

              {/* Placeholder for future integrations */}
              <div className="text-center py-8 text-text-muted text-sm border-2 border-dashed border-surface-border rounded-lg">
                More integrations coming soon
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
