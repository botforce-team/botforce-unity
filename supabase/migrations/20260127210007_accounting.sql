-- ============================================================================
-- EXPORT STATUS ENUM
-- ============================================================================
CREATE TYPE export_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================================================
-- ACCOUNTING_EXPORTS TABLE
-- ============================================================================
CREATE TABLE accounting_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status export_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  csv_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  zip_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  invoice_count INTEGER NOT NULL DEFAULT 0,
  credit_note_count INTEGER NOT NULL DEFAULT 0,
  expense_count INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_expenses DECIMAL(15, 2) NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_accounting_exports_company ON accounting_exports(company_id);
CREATE INDEX idx_accounting_exports_period ON accounting_exports(company_id, period_start, period_end);

-- Enable RLS
ALTER TABLE accounting_exports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ACCOUNTING_EXPORT_LINES TABLE
-- Tracks which documents/expenses are included in each export
-- ============================================================================
CREATE TABLE accounting_export_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id UUID NOT NULL REFERENCES accounting_exports(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  line_type TEXT NOT NULL, -- 'invoice', 'credit_note', 'expense'
  amount DECIMAL(15, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (document_id IS NOT NULL OR expense_id IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_accounting_export_lines_export ON accounting_export_lines(export_id);
CREATE INDEX idx_accounting_export_lines_document ON accounting_export_lines(document_id);
CREATE INDEX idx_accounting_export_lines_expense ON accounting_export_lines(expense_id);

-- Enable RLS
ALTER TABLE accounting_export_lines ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ACCOUNTING EXPORTS RLS POLICIES
-- ============================================================================

-- Superadmins and accountants can view exports
CREATE POLICY "Superadmins can view exports"
  ON accounting_exports FOR SELECT
  USING (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Accountants can view exports"
  ON accounting_exports FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND get_user_role() = 'accountant'
  );

-- Superadmins and accountants can create exports
CREATE POLICY "Superadmins can create exports"
  ON accounting_exports FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Accountants can create exports"
  ON accounting_exports FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND get_user_role() = 'accountant'
  );

-- Only superadmins can update exports
CREATE POLICY "Superadmins can update exports"
  ON accounting_exports FOR UPDATE
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

-- ============================================================================
-- ACCOUNTING EXPORT LINES RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view export lines"
  ON accounting_export_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accounting_exports e
      WHERE e.id = accounting_export_lines.export_id
      AND e.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Users can insert export lines"
  ON accounting_export_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounting_exports e
      WHERE e.id = accounting_export_lines.export_id
      AND e.company_id = get_user_company_id()
    )
  );

-- Apply updated_at trigger
CREATE TRIGGER set_accounting_exports_updated_at
  BEFORE UPDATE ON accounting_exports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Link expenses to exports
ALTER TABLE expenses
  ADD CONSTRAINT fk_expenses_export
  FOREIGN KEY (export_id) REFERENCES accounting_exports(id) ON DELETE SET NULL;
