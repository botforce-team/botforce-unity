-- Migration: 0008_rls.sql
-- Description: Row Level Security policies and helper functions
-- BOTFORCE Unity

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_number_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_export_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get the current user's role for a specific company
CREATE OR REPLACE FUNCTION get_user_role(p_company_id UUID)
RETURNS user_role AS $$
  SELECT role
  FROM company_members
  WHERE company_id = p_company_id
    AND user_id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is superadmin for a company
CREATE OR REPLACE FUNCTION is_superadmin(p_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND role = 'superadmin'
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is accountant for a company
CREATE OR REPLACE FUNCTION is_accountant(p_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND role = 'accountant'
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is employee for a company
CREATE OR REPLACE FUNCTION is_employee(p_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND role = 'employee'
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is a member of a company (any role)
CREATE OR REPLACE FUNCTION is_company_member(p_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user has access to a specific project
-- (superadmin: all projects, employee: only assigned projects)
CREATE OR REPLACE FUNCTION has_project_access(p_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Get the company_id for this project
  SELECT company_id INTO v_company_id FROM projects WHERE id = p_project_id;

  IF v_company_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Superadmins and accountants can access all projects in their company
  IF is_superadmin(v_company_id) OR is_accountant(v_company_id) THEN
    RETURN TRUE;
  END IF;

  -- Employees can only access assigned projects
  RETURN EXISTS (
    SELECT 1
    FROM project_assignments
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user can modify a time entry
CREATE OR REPLACE FUNCTION can_modify_time_entry(p_time_entry_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_entry RECORD;
BEGIN
  SELECT * INTO v_entry FROM time_entries WHERE id = p_time_entry_id;

  IF v_entry IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Superadmins can modify any time entry
  IF is_superadmin(v_entry.company_id) THEN
    RETURN TRUE;
  END IF;

  -- Employees can only modify their own draft/rejected entries
  IF v_entry.user_id = auth.uid() AND v_entry.status IN ('draft', 'rejected') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Company members can view profiles of other members in the same company
CREATE POLICY "Company members can view colleague profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm1
      JOIN company_members cm2 ON cm1.company_id = cm2.company_id
      WHERE cm1.user_id = auth.uid()
        AND cm2.user_id = profiles.id
        AND cm1.is_active = TRUE
        AND cm2.is_active = TRUE
    )
  );

-- ============================================================================
-- COMPANIES POLICIES
-- ============================================================================

-- Members can view their companies
CREATE POLICY "Members can view company"
  ON companies FOR SELECT
  USING (is_company_member(id));

-- Only superadmins can update company
CREATE POLICY "Superadmins can update company"
  ON companies FOR UPDATE
  USING (is_superadmin(id));

-- ============================================================================
-- COMPANY_MEMBERS POLICIES
-- ============================================================================

-- Members can view all members of their company
CREATE POLICY "Members can view company members"
  ON company_members FOR SELECT
  USING (is_company_member(company_id));

-- Only superadmins can manage company members
CREATE POLICY "Superadmins can insert company members"
  ON company_members FOR INSERT
  WITH CHECK (is_superadmin(company_id));

CREATE POLICY "Superadmins can update company members"
  ON company_members FOR UPDATE
  USING (is_superadmin(company_id));

CREATE POLICY "Superadmins can delete company members"
  ON company_members FOR DELETE
  USING (is_superadmin(company_id));

-- ============================================================================
-- CUSTOMERS POLICIES
-- ============================================================================

-- Superadmins and accountants can view all customers
CREATE POLICY "Admins and accountants can view customers"
  ON customers FOR SELECT
  USING (is_superadmin(company_id) OR is_accountant(company_id));

-- Employees can view customers of their assigned projects
CREATE POLICY "Employees can view customers of assigned projects"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN project_assignments pa ON p.id = pa.project_id
      WHERE p.customer_id = customers.id
        AND pa.user_id = auth.uid()
        AND pa.is_active = TRUE
    )
  );

-- Only superadmins can manage customers
CREATE POLICY "Superadmins can insert customers"
  ON customers FOR INSERT
  WITH CHECK (is_superadmin(company_id));

CREATE POLICY "Superadmins can update customers"
  ON customers FOR UPDATE
  USING (is_superadmin(company_id));

CREATE POLICY "Superadmins can delete customers"
  ON customers FOR DELETE
  USING (is_superadmin(company_id));

-- ============================================================================
-- PROJECTS POLICIES
-- ============================================================================

-- Superadmins and accountants can view all projects
CREATE POLICY "Admins and accountants can view all projects"
  ON projects FOR SELECT
  USING (is_superadmin(company_id) OR is_accountant(company_id));

-- Employees can view only assigned projects
CREATE POLICY "Employees can view assigned projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_id = projects.id
        AND user_id = auth.uid()
        AND is_active = TRUE
    )
  );

-- Only superadmins can manage projects
CREATE POLICY "Superadmins can insert projects"
  ON projects FOR INSERT
  WITH CHECK (is_superadmin(company_id));

CREATE POLICY "Superadmins can update projects"
  ON projects FOR UPDATE
  USING (is_superadmin(company_id));

CREATE POLICY "Superadmins can delete projects"
  ON projects FOR DELETE
  USING (is_superadmin(company_id));

-- ============================================================================
-- PROJECT_ASSIGNMENTS POLICIES
-- ============================================================================

-- Members can view assignments for projects they can access
CREATE POLICY "Members can view project assignments"
  ON project_assignments FOR SELECT
  USING (
    is_superadmin(company_id) OR
    is_accountant(company_id) OR
    user_id = auth.uid()
  );

-- Only superadmins can manage assignments
CREATE POLICY "Superadmins can insert project assignments"
  ON project_assignments FOR INSERT
  WITH CHECK (is_superadmin(company_id));

CREATE POLICY "Superadmins can update project assignments"
  ON project_assignments FOR UPDATE
  USING (is_superadmin(company_id));

CREATE POLICY "Superadmins can delete project assignments"
  ON project_assignments FOR DELETE
  USING (is_superadmin(company_id));

-- ============================================================================
-- TIME_ENTRIES POLICIES
-- ============================================================================

-- Superadmins can view all time entries
CREATE POLICY "Superadmins can view all time entries"
  ON time_entries FOR SELECT
  USING (is_superadmin(company_id));

-- Accountants can view all time entries (read-only)
CREATE POLICY "Accountants can view all time entries"
  ON time_entries FOR SELECT
  USING (is_accountant(company_id));

-- Employees can view only their own time entries
CREATE POLICY "Employees can view own time entries"
  ON time_entries FOR SELECT
  USING (user_id = auth.uid() AND is_employee(company_id));

-- Employees can insert time entries for assigned projects only
CREATE POLICY "Employees can insert time entries for assigned projects"
  ON time_entries FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    has_project_access(project_id) AND
    is_employee(company_id)
  );

