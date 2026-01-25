-- Migration: 0002_customers.sql
-- Description: Customers, projects, and project assignments
-- BOTFORCE Unity

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  customer_number VARCHAR(50),

  -- Tax info
  vat_number VARCHAR(50),
  tax_exempt BOOLEAN DEFAULT FALSE,

  -- Contact
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  postal_code VARCHAR(20),
  city VARCHAR(100),
  country VARCHAR(2) DEFAULT 'AT',

  -- Billing
  payment_terms_days INTEGER DEFAULT 14,
  default_tax_rate tax_rate DEFAULT 'standard_20',
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Notes
  notes TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- PROJECTS
-- ============================================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,

  -- Billing
  billing_type billing_type DEFAULT 'hourly' NOT NULL,
  hourly_rate DECIMAL(10, 2),
  fixed_price DECIMAL(12, 2),
  budget_hours DECIMAL(10, 2),
  budget_amount DECIMAL(12, 2),

  -- Dates
  start_date DATE,
  end_date DATE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  is_billable BOOLEAN DEFAULT TRUE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- PROJECT ASSIGNMENTS (Employee-Project access)
-- ============================================================================

CREATE TABLE project_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Override rate for this user on this project
  hourly_rate_override DECIMAL(10, 2),

  -- Assignment dates
  assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  unassigned_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT TRUE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT unique_project_assignment UNIQUE (project_id, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Customers
CREATE INDEX idx_customers_company_id ON customers(company_id);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_is_active ON customers(company_id, is_active);

-- Projects
CREATE INDEX idx_projects_company_id ON projects(company_id);
CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_is_active ON projects(company_id, is_active);
CREATE INDEX idx_projects_code ON projects(company_id, code);

-- Project assignments
CREATE INDEX idx_project_assignments_company_id ON project_assignments(company_id);
CREATE INDEX idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX idx_project_assignments_active ON project_assignments(user_id, is_active);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_assignments_updated_at
  BEFORE UPDATE ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER: Ensure project_assignments.company_id matches project.company_id
-- ============================================================================

CREATE OR REPLACE FUNCTION check_project_assignment_company()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id != (SELECT company_id FROM projects WHERE id = NEW.project_id) THEN
    RAISE EXCEPTION 'Project assignment company_id must match project company_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_project_assignment_company
  BEFORE INSERT OR UPDATE ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION check_project_assignment_company();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE customers IS 'Client companies that receive invoices';
COMMENT ON TABLE projects IS 'Projects under customers for time tracking and billing';
COMMENT ON TABLE project_assignments IS 'Controls which employees can access which projects';
COMMENT ON COLUMN projects.billing_type IS 'hourly: bill by tracked time; fixed: bill fixed amount';
