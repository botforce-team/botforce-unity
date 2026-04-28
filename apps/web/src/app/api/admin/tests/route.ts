import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  successResponse,
} from '@/lib/api-utils'
import { runSmokeTests } from '@/lib/tests/smoke-tests'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: unauthorizedResponse() }

  const admin = await createAdminClient()
  const { data: membership } = await admin
    .from('company_members')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membership?.role !== 'superadmin') {
    return { error: forbiddenResponse('Superadmin access required') }
  }
  return { userId: user.id }
}

export async function POST() {
  const auth = await requireSuperadmin()
  if (auth.error) return auth.error

  const admin = await createAdminClient()
  const startedAt = new Date().toISOString()

  const { data: run, error: insertErr } = await admin
    .from('test_runs')
    .insert({
      started_at: startedAt,
      status: 'running',
      triggered_by: auth.userId,
      trigger_source: 'manual',
    })
    .select('id')
    .single()

  if (insertErr || !run) {
    return errorResponse('Failed to record test run', 500, 'TEST_RUN_INSERT_FAILED')
  }

  const summary = await runSmokeTests()
  const finishedAt = new Date().toISOString()

  await admin
    .from('test_runs')
    .update({
      finished_at: finishedAt,
      duration_ms: summary.durationMs,
      total_tests: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      status: summary.failed > 0 ? 'failed' : 'passed',
      results: summary.results,
    })
    .eq('id', run.id)

  return successResponse({ runId: run.id, ...summary })
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperadmin()
  if (auth.error) return auth.error

  const limit = Math.min(
    Number(request.nextUrl.searchParams.get('limit') || 25),
    100
  )

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('test_runs')
    .select(
      'id, started_at, finished_at, duration_ms, total_tests, passed, failed, skipped, status, trigger_source, results, triggered_by'
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return errorResponse(error.message, 500, 'TEST_RUN_FETCH_FAILED')
  return successResponse({ runs: data ?? [] })
}