-- Superadmins can insert time entries for anyone
CREATE POLICY "Superadmins can insert time entries"
  ON time_entries FOR INSERT
  WITH CHECK (is_superadmin(company_id));

-- Employees can update their own draft/rejected entries
CREATE POLICY "Employees can update own draft entries"
  ON time_entries FOR UPDATE
  USING (
    user_id = auth.uid() AND
    status IN ('draft', 'rejected') AND
    is_employee(company_id)
  );

-- Superadmins can update any time entry (for approvals, etc.)
CREATE POLICY "Superadmins can update time entries"
  ON time_entries FOR UPDATE
  USING (is_superadmin(company_id));

-- Employees can delete their own draft entries
CREATE POLICY "Employees can delete own draft entries"
  ON time_entries FOR DELETE
  USING (
    user_id = auth.uid() AND
    status = 'draft' AND
    is_employee(company_id)
  );

-- Superadmins can delete non-invoiced time entries
CREATE POLICY "Superadmins can delete time entries"
  ON time_entries FOR DELETE
  USING (is_superadmin(company_id) AND status != 'invoiced');

-- ============================================================================
-- DOCUMENT_NUMBER_SERIES POLICIES
-- ============================================================================

-- Only superadmins can manage number series
CREATE POLICY "Superadmins can manage number series"
  ON document_number_series FOR ALL
  USING (is_superadmin(company_id));

-- Accountants can view number series
CREATE POLICY "Accountants can view number series"
  ON document_number_series FOR SELECT
  USING (is_accountant(company_id));

-- ============================================================================
-- DOCUMENTS POLICIES
-- ============================================================================

-- Superadmins can do everything with documents
CREATE POLICY "Superadmins can manage documents"
  ON documents FOR ALL
  USING (is_superadmin(company_id));

-- Accountants can view all documents
CREATE POLICY "Accountants can view documents"
  ON documents FOR SELECT
  USING (is_accountant(company_id));

-- ============================================================================
-- DOCUMENT_LINES POLICIES
-- ============================================================================

-- Superadmins can do everything with document lines
CREATE POLICY "Superadmins can manage document lines"
  ON document_lines FOR ALL
  USING (is_superadmin(company_id));

