-- ============================================================================
-- TIME ENTRY STATUS ENUM
-- ============================================================================
CREATE TYPE time_entry_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'invoiced');

-- ============================================================================
-- TIME_ENTRIES TABLE
-- ============================================================================
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  hours DECIMAL(5, 2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER DEFAULT 0 CHECK (break_minutes >= 0),
  description TEXT,
  is_billable BOOLEAN NOT NULL DEFAULT TRUE,
  hourly_rate DECIMAL(15, 2),
  status time_entry_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  document_id UUID,
  invoiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_time_entries_company ON time_entries(company_id);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_date ON time_entries(company_id, date);
CREATE INDEX idx_time_entries_status ON time_entries(company_id, status);
CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, date);
CREATE INDEX idx_time_entries_approval_queue ON time_entries(company_id, status) WHERE status = 'submitted';

-- Enable RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TIME ENTRIES RLS POLICIES
-- ============================================================================

-- Superadmins can view all time entries
CREATE POLICY "Superadmins can view all time entries"
  ON time_entries FOR SELECT
  USING (company_id = get_user_company_id() AND is_superadmin());

-- Employees can view their own time entries
CREATE POLICY "Employees can view own time entries"
  ON time_entries FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND user_id = auth.uid()
  );

-- Employees can insert time entries for assigned projects
CREATE POLICY "Users can insert time entries"
  ON time_entries FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND user_id = auth.uid()
    AND (is_superadmin() OR is_assigned_to_project(project_id))
  );

-- Users can update their own draft/rejected entries
CREATE POLICY "Users can update own draft/rejected entries"
  ON time_entries FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND user_id = auth.uid()
    AND status IN ('draft', 'rejected')
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND user_id = auth.uid()
    AND status IN ('draft', 'rejected', 'submitted')
  );

-- Superadmins can update any entry (for approval/rejection)
CREATE POLICY "Superadmins can update all time entries"
  ON time_entries FOR UPDATE
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

-- Users can delete their own draft entries
CREATE POLICY "Users can delete own draft entries"
  ON time_entries FOR DELETE
  USING (
    company_id = get_user_company_id()
    AND user_id = auth.uid()
    AND status = 'draft'
  );

-- Superadmins can delete draft entries
CREATE POLICY "Superadmins can delete draft entries"
  ON time_entries FOR DELETE
  USING (
    company_id = get_user_company_id()
    AND is_superadmin()
    AND status = 'draft'
  );

-- ============================================================================
-- TIME ENTRY STATUS MACHINE TRIGGER
-- Enforces valid status transitions and captures timestamps
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
        -- Capture rate snapshot on approval
        IF NEW.hourly_rate IS NULL THEN
          -- Rate priority: assignment override > project rate > member default
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
      -- Clear rejection fields when moving out of rejected
      NEW.rejected_at := NULL;
      NEW.rejected_by := NULL;
      NEW.rejection_reason := NULL;

    WHEN 'approved' THEN
      IF NEW.status = 'invoiced' THEN
        NEW.invoiced_at := NOW();
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

CREATE TRIGGER enforce_time_entry_status_trigger
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION enforce_time_entry_status();

-- ============================================================================
-- TRIGGER: Calculate hours from start/end time
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_time_entry_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- If start_time and end_time are provided, calculate hours
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0
                 - COALESCE(NEW.break_minutes, 0) / 60.0;
    -- Ensure non-negative
    IF NEW.hours < 0 THEN
      NEW.hours := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_time_entry_hours_trigger
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_time_entry_hours();

-- Apply updated_at trigger
CREATE TRIGGER set_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
