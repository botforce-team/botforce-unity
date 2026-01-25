-- Migration: 0003_time_entries.sql
-- Description: Time tracking entries with workflow
-- BOTFORCE Unity

-- ============================================================================
-- TIME ENTRIES
-- ============================================================================

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Time data
  date DATE NOT NULL,
  hours DECIMAL(5, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),

  -- Description
  description TEXT,

  -- Billing
  is_billable BOOLEAN DEFAULT TRUE NOT NULL,
  hourly_rate DECIMAL(10, 2), -- Rate at time of entry (can be null until approved)

  -- Workflow
  status time_entry_status DEFAULT 'draft' NOT NULL,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,

  -- Invoice link (set when invoiced)
  document_id UUID, -- FK added after documents table exists
  document_line_id UUID,
  invoiced_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_time_entries_company_id ON time_entries(company_id);
CREATE INDEX idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);
CREATE INDEX idx_time_entries_status ON time_entries(status);
CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, date);
CREATE INDEX idx_time_entries_project_status ON time_entries(project_id, status);
CREATE INDEX idx_time_entries_company_date_status ON time_entries(company_id, date, status);

-- Composite index for common queries
CREATE INDEX idx_time_entries_approval_queue ON time_entries(company_id, status, submitted_at)
  WHERE status = 'submitted';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER: Ensure time_entries.company_id matches project.company_id
-- ============================================================================

CREATE OR REPLACE FUNCTION check_time_entry_company()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id != (SELECT company_id FROM projects WHERE id = NEW.project_id) THEN
    RAISE EXCEPTION 'Time entry company_id must match project company_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_time_entry_company
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION check_time_entry_company();

-- ============================================================================
-- HELPER: Validate status transitions
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_time_entry_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow any transition for new records
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Check valid transitions
  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Draft entries can only transition to submitted';
  END IF;

  IF OLD.status = 'submitted' AND NEW.status NOT IN ('submitted', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Submitted entries can only transition to approved or rejected';
  END IF;

  IF OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'invoiced', 'rejected') THEN
    RAISE EXCEPTION 'Approved entries can only transition to invoiced or rejected';
  END IF;

  IF OLD.status = 'rejected' AND NEW.status NOT IN ('rejected', 'draft') THEN
    RAISE EXCEPTION 'Rejected entries can only transition back to draft';
  END IF;

  IF OLD.status = 'invoiced' THEN
    RAISE EXCEPTION 'Invoiced entries cannot change status';
  END IF;

  -- Set timestamps based on transition
  IF NEW.status = 'submitted' AND OLD.status != 'submitted' THEN
    NEW.submitted_at = NOW();
  END IF;

  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    NEW.approved_at = NOW();
    NEW.rejected_at = NULL;
    NEW.rejected_by = NULL;
    NEW.rejection_reason = NULL;
  END IF;

  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    NEW.rejected_at = NOW();
    NEW.approved_at = NULL;
    NEW.approved_by = NULL;
  END IF;

  IF NEW.status = 'draft' AND OLD.status = 'rejected' THEN
    -- Reset for resubmission
    NEW.submitted_at = NULL;
    NEW.rejected_at = NULL;
    NEW.rejected_by = NULL;
    NEW.rejection_reason = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_time_entry_status
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION validate_time_entry_status_transition();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE time_entries IS 'Time tracking entries with approval workflow';
COMMENT ON COLUMN time_entries.status IS 'Workflow: draft -> submitted -> approved -> invoiced, with rejected branching';
COMMENT ON COLUMN time_entries.hourly_rate IS 'Rate snapshot, populated when approved based on project/user rate';
