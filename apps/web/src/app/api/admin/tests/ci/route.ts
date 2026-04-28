import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { runSmokeTests } from '@/lib/tests/smoke-tests'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

/**
 * Shared-secret-gated endpoint for CI and pg_cron.
 * Bypasses Supabase auth (no logged-in user). Authorization header
 * must carry `Bearer <CI_TEST_SECRET>` matching the server env var.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CI_TEST_SECRET
  if (!expected) {
    return errorResponse('CI_TEST_SECRET not configured', 500, 'NOT_CONFIGURED')
  }

  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || token !== expected) {
    return unauthorizedResponse('Invalid CI bearer token')
  }

  const triggerSource = request.headers.get('x-trigger-source') === 'cron' ? 'cron' : 'ci'

  const admin = await createAdminClient()
  const { data: run, error: insertErr } = await admin
    .from('test_runs')
    .insert({
      started_at: new Date().toISOString(),
      status: 'running',
      trigger_source: triggerSource,
    })
    .select('id')
    .single()

  if (insertErr || !run) {
    return errorResponse('Failed to record test run', 500, 'TEST_RUN_INSERT_FAILED')
  }

  const summary = await runSmokeTests()

  await admin
    .from('test_runs')
    .update({
      finished_at: new Date().toISOString(),
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
