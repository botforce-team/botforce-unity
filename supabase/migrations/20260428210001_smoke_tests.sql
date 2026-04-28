-- ============================================================================
-- Smoke Test Run History
-- Tracks results of admin-triggered, CI-triggered, and cron-triggered runs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  total_tests INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'passed', 'failed')),
  triggered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  trigger_source TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('manual', 'ci', 'cron')),
  results JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_runs_created ON test_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_runs_source_created ON test_runs(trigger_source, created_at DESC);

ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;

-- Only superadmins read history. Writes go through the service role key
-- (server-side API routes), bypassing RLS, so no INSERT policy is needed.
DROP POLICY IF EXISTS "Superadmins can view test runs" ON test_runs;
CREATE POLICY "Superadmins can view test runs"
  ON test_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role = 'superadmin'
        AND cm.is_active = true
    )
  );

-- ============================================================================
-- Hourly cron: hit the CI endpoint to run smoke tests against production.
-- Requires vault secrets:
--   - app_url           e.g. https://app.botforce.at
--   - ci_test_secret    must match CI_TEST_SECRET env var on the deployment
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_smoke_tests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _app_url text;
  _secret text;
BEGIN
  SELECT decrypted_secret INTO _app_url
  FROM vault.decrypted_secrets WHERE name = 'app_url' LIMIT 1;

  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets WHERE name = 'ci_test_secret' LIMIT 1;

  IF _app_url IS NULL OR _secret IS NULL THEN
    RAISE WARNING 'Smoke tests skipped: vault secrets not configured (app_url, ci_test_secret)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := _app_url || '/api/admin/tests/ci',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _secret,
      'X-Trigger-Source', 'cron'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
END;
$$;

SELECT cron.schedule(
  'smoke-tests-hourly',
  '0 * * * *',
  'SELECT public.trigger_smoke_tests()'
);
