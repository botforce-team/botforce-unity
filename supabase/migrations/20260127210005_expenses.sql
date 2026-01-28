-- ============================================================================
-- EXPENSE ENUMS
-- ============================================================================
CREATE TYPE expense_category AS ENUM (
  'mileage',
  'travel_time',
  'materials',
  'accommodation',
  'meals',
  'transport',
  'communication',
  'software',
  'other'
);

CREATE TYPE expense_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'exported');

-- ============================================================================
-- FILES TABLE
-- Stores file metadata for receipts and attachments
-- ============================================================================
CREATE TYPE file_category AS ENUM ('receipt', 'logo', 'avatar', 'attachment');

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  category file_category NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_files_company ON files(company_id);
CREATE INDEX idx_files_user ON files(user_id);

-- Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Files RLS
CREATE POLICY "Users can view files in their company"
  ON files FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert files"
  ON files FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND user_id = auth.uid());

CREATE POLICY "Users can delete their own files"
  ON files FOR DELETE
  USING (company_id = get_user_company_id() AND user_id = auth.uid());

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  tax_rate tax_rate NOT NULL DEFAULT 'standard_20',
  tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  category expense_category NOT NULL,
  description TEXT,
  merchant TEXT,
  receipt_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  is_reimbursable BOOLEAN NOT NULL DEFAULT TRUE,
  reimbursed_at TIMESTAMPTZ,
  status expense_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  exported_at TIMESTAMPTZ,
  export_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_expenses_company ON expenses(company_id);
CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_project ON expenses(project_id);
CREATE INDEX idx_expenses_date ON expenses(company_id, date);
CREATE INDEX idx_expenses_status ON expenses(company_id, status);
CREATE INDEX idx_expenses_approval_queue ON expenses(company_id, status) WHERE status = 'submitted';

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- EXPENSES RLS POLICIES
-- ============================================================================

-- Superadmins can view all expenses
CREATE POLICY "Superadmins can view all expenses"
  ON expenses FOR SELECT
  USING (company_id = get_user_company_id() AND is_superadmin());

-- Employees can view their own expenses
CREATE POLICY "Employees can view own expenses"
  ON expenses FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND user_id = auth.uid()
  );

-- Accountants can view all expenses (read-only)
CREATE POLICY "Accountants can view all expenses"
  ON expenses FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND get_user_role() = 'accountant'
  );

-- Users can insert expenses
CREATE POLICY "Users can insert expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND user_id = auth.uid()
    AND get_user_role() IN ('superadmin', 'employee')
  );

-- Users can update their own draft/rejected expenses
CREATE POLICY "Users can update own draft/rejected expenses"
  ON expenses FOR UPDATE
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

-- Superadmins can update any expense (for approval/rejection)
CREATE POLICY "Superadmins can update all expenses"
  ON expenses FOR UPDATE
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

-- Users can delete their own draft expenses
CREATE POLICY "Users can delete own draft expenses"
  ON expenses FOR DELETE
  USING (
    company_id = get_user_company_id()
    AND user_id = auth.uid()
    AND status = 'draft'
  );

-- ============================================================================
-- EXPENSE STATUS MACHINE TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_expense_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    -- No status change
    IF OLD.status NOT IN ('draft', 'rejected') AND NOT is_superadmin() THEN
      RAISE EXCEPTION 'Cannot modify expense in % status', OLD.status;
    END IF;
    RETURN NEW;
  END IF;

  CASE OLD.status
    WHEN 'draft' THEN
      IF NEW.status NOT IN ('submitted') THEN
        RAISE EXCEPTION 'Invalid transition from draft to %', NEW.status;
      END IF;
      NEW.submitted_at := NOW();

    WHEN 'submitted' THEN
      IF NEW.status = 'approved' THEN
        IF NOT is_superadmin() THEN
          RAISE EXCEPTION 'Only superadmins can approve expenses';
        END IF;
        NEW.approved_at := NOW();
        NEW.approved_by := auth.uid();

      ELSIF NEW.status = 'rejected' THEN
        IF NOT is_superadmin() THEN
          RAISE EXCEPTION 'Only superadmins can reject expenses';
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
      IF NEW.status = 'exported' THEN
        NEW.exported_at := NOW();
      ELSE
        RAISE EXCEPTION 'Invalid transition from approved to %', NEW.status;
      END IF;

    WHEN 'exported' THEN
      RAISE EXCEPTION 'Exported expenses cannot be modified';

    ELSE
      RAISE EXCEPTION 'Unknown status %', OLD.status;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_expense_status_trigger
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION enforce_expense_status();

-- ============================================================================
-- TRIGGER: Calculate tax amount
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_expense_tax()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.tax_rate
    WHEN 'standard_20' THEN
      NEW.tax_amount := NEW.amount - (NEW.amount / 1.20);
    WHEN 'reduced_10' THEN
      NEW.tax_amount := NEW.amount - (NEW.amount / 1.10);
    WHEN 'zero' THEN
      NEW.tax_amount := 0;
    WHEN 'reverse_charge' THEN
      NEW.tax_amount := 0;
    ELSE
      NEW.tax_amount := 0;
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_expense_tax_trigger
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION calculate_expense_tax();

-- Apply updated_at trigger
CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
