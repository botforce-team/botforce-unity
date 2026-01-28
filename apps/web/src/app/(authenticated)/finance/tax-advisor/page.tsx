import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TaxAdvisorChat } from './tax-advisor-chat'
import { env } from '@/lib/env'

export default async function TaxAdvisorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check role
  const adminClient = await createAdminClient()
  const { data: membership } = await adminClient
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  // Only superadmin and accountant can access
  if (!membership || !['superadmin', 'accountant'].includes(membership.role)) {
    redirect('/finance')
  }

  const hasApiKey = !!env.ANTHROPIC_API_KEY

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Tax Advisor</h1>
        <p className="text-text-secondary mt-1">
          Get personalized tax advice based on Austrian law
        </p>
      </div>

      {!hasApiKey ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <h2 className="text-lg font-medium mb-2">AI Tax Advisor is not configured</h2>
          <p className="text-text-muted mb-4">
            To enable AI-powered tax advice, please add your Anthropic API key to the environment variables.
          </p>
          <p className="text-sm text-text-muted">
            Add <code className="bg-background px-1 rounded">ANTHROPIC_API_KEY</code> to your environment.
          </p>
        </div>
      ) : (
        <TaxAdvisorChat />
      )}

      <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
        <p className="text-sm text-warning">
          <strong>Disclaimer:</strong> This AI assistant provides informational guidance based on Austrian tax law.
          It is not a substitute for professional advice. For official tax matters, please consult a certified
          Steuerberater (tax advisor) or contact your local Finanzamt.
        </p>
      </div>
    </div>
  )
}
