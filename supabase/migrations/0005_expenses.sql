-- Migration: 0005_expenses.sql
-- Description: Expenses and file attachments
-- BOTFORCE Unity

-- ============================================================================
-- FILES (Generic file attachments)
-- ============================================================================

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Storage
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  storage_bucket VARCHAR(100) DEFAULT 'documents',

  -- File metadata
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100), -- MIME type
  file_size INTEGER, -- bytes

  -- Ownership
  uploaded_by UUID REFERENCES profiles(id),

  -- Categorization
  category VARCHAR(50), -- 'receipt', 'contract', 'attachment', etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- EXPENSES
-- ============================================================================

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Who submitted
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Optional project link
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Expense details
  date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  tax_rate tax_rate DEFAULT 'standard_20',
  tax_amount DECIMAL(12, 2),

  -- Category
  category VARCHAR(100) NOT NULL, -- 'travel', 'software', 'equipment', etc.

  -- Description
  description TEXT,
  merchant VARCHAR(255),

  -- Status
  status expense_status DEFAULT 'draft' NOT NULL,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,

  -- Export tracking
  exported_at TIMESTAMPTZ,
  export_id UUID, -- FK added after accounting_exports table

  -- Receipt
  receipt_file_id UUID REFERENCES files(id) ON DELETE SET NULL,

  -- Reimbursement
  is_reimbursable BOOLEAN DEFAULT TRUE,
  reimbursed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Files
CREATE INDEX idx_files_company_id ON files(company_id);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX idx_files_category ON files(company_id, category);

-- Expenses
CREATE INDEX idx_expenses_company_id ON expenses(company_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_status ON expenses(company_id, status);
CREATE INDEX idx_expenses_category ON expenses(company_id, category);
CREATE INDEX idx_expenses_company_date ON expenses(company_id, date);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Calculate expense tax
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_expense_tax()
RETURNS TRIGGER AS $$
DECLARE
  v_tax_percent DECIMAL(5, 2);
BEGIN
  v_tax_percent := CASE NEW.tax_rate
    WHEN 'standard_20' THEN 20.00
    WHEN 'reduced_10' THEN 10.00
    WHEN 'zero' THEN 0.00
  END;

  -- Calculate tax from gross amount (Austrian standard: tax included in amount)
  NEW.tax_amount := ROUND(NEW.amount * v_tax_percent / (100 + v_tax_percent), 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_expense_tax_trigger
  BEFORE INSERT OR UPDATE OF amount, tax_rate ON expenses
  FOR EACH ROW EXECUTE FUNCTION calculate_expense_tax();

-- ============================================================================
-- FUNCTION: Validate expense status transitions
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_expense_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Check valid transitions
  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Draft expenses can only transition to submitted';
  END IF;

  IF OLD.status = 'submitted' AND NEW.status NOT IN ('submitted', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Submitted expenses can only transition to approved or rejected';
  END IF;

  IF OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'exported') THEN
    RAISE EXCEPTION 'Approved expenses can only transition to exported';
  END IF;

  IF OLD.status = 'rejected' AND NEW.status NOT IN ('rejected', 'draft') THEN
    RAISE EXCEPTION 'Rejected expenses can only transition back to draft';
  END IF;

  IF OLD.status = 'exported' THEN
    RAISE EXCEPTION 'Exported expenses cannot change status';
  END IF;

  -- Set timestamps
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
  END IF;

  IF NEW.status = 'draft' AND OLD.status = 'rejected' THEN
    NEW.submitted_at = NULL;
    NEW.rejected_at = NULL;
    NEW.rejected_by = NULL;
    NEW.rejection_reason = NULL;
  END IF;

  IF NEW.status = 'exported' AND OLD.status != 'exported' THEN
    NEW.exported_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_expense_status
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION validate_expense_status_transition();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE files IS 'Generic file storage metadata (receipts, attachments, etc.)';
COMMENT ON TABLE expenses IS 'Expense records with approval workflow';
COMMENT ON COLUMN expenses.amount IS 'Gross amount including tax (Austrian standard)';
COMMENT ON COLUMN expenses.tax_amount IS 'Calculated tax portion of the gross amount';
