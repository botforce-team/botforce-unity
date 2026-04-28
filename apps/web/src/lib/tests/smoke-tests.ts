/**
 * Smoke Test Suite
 *
 * SAFETY:
 *   - This suite is READ-ONLY. It never inserts, updates, or deletes
 *     business data. The only writes happen to `test_runs` (run history),
 *     which is owned by this feature.
 *   - The fixture user/company below is the production single-tenant
 *     superadmin. Do NOT add tests that mutate data scoped to it — there
 *     is no separate test tenant.
 *   - Each individual test must complete in < 10s. The whole suite in < 60s.
 *   - All tests catch their own errors and report status. They never throw.
 */

import { createAdminClient } from '@/lib/supabase/server'

// Hardcoded fixture IDs — known production rows used as read-only assertions.
// Confirms shape & RBAC, never written to.
export const TEST_ACCOUNT_PRIMARY = '2498e3c6-e19a-4d7b-9d71-d080007debf6'
export const TEST_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

const TEST_TIMEOUT_MS = 10_000

export interface TestResult {
  name: string
  category: string
  status: 'passed' | 'failed' | 'skipped'
  durationMs: number
  message?: string
  details?: Record<string, unknown>
}

interface TestOutcome {
  pass: boolean
  message?: string
  details?: Record<string, unknown>
  skipped?: boolean
}

