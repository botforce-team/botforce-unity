-- ============================================================================
-- Schedule automatic Revolut sync every 6 hours
-- Uses pg_cron + pg_net to call the sync Edge Function
--
-- Prerequisites: Set these secrets in Supabase Dashboard > Vault:
--   - supabase_url: Your project URL (e.g., https://xxx.supabase.co)
--   - service_role_key: Your service role key
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function that reads secrets from vault and calls the Edge Function
CREATE OR REPLACE FUNCTION public.trigger_revolut_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  -- Read secrets from vault
  SELECT decrypted_secret INTO _supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url'
  LIMIT 1;

  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE WARNING 'Revolut sync skipped: vault secrets not configured';
    RETURN;
  END IF;

  -- Call the Edge Function
  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/sync-revolut-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule every 6 hours
SELECT cron.schedule(
  'revolut-sync-every-6h',
  '0 */6 * * *',
  'SELECT public.trigger_revolut_sync()'
);
