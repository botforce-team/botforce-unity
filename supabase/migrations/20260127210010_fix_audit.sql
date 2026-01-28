-- ============================================================================
-- FIX AUDIT FUNCTIONS
-- Update audit functions to get company_id from the record being modified
-- This allows seed data to be inserted without auth context
-- ============================================================================

-- Update create_audit_log to accept company_id as parameter
CREATE OR REPLACE FUNCTION create_audit_log(
  p_company_id UUID,
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
  -- Skip audit if company_id is null (shouldn't happen for valid records)
  IF p_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get user email if authenticated
  IF auth.uid() IS NOT NULL THEN
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = auth.uid();
  END IF;

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
    p_company_id,
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

-- Update customers audit
CREATE OR REPLACE FUNCTION audit_customers()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      NEW.company_id,
      'create',
      'customers',
      NEW.id,
      NULL,
      to_jsonb(NEW),
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      NEW.company_id,
      'update',
      'customers',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      NULL
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      OLD.company_id,
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

-- Update projects audit
CREATE OR REPLACE FUNCTION audit_projects()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(NEW.company_id, 'create', 'projects', NEW.id, NULL, to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(NEW.company_id, 'update', 'projects', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(OLD.company_id, 'delete', 'projects', OLD.id, to_jsonb(OLD), NULL, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update documents audit
CREATE OR REPLACE FUNCTION audit_documents()
RETURNS TRIGGER AS $$
DECLARE
  v_action audit_action;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(NEW.company_id, 'create', 'documents', NEW.id, NULL, to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
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
    PERFORM create_audit_log(NEW.company_id, v_action, 'documents', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(OLD.company_id, 'delete', 'documents', OLD.id, to_jsonb(OLD), NULL, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update time entries audit
CREATE OR REPLACE FUNCTION audit_time_entries()
RETURNS TRIGGER AS $$
DECLARE
  v_action audit_action;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(NEW.company_id, 'create', 'time_entries', NEW.id, NULL, to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      CASE NEW.status
        WHEN 'approved' THEN v_action := 'approve';
        WHEN 'rejected' THEN v_action := 'reject';
        ELSE v_action := 'status_change';
      END CASE;
      PERFORM create_audit_log(NEW.company_id, v_action, 'time_entries', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(OLD.company_id, 'delete', 'time_entries', OLD.id, to_jsonb(OLD), NULL, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update expenses audit
CREATE OR REPLACE FUNCTION audit_expenses()
RETURNS TRIGGER AS $$
DECLARE
  v_action audit_action;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(NEW.company_id, 'create', 'expenses', NEW.id, NULL, to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      CASE NEW.status
        WHEN 'approved' THEN v_action := 'approve';
        WHEN 'rejected' THEN v_action := 'reject';
        ELSE v_action := 'status_change';
      END CASE;
      PERFORM create_audit_log(NEW.company_id, v_action, 'expenses', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(OLD.company_id, 'delete', 'expenses', OLD.id, to_jsonb(OLD), NULL, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update company members audit
CREATE OR REPLACE FUNCTION audit_company_members()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(NEW.company_id, 'create', 'company_members', NEW.id, NULL, to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(NEW.company_id, 'update', 'company_members', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(OLD.company_id, 'delete', 'company_members', OLD.id, to_jsonb(OLD), NULL, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
