-- ============================================================================
-- Allow `approved -> rejected` transition on time_entries.
--
-- Used by the void-issued-invoice flow: when a superadmin cancels an issued
-- invoice, the linked time entries need to become editable again. The
-- existing state machine only allowed `approved -> invoiced`, which left
-- approved-and-linked entries permanently stuck after a cancellation.
--
-- The new transition requires (a) superadmin and (b) a non-empty
-- rejection_reason — same guards as `submitted -> rejected`.
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_time_entry_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Valid transitions:
  -- draft -> submitted (by owner)
  -- draft -> draft (edit by owner)
  -- submitted -> approved (by superadmin)
  -- submitted -> rejected (by superadmin)
  -- rejected -> draft (by owner to edit)
  -- rejected -> submitted (by owner to resubmit)
  -- approved -> invoiced (by system when added to invoice)
  -- approved -> rejected (by superadmin, e.g. when an issued invoice is voided)

  IF OLD.status = NEW.status THEN
    -- No status change, allow other field updates if in editable status
    IF OLD.status NOT IN ('draft', 'rejected') AND NOT is_superadmin() THEN
      RAISE EXCEPTION 'Cannot modify time entry in % status', OLD.status;
    END IF;
    RETURN NEW;
  END IF;

  -- Validate transitions
  CASE OLD.status
    WHEN 'draft' THEN
      IF NEW.status NOT IN ('submitted') THEN
        RAISE EXCEPTION 'Invalid transition from draft to %', NEW.status;
      END IF;
      NEW.submitted_at := NOW();

    WHEN 'submitted' THEN
      IF NEW.status = 'approved' THEN
        IF NOT is_superadmin() THEN
          RAISE EXCEPTION 'Only superadmins can approve time entries';
        END IF;
        NEW.approved_at := NOW();
        NEW.approved_by := auth.uid();
        IF NEW.hourly_rate IS NULL THEN
          SELECT COALESCE(
            pa.hourly_rate_override,
            p.hourly_rate,
            cm.hourly_rate
          ) INTO NEW.hourly_rate
          FROM projects p
          LEFT JOIN project_assignments pa ON pa.project_id = p.id AND pa.user_id = NEW.user_id AND pa.is_active
          LEFT JOIN company_members cm ON cm.user_id = NEW.user_id AND cm.company_id = NEW.company_id AND cm.is_active
          WHERE p.id = NEW.project_id;
        END IF;

      ELSIF NEW.status = 'rejected' THEN
        IF NOT is_superadmin() THEN
          RAISE EXCEPTION 'Only superadmins can reject time entries';
        END IF;
        NEW.rejected_at := NOW();
        NEW.rejected_by := auth.uid();
        IF NEW.rejection_reason IS NULL OR NEW.rejection_reason = '' THEN
          RAISE EXCEPTION 'Rejection reason is required';
        END IF;

      ELSE
        RAISE EXCEPTION 'Invalid transition from submitted to %', NEW.status;
      END IF;

    WHEN 'rejected' THEN
      IF NEW.status NOT IN ('draft', 'submitted') THEN
        RAISE EXCEPTION 'Invalid transition from rejected to %', NEW.status;
      END IF;
      IF NEW.status = 'submitted' THEN
        NEW.submitted_at := NOW();
      END IF;
      NEW.rejected_at := NULL;
      NEW.rejected_by := NULL;
      NEW.rejection_reason := NULL;

    WHEN 'approved' THEN
      IF NEW.status = 'invoiced' THEN
        NEW.invoiced_at := NOW();
      ELSIF NEW.status = 'rejected' THEN
        IF NOT is_superadmin() THEN
          RAISE EXCEPTION 'Only superadmins can revert approved time entries';
        END IF;
        IF NEW.rejection_reason IS NULL OR NEW.rejection_reason = '' THEN
          RAISE EXCEPTION 'Rejection reason is required';
        END IF;
        NEW.rejected_at := NOW();
        NEW.rejected_by := auth.uid();
        -- Clear approval fields so the entry has to go back through approval
        NEW.approved_at := NULL;
        NEW.approved_by := NULL;
      ELSE
        RAISE EXCEPTION 'Invalid transition from approved to %', NEW.status;
      END IF;

    WHEN 'invoiced' THEN
      RAISE EXCEPTION 'Invoiced time entries cannot be modified';

    ELSE
      RAISE EXCEPTION 'Unknown status %', OLD.status;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
