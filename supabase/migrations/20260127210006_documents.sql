-- ============================================================================
-- DOCUMENT ENUMS
-- ============================================================================
CREATE TYPE document_type AS ENUM ('invoice', 'credit_note');
CREATE TYPE document_status AS ENUM ('draft', 'issued', 'paid', 'cancelled');

-- ============================================================================
-- DOCUMENT NUMBER SERIES TABLE
-- Tracks sequential numbering per company/type/year
-- ============================================================================
CREATE TABLE document_number_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  year INTEGER NOT NULL,
  prefix TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, document_type, year)
);

-- Enable RLS
ALTER TABLE document_number_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's number series"
  ON document_number_series FOR SELECT
  USING (company_id = get_user_company_id());

-- ============================================================================
-- DOCUMENTS TABLE
-- ============================================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  document_type document_type NOT NULL,
  document_number TEXT,
  status document_status NOT NULL DEFAULT 'draft',
  issue_date DATE,
  due_date DATE,
  paid_date DATE,
  customer_snapshot JSONB,
  company_snapshot JSONB,
  payment_terms_days INTEGER NOT NULL DEFAULT 14,
  payment_reference TEXT,
  notes TEXT,
  internal_notes TEXT,
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_breakdown JSONB,
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_company ON documents(company_id);
CREATE INDEX idx_documents_customer ON documents(customer_id);
CREATE INDEX idx_documents_status ON documents(company_id, status);
CREATE INDEX idx_documents_number ON documents(company_id, document_number);
CREATE INDEX idx_documents_issue_date ON documents(company_id, issue_date);
CREATE UNIQUE INDEX idx_documents_unique_number ON documents(company_id, document_type, document_number) WHERE document_number IS NOT NULL;

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DOCUMENT_LINES TABLE
-- ============================================================================
CREATE TABLE document_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'hours',
  unit_price DECIMAL(15, 2) NOT NULL,
  tax_rate tax_rate NOT NULL DEFAULT 'standard_20',
  subtotal DECIMAL(15, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) NOT NULL,
  total DECIMAL(15, 2) NOT NULL,
  time_entry_ids UUID[],
  expense_ids UUID[],
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_document_lines_document ON document_lines(document_id);

-- Enable RLS
ALTER TABLE document_lines ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DOCUMENTS RLS POLICIES
-- ============================================================================

-- Superadmins can view all documents
CREATE POLICY "Superadmins can view all documents"
  ON documents FOR SELECT
  USING (company_id = get_user_company_id() AND is_superadmin());

-- Accountants can view all documents (read-only)
CREATE POLICY "Accountants can view all documents"
  ON documents FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND get_user_role() = 'accountant'
  );

-- Superadmins can insert documents
CREATE POLICY "Superadmins can insert documents"
  ON documents FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

-- Superadmins can update non-locked documents
CREATE POLICY "Superadmins can update documents"
  ON documents FOR UPDATE
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

-- Superadmins can delete draft documents
CREATE POLICY "Superadmins can delete draft documents"
  ON documents FOR DELETE
  USING (
    company_id = get_user_company_id()
    AND is_superadmin()
    AND status = 'draft'
  );

-- ============================================================================
-- DOCUMENT_LINES RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view document lines"
  ON document_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_lines.document_id
      AND d.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Superadmins can insert document lines"
  ON document_lines FOR INSERT
  WITH CHECK (
    is_superadmin()
    AND EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_lines.document_id
      AND d.company_id = get_user_company_id()
      AND d.status = 'draft'
    )
  );

CREATE POLICY "Superadmins can update document lines"
  ON document_lines FOR UPDATE
  USING (
    is_superadmin()
    AND EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_lines.document_id
      AND d.company_id = get_user_company_id()
      AND d.status = 'draft'
    )
  );

CREATE POLICY "Superadmins can delete document lines"
  ON document_lines FOR DELETE
  USING (
    is_superadmin()
    AND EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_lines.document_id
      AND d.company_id = get_user_company_id()
      AND d.status = 'draft'
    )
  );

