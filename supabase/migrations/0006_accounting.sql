-- Migration: 0006_accounting.sql
-- Description: Accounting exports and export lines
-- BOTFORCE Unity

-- ============================================================================
-- ACCOUNTING EXPORTS
-- ============================================================================

CREATE TABLE accounting_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Export metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Status
  status export_status DEFAULT 'pending' NOT NULL,

  -- Who created/processed
  created_by UUID NOT NULL REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Output files
  csv_file_id UUID REFERENCES files(id),
  zip_file_id UUID REFERENCES files(id),

  -- Statistics
  invoice_count INTEGER DEFAULT 0,
  credit_note_count INTEGER DEFAULT 0,
  expense_count INTEGER DEFAULT 0,
  total_revenue DECIMAL(14, 2) DEFAULT 0,
  total_expenses DECIMAL(14, 2) DEFAULT 0,

  -- Lock (prevents modifications to included documents)
  is_locked BOOLEAN DEFAULT FALSE NOT NULL,
  locked_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_period CHECK (period_start <= period_end)
);

-- ============================================================================
-- ACCOUNTING EXPORT LINES (What's included in an export)
-- ============================================================================

CREATE TABLE accounting_export_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  export_id UUID NOT NULL REFERENCES accounting_exports(id) ON DELETE CASCADE,

  -- Reference to source document
  document_id UUID REFERENCES documents(id),
  expense_id UUID REFERENCES expenses(id),

  -- Line type
  line_type VARCHAR(20) NOT NULL, -- 'invoice', 'credit_note', 'expense'

  -- Snapshot of key data at export time
  reference_number VARCHAR(100), -- Document number or expense reference
  date DATE,
  net_amount DECIMAL(12, 2),
  tax_amount DECIMAL(12, 2),
  gross_amount DECIMAL(12, 2),
  tax_rate VARCHAR(20),
  counterparty_name VARCHAR(255), -- Customer or merchant name
  description TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT one_source CHECK (
    (document_id IS NOT NULL AND expense_id IS NULL) OR
    (document_id IS NULL AND expense_id IS NOT NULL)
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Accounting exports
CREATE INDEX idx_accounting_exports_company ON accounting_exports(company_id);
CREATE INDEX idx_accounting_exports_status ON accounting_exports(company_id, status);
CREATE INDEX idx_accounting_exports_period ON accounting_exports(company_id, period_start, period_end);
CREATE INDEX idx_accounting_exports_created_by ON accounting_exports(created_by);

-- Accounting export lines
CREATE INDEX idx_accounting_export_lines_export ON accounting_export_lines(export_id);
CREATE INDEX idx_accounting_export_lines_company ON accounting_export_lines(company_id);
CREATE INDEX idx_accounting_export_lines_document ON accounting_export_lines(document_id);
CREATE INDEX idx_accounting_export_lines_expense ON accounting_export_lines(expense_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_accounting_exports_updated_at
  BEFORE UPDATE ON accounting_exports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Add FK from expenses to accounting_exports
-- ============================================================================

ALTER TABLE expenses
  ADD CONSTRAINT fk_expense_export
  FOREIGN KEY (export_id) REFERENCES accounting_exports(id) ON DELETE SET NULL;

-- ============================================================================
-- FUNCTION: Lock export and mark included items
-- ============================================================================

CREATE OR REPLACE FUNCTION lock_accounting_export(p_export_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Lock the export
  UPDATE accounting_exports
  SET is_locked = TRUE, locked_at = NOW(), status = 'completed', completed_at = NOW()
  WHERE id = p_export_id AND is_locked = FALSE;

  -- Mark included expenses as exported
  UPDATE expenses
  SET status = 'exported', exported_at = NOW(), export_id = p_export_id
  WHERE id IN (
    SELECT expense_id FROM accounting_export_lines
    WHERE export_id = p_export_id AND expense_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Prevent changes to locked exports
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_locked_export_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked AND TG_OP = 'UPDATE' THEN
    -- Allow only internal_notes-like changes (none defined, so block all)
    RAISE EXCEPTION 'Cannot modify locked accounting export';
  END IF;

  IF OLD.is_locked AND TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cannot delete locked accounting export';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_locked_export_changes
  BEFORE UPDATE OR DELETE ON accounting_exports
  FOR EACH ROW EXECUTE FUNCTION prevent_locked_export_changes();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE accounting_exports IS 'Monthly export packages for accountant handoff';
COMMENT ON TABLE accounting_export_lines IS 'Line items included in an export with snapshot data';
COMMENT ON COLUMN accounting_exports.is_locked IS 'Prevents modifications after export is finalized';
COMMENT ON FUNCTION lock_accounting_export IS 'Locks export and marks included expenses as exported';