-- Accountants can view all document lines
CREATE POLICY "Accountants can view document lines"
  ON document_lines FOR SELECT
  USING (is_accountant(company_id));

-- ============================================================================
-- EXPENSES POLICIES
-- ============================================================================

-- Superadmins can do everything with expenses
CREATE POLICY "Superadmins can manage expenses"
  ON expenses FOR ALL
  USING (is_superadmin(company_id));

-- Accountants can view all expenses
CREATE POLICY "Accountants can view expenses"
  ON expenses FOR SELECT
  USING (is_accountant(company_id));

-- Employees can view their own expenses
CREATE POLICY "Employees can view own expenses"
  ON expenses FOR SELECT
  USING (user_id = auth.uid() AND is_employee(company_id));

-- Employees can insert their own expenses
CREATE POLICY "Employees can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_employee(company_id));

-- Employees can update their own draft/rejected expenses
CREATE POLICY "Employees can update own draft expenses"
  ON expenses FOR UPDATE
  USING (
    user_id = auth.uid() AND
    status IN ('draft', 'rejected') AND
    is_employee(company_id)
  );

-- Employees can delete their own draft expenses
CREATE POLICY "Employees can delete own draft expenses"
  ON expenses FOR DELETE
  USING (
    user_id = auth.uid() AND
    status = 'draft' AND
    is_employee(company_id)
  );

-- ============================================================================
-- FILES POLICIES
-- ============================================================================

-- Members can view files in their company
CREATE POLICY "Members can view company files"
  ON files FOR SELECT
  USING (is_company_member(company_id));

-- Superadmins can manage all files
CREATE POLICY "Superadmins can manage files"
  ON files FOR ALL
  USING (is_superadmin(company_id));

-- Employees can upload files
CREATE POLICY "Employees can upload files"
  ON files FOR INSERT
  WITH CHECK (is_employee(company_id) AND uploaded_by = auth.uid());

-- Employees can delete their own files
CREATE POLICY "Employees can delete own files"
  ON files FOR DELETE
  USING (uploaded_by = auth.uid() AND is_employee(company_id));

-- ============================================================================
-- ACCOUNTING_EXPORTS POLICIES
-- ============================================================================

-- Superadmins can do everything with exports
CREATE POLICY "Superadmins can manage exports"
  ON accounting_exports FOR ALL
  USING (is_superadmin(company_id));

-- Accountants can view and create exports
CREATE POLICY "Accountants can view exports"
  ON accounting_exports FOR SELECT
  USING (is_accountant(company_id));

CREATE POLICY "Accountants can create exports"
  ON accounting_exports FOR INSERT
  WITH CHECK (is_accountant(company_id));

-- Accountants can update exports (but trigger prevents locked changes)
CREATE POLICY "Accountants can update exports"
  ON accounting_exports FOR UPDATE
  USING (is_accountant(company_id));

-- Accountants cannot delete exports
-- (No DELETE policy for accountants)

-- ============================================================================
-- ACCOUNTING_EXPORT_LINES POLICIES
-- ============================================================================

-- Superadmins can do everything with export lines
CREATE POLICY "Superadmins can manage export lines"
  ON accounting_export_lines FOR ALL
  USING (is_superadmin(company_id));

-- Accountants can view and create export lines
CREATE POLICY "Accountants can view export lines"
  ON accounting_export_lines FOR SELECT
  USING (is_accountant(company_id));

CREATE POLICY "Accountants can create export lines"
  ON accounting_export_lines FOR INSERT
  WITH CHECK (is_accountant(company_id));

-- ============================================================================
-- AUDIT_LOG POLICIES
-- ============================================================================

-- Superadmins can view audit logs
CREATE POLICY "Superadmins can view audit logs"
  ON audit_log FOR SELECT
  USING (is_superadmin(company_id));

-- Accountants can view audit logs
CREATE POLICY "Accountants can view audit logs"
  ON audit_log FOR SELECT
  USING (is_accountant(company_id));

-- No direct INSERT/UPDATE/DELETE for audit logs (only via functions)
-- The audit_log_insert function is SECURITY DEFINER

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_user_role IS 'Returns the user role for a specific company';
COMMENT ON FUNCTION is_superadmin IS 'Checks if current user is superadmin for company';
COMMENT ON FUNCTION is_accountant IS 'Checks if current user is accountant for company';
COMMENT ON FUNCTION is_employee IS 'Checks if current user is employee for company';
COMMENT ON FUNCTION has_project_access IS 'Checks if current user can access a specific project';