-- ============================================================================
-- FUNCTION: Get next document number
-- Thread-safe with row-level locking
-- ============================================================================
CREATE OR REPLACE FUNCTION get_next_document_number(
  p_company_id UUID,
  p_document_type document_type,
  p_year INTEGER,
  p_prefix TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_next_number INTEGER;
  v_formatted_number TEXT;
BEGIN
  -- Insert or update with lock
  INSERT INTO document_number_series (company_id, document_type, year, prefix, last_number)
  VALUES (p_company_id, p_document_type, p_year, p_prefix, 1)
  ON CONFLICT (company_id, document_type, year)
  DO UPDATE SET
    last_number = document_number_series.last_number + 1,
    updated_at = NOW()
  RETURNING last_number INTO v_next_number;

  -- Format: PREFIX-YEAR-PADDED_NUMBER (e.g., INV-2026-00001)
  v_formatted_number := p_prefix || '-' || p_year::TEXT || '-' || LPAD(v_next_number::TEXT, 5, '0');

  RETURN v_formatted_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Calculate line totals
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_line_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate subtotal
  NEW.subtotal := NEW.quantity * NEW.unit_price;

  -- Calculate tax based on rate
  CASE NEW.tax_rate
    WHEN 'standard_20' THEN
      NEW.tax_amount := NEW.subtotal * 0.20;
    WHEN 'reduced_10' THEN
      NEW.tax_amount := NEW.subtotal * 0.10;
    WHEN 'zero' THEN
      NEW.tax_amount := 0;
    WHEN 'reverse_charge' THEN
      NEW.tax_amount := 0;
    ELSE
      NEW.tax_amount := 0;
  END CASE;

  -- Calculate total
  NEW.total := NEW.subtotal + NEW.tax_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_line_totals_trigger
  BEFORE INSERT OR UPDATE ON document_lines
  FOR EACH ROW
  EXECUTE FUNCTION calculate_line_totals();

-- ============================================================================
-- TRIGGER: Update document totals when lines change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_document_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_document_id UUID;
BEGIN
  -- Get the relevant document_id
  IF TG_OP = 'DELETE' THEN
    v_document_id := OLD.document_id;
  ELSE
    v_document_id := NEW.document_id;
  END IF;

  -- Recalculate totals
  UPDATE documents
  SET
    subtotal = COALESCE((SELECT SUM(subtotal) FROM document_lines WHERE document_id = v_document_id), 0),
    tax_amount = COALESCE((SELECT SUM(tax_amount) FROM document_lines WHERE document_id = v_document_id), 0),
    total = COALESCE((SELECT SUM(total) FROM document_lines WHERE document_id = v_document_id), 0),
    tax_breakdown = (
      SELECT jsonb_object_agg(tax_rate, amount)
      FROM (
        SELECT tax_rate::TEXT, SUM(tax_amount) as amount
        FROM document_lines
        WHERE document_id = v_document_id
        GROUP BY tax_rate
      ) t
    ),
    updated_at = NOW()
  WHERE id = v_document_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_document_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON document_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_document_totals();

-- ============================================================================
-- TRIGGER: Document immutability after issue
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_document_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow status changes on issued documents
  IF OLD.is_locked AND NEW.is_locked THEN
    -- Only allow updating: status, paid_date, internal_notes
    IF OLD.document_number IS DISTINCT FROM NEW.document_number
       OR OLD.issue_date IS DISTINCT FROM NEW.issue_date
       OR OLD.due_date IS DISTINCT FROM NEW.due_date
       OR OLD.customer_snapshot IS DISTINCT FROM NEW.customer_snapshot
       OR OLD.company_snapshot IS DISTINCT FROM NEW.company_snapshot
       OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
       OR OLD.tax_amount IS DISTINCT FROM NEW.tax_amount
       OR OLD.total IS DISTINCT FROM NEW.total
       OR OLD.notes IS DISTINCT FROM NEW.notes
       OR OLD.customer_id IS DISTINCT FROM NEW.customer_id
    THEN
      RAISE EXCEPTION 'Cannot modify locked document fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_document_immutability_trigger
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION enforce_document_immutability();

-- Apply updated_at triggers
CREATE TRIGGER set_document_number_series_updated_at
  BEFORE UPDATE ON document_number_series
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_document_lines_updated_at
  BEFORE UPDATE ON document_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add foreign key constraint for time entries (deferred to avoid circular dependency)
ALTER TABLE time_entries
  ADD CONSTRAINT fk_time_entries_document
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;