interface Test {
  name: string
  category: string
  fn: () => Promise<TestOutcome>
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

async function runTest(test: Test): Promise<TestResult> {
  const start = Date.now()
  try {
    const result = await withTimeout(test.fn(), TEST_TIMEOUT_MS, test.name)
    return {
      name: test.name,
      category: test.category,
      status: result.skipped ? 'skipped' : result.pass ? 'passed' : 'failed',
      durationMs: Date.now() - start,
      message: result.message,
      details: result.details,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      name: test.name,
      category: test.category,
      status: 'failed',
      durationMs: Date.now() - start,
      message,
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

const tests: Test[] = [
  // -------------------------------------------------------------------------
  // Infrastructure
  // -------------------------------------------------------------------------
  {
    name: 'Required env vars set',
    category: 'Infrastructure',
    fn: async () => {
      const required = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ]
      const missing = required.filter((k) => !process.env[k])
      return {
        pass: missing.length === 0,
        message: missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'All present',
      }
    },
  },
  {
    name: 'Supabase reachable (auth)',
    category: 'Infrastructure',
    fn: async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!url) return { pass: false, message: 'NEXT_PUBLIC_SUPABASE_URL missing' }
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' },
      })
      return { pass: res.ok, message: `auth/v1/health → ${res.status}` }
    },
  },
  {
    name: 'Database query round-trip',
    category: 'Infrastructure',
    fn: async () => {
      const admin = await createAdminClient()
      const { count, error } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      if (error) return { pass: false, message: error.message }
      return { pass: typeof count === 'number', details: { profile_count: count } }
    },
  },

  // -------------------------------------------------------------------------
  // Test fixtures (known rows must exist)
  // -------------------------------------------------------------------------
  {
    name: 'Fixture profile exists',
    category: 'Fixtures',
    fn: async () => {
      const admin = await createAdminClient()
      const { data, error } = await admin
        .from('profiles')
        .select('id, email')
        .eq('id', TEST_ACCOUNT_PRIMARY)
        .maybeSingle()
      if (error) return { pass: false, message: error.message }
      return {
        pass: !!data,
        message: data ? `Found ${data.email}` : 'Profile not found',
      }
    },
  },
  {
    name: 'Fixture has active superadmin membership',
    category: 'Fixtures',
    fn: async () => {
      const admin = await createAdminClient()
      const { data, error } = await admin
        .from('company_members')
        .select('role, is_active, company_id')
        .eq('user_id', TEST_ACCOUNT_PRIMARY)
        .eq('is_active', true)
        .maybeSingle()
      if (error) return { pass: false, message: error.message }
      const ok = data?.role === 'superadmin' && data.company_id === TEST_COMPANY_ID
      return {
        pass: ok,
        message: ok ? 'Superadmin OK' : `Got role=${data?.role}, company=${data?.company_id}`,
      }
    },
  },
  {
    name: 'Fixture company exists',
    category: 'Fixtures',
    fn: async () => {
      const admin = await createAdminClient()
      const { data, error } = await admin
        .from('companies')
        .select('id, name, legal_name')
        .eq('id', TEST_COMPANY_ID)
        .maybeSingle()
      if (error) return { pass: false, message: error.message }
      return {
        pass: !!data,
        message: data ? `Found ${data.name}` : 'Company not found',
      }
    },
  },

  // -------------------------------------------------------------------------
  // Schema integrity (critical tables/views/types reachable)
  // -------------------------------------------------------------------------
  ...(
    [
      'profiles',
      'companies',
      'company_members',
      'team_invites',
      'customers',
      'projects',
      'project_assignments',
      'time_entries',
      'expenses',
      'documents',
      'document_lines',
      'files',
      'accounting_exports',
      'audit_log',
      'revolut_connections',
      'revolut_accounts',
      'revolut_transactions',
      'test_runs',
    ] as const
  ).map<Test>((table) => ({
    name: `Table "${table}" reachable`,
    category: 'Schema',
    fn: async () => {
      const admin = await createAdminClient()
      const { error } = await admin.from(table).select('*', { count: 'exact', head: true })
      if (error) return { pass: false, message: error.message }
      return { pass: true }
    },
  })),

  // -------------------------------------------------------------------------
  // Storage buckets
  // -------------------------------------------------------------------------
  {
    name: 'Storage bucket "receipts" exists',
    category: 'Storage',
    fn: async () => {
      const admin = await createAdminClient()
      const { data, error } = await admin.storage.getBucket('receipts')
      if (error) return { pass: false, message: error.message }
      return { pass: !!data, details: { id: data?.id, public: data?.public } }
    },
  },
  {
    name: 'Storage bucket "company-assets" exists',
    category: 'Storage',
    fn: async () => {
      const admin = await createAdminClient()
      const { data, error } = await admin.storage.getBucket('company-assets')
      if (error) return { pass: false, message: error.message }
      return { pass: !!data, details: { id: data?.id, public: data?.public } }
    },
  },

  // -------------------------------------------------------------------------
  // Public routing / middleware behavior
  // -------------------------------------------------------------------------
  {
    name: 'Login page renders (public)',
    category: 'Routing',
    fn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(`${baseUrl}/login`, { redirect: 'manual' })
      return {
        pass: res.status === 200,
        message: `GET /login → ${res.status}`,
      }
    },
  },
  {
    name: 'Protected route redirects when unauthenticated',
    category: 'Routing',
    fn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual' })
      const location = res.headers.get('location') || ''
      const ok = (res.status === 307 || res.status === 302) && location.includes('/login')
      return {
        pass: ok,
        message: `GET /dashboard → ${res.status} ${location}`,
      }
    },
  },

  // -------------------------------------------------------------------------
  // Cron / webhook endpoints (auth boundary check, not full execution)
  // -------------------------------------------------------------------------
  {
    name: 'Smoke-test CI endpoint rejects unauthenticated',
    category: 'Cron/Webhooks',
    fn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(`${baseUrl}/api/admin/tests/ci`, { method: 'POST' })
      return {
        pass: res.status === 401 || res.status === 403,
        message: `POST without auth → ${res.status}`,
      }
    },
  },
  {
    name: 'Smoke-test CI endpoint rejects bad bearer',
    category: 'Cron/Webhooks',
    fn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(`${baseUrl}/api/admin/tests/ci`, {
        method: 'POST',
        headers: { authorization: 'Bearer not-the-real-secret' },
      })
      return {
        pass: res.status === 401 || res.status === 403,
        message: `POST bad bearer → ${res.status}`,
      }
    },
  },

  // -------------------------------------------------------------------------
  // External services (lightweight probes)
  // -------------------------------------------------------------------------
  {
    name: 'Resend API reachable',
    category: 'External Services',
    fn: async () => {
      const key = process.env.RESEND_API_KEY
      if (!key) return { skipped: true, pass: true, message: 'RESEND_API_KEY not configured' }
      // Probe to the test address — Resend accepts but does not deliver.
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: 'delivered@resend.dev',
          subject: 'Smoke test probe',
          text: 'probe',
        }),
      })
      return {
        pass: res.ok,
        message: `Resend → ${res.status}`,
      }
    },
  },
  {
    name: 'Anthropic API reachable',
    category: 'External Services',
    fn: async () => {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) return { skipped: true, pass: true, message: 'ANTHROPIC_API_KEY not configured' }
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      })
      return {
        pass: res.ok,
        message: `Anthropic → ${res.status}`,
      }
    },
  },
  {
    name: 'Revolut sync log table reachable',
    category: 'External Services',
    fn: async () => {
      const admin = await createAdminClient()
      const { error } = await admin
        .from('revolut_sync_log')
        .select('*', { count: 'exact', head: true })
      if (error) return { pass: false, message: error.message }
      return { pass: true }
    },
  },

  // -------------------------------------------------------------------------
  // Domain integrity (read-only sanity checks)
  // -------------------------------------------------------------------------
  {
    name: 'No locked exports in pending state',
    category: 'Data Integrity',
    fn: async () => {
      const admin = await createAdminClient()
      const { data, error } = await admin
        .from('accounting_exports')
        .select('id')
        .eq('is_locked', true)
        .eq('status', 'pending')
      if (error) return { pass: false, message: error.message }
      return {
        pass: (data?.length ?? 0) === 0,
        message: `Found ${data?.length ?? 0} locked-but-pending exports`,
      }
    },
  },
  {
    name: 'Issued documents have a document_number',
    category: 'Data Integrity',
    fn: async () => {
      const admin = await createAdminClient()
      const { data, error } = await admin
        .from('documents')
        .select('id')
        .neq('status', 'draft')
        .is('document_number', null)
      if (error) return { pass: false, message: error.message }
      return {
        pass: (data?.length ?? 0) === 0,
        message: `Found ${data?.length ?? 0} non-draft docs without a number`,
      }
    },
  },
  {
    name: 'No orphaned time entries (project_id missing project)',
    category: 'Data Integrity',
    fn: async () => {
      const admin = await createAdminClient()
      const { data, error } = await admin
        .from('time_entries')
        .select('id, project:projects(id)')
        .is('project.id', null)
        .limit(1)
      if (error) return { pass: false, message: error.message }
      return {
        pass: (data?.length ?? 0) === 0,
        message: `Found ${data?.length ?? 0} time entries with missing project`,
      }
    },
  },
]

export async function runSmokeTests(): Promise<{
  total: number
  passed: number
  failed: number
  skipped: number
  durationMs: number
  results: TestResult[]
}> {
  const start = Date.now()
  const results: TestResult[] = []
  for (const test of tests) {
    results.push(await runTest(test))
  }
  return {
    total: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    durationMs: Date.now() - start,
    results,
  }
}
