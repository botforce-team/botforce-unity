-- Migration: 0007_audit.sql
-- Description: Audit log for important actions
-- BOTFORCE Unity

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Who
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_email VARCHAR(255), -- Snapshot in case user deleted

  -- What
  action audit_action NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,

  -- Details
  old_data JSONB,
  new_data JSONB,
  metadata JSONB DEFAULT '{}', -- Additional context

  -- IP/session info (if available)
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_audit_log_company ON audit_log(company_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_created ON audit_log(company_id, created_at DESC);
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);

-- ============================================================================
-- FUNCTION: Generic audit log insert
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_log_insert(
  p_company_id UUID,
  p_user_id UUID,
  p_action audit_action,
  p_table_name VARCHAR(100),
  p_record_id UUID,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_user_email VARCHAR(255);
  v_audit_id UUID;
BEGIN
  -- Get user email for snapshot
  SELECT email INTO v_user_email FROM profiles WHERE id = p_user_id;

  INSERT INTO audit_log (
    company_id, user_id, user_email, action, table_name, record_id,
    old_data, new_data, metadata
  ) VALUES (
    p_company_id, p_user_id, v_user_email, p_action, p_table_name, p_record_id,
    p_old_data, p_new_data, p_metadata
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER FUNCTION: Audit document status changes
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_document_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    PERFORM audit_log_insert(
      NEW.company_id,
      auth.uid(),
      'status_change',
      'documents',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      jsonb_build_object(
        'document_type', NEW.document_type,
        'document_number', NEW.document_number
      )
    );
  END IF;

  -- Log issue action specifically
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'issued' THEN
    PERFORM audit_log_insert(
      NEW.company_id,
      auth.uid(),
      'issue_document',
      'documents',
      NEW.id,
      NULL,
      jsonb_build_object(
        'document_number', NEW.document_number,
        'total', NEW.total,
        'customer_id', NEW.customer_id
      ),
      jsonb_build_object('document_type', NEW.document_type)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_document_changes_trigger
  AFTER UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION audit_document_changes();

-- ============================================================================
-- TRIGGER FUNCTION: Audit time entry approvals/rejections
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_time_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log approval
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status = 'submitted' THEN
    PERFORM audit_log_insert(
      NEW.company_id,
      auth.uid(),
      'approve_time',
      'time_entries',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'approved_by', NEW.approved_by),
      jsonb_build_object('hours', NEW.hours, 'project_id', NEW.project_id)
    );
  END IF;

  -- Log rejection
  IF TG_OP = 'UPDATE' AND NEW.status = 'rejected' THEN
    PERFORM audit_log_insert(
      NEW.company_id,
      auth.uid(),
      'reject_time',
      'time_entries',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'rejection_reason', NEW.rejection_reason),
      jsonb_build_object('hours', NEW.hours, 'project_id', NEW.project_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_time_entry_changes_trigger
  AFTER UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION audit_time_entry_changes();

-- ============================================================================
-- TRIGGER FUNCTION: Audit accounting export locks
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_export_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_locked = TRUE AND OLD.is_locked = FALSE THEN
    PERFORM audit_log_insert(
      NEW.company_id,
      auth.uid(),
      'lock_export',
      'accounting_exports',
      NEW.id,
      NULL,
      jsonb_build_object(
        'name', NEW.name,
        'period_start', NEW.period_start,
        'period_end', NEW.period_end
      ),
      jsonb_build_object(
        'invoice_count', NEW.invoice_count,
        'expense_count', NEW.expense_count
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_export_lock_trigger
  AFTER UPDATE ON accounting_exports
  FOR EACH ROW EXECUTE FUNCTION audit_export_lock();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE audit_log IS 'Immutable audit trail for important actions';
COMMENT ON FUNCTION audit_log_insert IS 'Helper to insert audit log entries with user snapshot';
