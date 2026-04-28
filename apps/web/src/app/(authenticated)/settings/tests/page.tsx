import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { TestsClient } from './tests-client'

export const dynamic = 'force-dynamic'

interface TestRunRow {
  id: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  total_tests: number
  passed: number
  failed: number
  skipped: number
  status: 'running' | 'passed' | 'failed'
  trigger_source: 'manual' | 'ci' | 'cron'
  triggered_by: string | null
  results: Array<{
    name: string
    category: string
    status: 'passed' | 'failed' | 'skipped'
    durationMs: number
    message?: string
    details?: Record<string, unknown>
  }>
}

export default async function TestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = await createAdminClient()
  const { data: membership } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membership?.role !== 'superadmin') {
    redirect('/dashboard')
  }

  const { data: runs } = await admin
    .from('test_runs')
    .select(
      'id, started_at, finished_at, duration_ms, total_tests, passed, failed, skipped, status, trigger_source, triggered_by, results'
    )
    .order('created_at', { ascending: false })
    .limit(25)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Smoke Tests</h1>
        <p className="text-text-secondary mt-1">
          Verify that critical paths still work after deploys. Tests are read-only and safe to run anytime.
        </p>
      </div>
      <TestsClient initialRuns={(runs ?? []) as TestRunRow[]} />
    </div>
  )
}
