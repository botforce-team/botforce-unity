-- ============================================================================
-- One-shot data fix: unlock the 4 time entries that were stranded on
-- INV-2026-0007 (cancelled invoice 81b52af4-373a-453d-b435-07735bb2db95).
--
-- The earlier deploy of cancelDocument shipped before the corresponding
-- trigger update (20260428210002), so the entries got left in approved
-- state with their document_id still set. Service-role REST calls can't
-- run this update because the trigger evaluates `is_superadmin()` against
-- `auth.uid()`, which is null on service-role traffic.
--
-- Run inside a transaction with `session_replication_role = replica` so
-- the user-level trigger is bypassed for this single statement only.
-- ============================================================================

BEGIN;
SET LOCAL session_replication_role = 'replica';

UPDATE time_entries
SET
  document_id      = NULL,
  status           = 'rejected',
  rejected_at      = NOW(),
  rejected_by      = '2498e3c6-e19a-4d7b-9d71-d080007debf6',
  rejection_reason = 'Invoice INV-2026-0007 cancelled (manual recovery: pre-trigger-update deploy)',
  approved_at      = NULL,
  approved_by      = NULL,
  updated_at       = NOW()
WHERE document_id = '81b52af4-373a-453d-b435-07735bb2db95'
  AND status = 'approved';

COMMIT;
