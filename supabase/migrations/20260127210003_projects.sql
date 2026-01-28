-- ============================================================================
-- PROJECT ENUMS
-- ============================================================================
CREATE TYPE billing_type AS ENUM ('hourly', 'fixed');
CREATE TYPE time_recording_mode AS ENUM ('hours', 'start_end');

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  billing_type billing_type NOT NULL DEFAULT 'hourly',
  hourly_rate DECIMAL(15, 2),
  fixed_price DECIMAL(15, 2),
  budget_hours DECIMAL(15, 2),
  budget_amount DECIMAL(15, 2),
  start_date DATE,
  end_date DATE,
  time_recording_mode time_recording_mode NOT NULL DEFAULT 'hours',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_billable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- Indexes
CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_projects_customer ON projects(customer_id);
CREATE INDEX idx_projects_active ON projects(company_id, is_active);
CREATE INDEX idx_projects_code ON projects(company_id, code);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROJECT_ASSIGNMENTS TABLE
-- Links employees to projects they can work on
-- ============================================================================
CREATE TABLE project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hourly_rate_override DECIMAL(15, 2),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Indexes
CREATE INDEX idx_project_assignments_project ON project_assignments(project_id);
CREATE INDEX idx_project_assignments_user ON project_assignments(user_id);
CREATE INDEX idx_project_assignments_active ON project_assignments(project_id, is_active);

-- Enable RLS
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is assigned to a project
CREATE OR REPLACE FUNCTION is_assigned_to_project(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_assignments
    WHERE project_id = p_project_id
    AND user_id = auth.uid()
    AND is_active = TRUE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================================
-- PROJECTS RLS POLICIES
-- ============================================================================

-- Superadmins can see all projects
CREATE POLICY "Superadmins can view all projects"
  ON projects FOR SELECT
  USING (company_id = get_user_company_id() AND is_superadmin());

-- Employees can see projects they are assigned to
CREATE POLICY "Employees can view assigned projects"
  ON projects FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND get_user_role() = 'employee'
    AND is_assigned_to_project(id)
  );

-- Superadmins can insert projects
CREATE POLICY "Superadmins can insert projects"
  ON projects FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

-- Superadmins can update projects
CREATE POLICY "Superadmins can update projects"
  ON projects FOR UPDATE
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

-- Superadmins can delete projects
CREATE POLICY "Superadmins can delete projects"
  ON projects FOR DELETE
  USING (company_id = get_user_company_id() AND is_superadmin());

-- ============================================================================
-- PROJECT_ASSIGNMENTS RLS POLICIES
-- ============================================================================

-- Users can view assignments in their company
CREATE POLICY "Users can view project assignments"
  ON project_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_assignments.project_id
      AND p.company_id = get_user_company_id()
    )
  );

-- Superadmins can manage assignments
CREATE POLICY "Superadmins can insert assignments"
  ON project_assignments FOR INSERT
  WITH CHECK (
    is_superadmin()
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_assignments.project_id
      AND p.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Superadmins can update assignments"
  ON project_assignments FOR UPDATE
  USING (
    is_superadmin()
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_assignments.project_id
      AND p.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Superadmins can delete assignments"
  ON project_assignments FOR DELETE
  USING (
    is_superadmin()
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_assignments.project_id
      AND p.company_id = get_user_company_id()
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_project_assignments_updated_at
  BEFORE UPDATE ON project_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
