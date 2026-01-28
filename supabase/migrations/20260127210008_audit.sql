-- ============================================================================
-- AUDIT ACTION ENUM
-- ============================================================================
CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'status_change',
  'issue',
  'approve',
  'reject',
  'lock'
);

-- ============================================================================
-- AUDIT_LOG TABLE
-- Immutable log of all critical actions
-- ============================================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action audit_action NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_audit_log_company ON audit_log(company_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_table ON audit_log(company_id, table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_created ON audit_log(company_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(company_id, action);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- AUDIT LOG RLS POLICIES
-- Only superadmins can view audit logs
-- ============================================================================
CREATE POLICY "Superadmins can view audit logs"
  ON audit_log FOR SELECT
  USING (company_id = get_user_company_id() AND is_superadmin());

-- Audit logs are insert-only (no updates or deletes allowed)
CREATE POLICY "System can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

-- ============================================================================
-- FUNCTION: Create audit log entry
-- ============================================================================
CREATE OR REPLACE FUNCTION create_audit_log(
  p_action audit_action,
  p_table_name TEXT,
  p_record_id UUID,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO audit_log (
    company_id,
    user_id,
    user_email,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    metadata
  )
  VALUES (
    get_user_company_id(),
    auth.uid(),
    v_user_email,
    p_action,
    p_table_name,
    p_record_id,
    p_old_data,
    p_new_data,
    p_metadata
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUDIT TRIGGERS FOR CRITICAL TABLES
-- ============================================================================

-- Customers audit
CREATE OR REPLACE FUNCTION audit_customers()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create',
      'customers',
      NEW.id,
      NULL,
      to_jsonb(NEW),
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update',
      'customers',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      NULL
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete',
      'customers',
      OLD.id,
      to_jsonb(OLD),
      NULL,
      NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_customers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION audit_customers();

-- Projects audit
CREATE OR REPLACE FUNCTION audit_projects()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'projects', NEW.id, NULL, to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'projects', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'projects', OLD.id, to_jsonb(OLD), NULL, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_projects_trigger
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION audit_projects();

-- Documents audit
CREATE OR REPLACE FUNCTION audit_documents()
RETURNS TRIGGER AS $$
DECLARE
  v_action audit_action;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'documents', NEW.id, NULL, to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine specific action based on status change
    IF OLD.status != NEW.status THEN
      CASE NEW.status
        WHEN 'issued' THEN v_action := 'issue';
        ELSE v_action := 'status_change';
      END CASE;
    ELSIF OLD.is_locked != NEW.is_locked AND NEW.is_locked THEN
      v_action := 'lock';
    ELSE
      v_action := 'update';
    END IF;
    PERFORM create_audit_log(v_action, 'documents', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'documents', OLD.id, to_jsonb(OLD), NULL, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_documents_trigger
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION audit_documents();

-- Time entries audit (status changes only)
CREATE OR REPLACE FUNCTION audit_time_entries()
RETURNS TRIGGER AS $$
DECLARE
  v_action audit_action;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'time_entries', NEW.id, NULL, to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      CASE NEW.status
        WHEN 'approved' THEN v_action := 'approve';
        WHEN 'rejected' THEN v_action := 'reject';
        ELSE v_action := 'status_change';
      END CASE;
      PERFORM create_audit_log(v_action, 'time_entries', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'time_entries', OLD.id, to_jsonb(OLD), NULL, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_time_entries_trigger
  AFTER INSERT OR UPDATE OR DELETE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION audit_time_entries();

-- Expenses audit (status changes only)
CREATE OR REPLACE FUNCTION audit_expenses()
RETURNS TRIGGER AS $$
DECLARE
  v_action audit_action;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'expenses', NEW.id, NULL, to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      CASE NEW.status
        WHEN 'approved' THEN v_action := 'approve';
        WHEN 'rejected' THEN v_action := 'reject';
        ELSE v_action := 'status_change';
      END CASE;
      PERFORM create_audit_log(v_action, 'expenses', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'expenses', OLD.id, to_jsonb(OLD), NULL, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_expenses_trigger
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION audit_expenses();

-- Company members audit
CREATE OR REPLACE FUNCTION audit_company_members()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'company_members', NEW.id, NULL, to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'company_members', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'company_members', OLD.id, to_jsonb(OLD), NULL, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_company_members_trigger
  AFTER INSERT OR UPDATE OR DELETE ON company_members
  FOR EACH ROW
  EXECUTE FUNCTION audit_company_members();
