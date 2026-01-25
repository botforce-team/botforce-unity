-- Migration: 0004_documents.sql
-- Description: Invoices, credit notes, lines, and sequential numbering
-- BOTFORCE Unity

-- ============================================================================
-- DOCUMENT NUMBER SERIES
-- ============================================================================

CREATE TABLE document_number_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Series configuration
  document_type document_type NOT NULL,
  year INTEGER NOT NULL,
  prefix VARCHAR(20) NOT NULL, -- e.g., 'INV', 'CN'

  -- Current state
  last_number INTEGER DEFAULT 0 NOT NULL,

  -- Format settings
  number_padding INTEGER DEFAULT 5, -- e.g., 5 = 00001
  separator VARCHAR(5) DEFAULT '-',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT unique_series UNIQUE (company_id, document_type, year)
);

-- ============================================================================
-- DOCUMENTS (Invoices and Credit Notes)
-- ============================================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  -- Document identification
  document_type document_type NOT NULL,
  document_number VARCHAR(50), -- Set when issued, e.g., 'INV-2026-00001'
  series_id UUID REFERENCES document_number_series(id),

  -- Reference (for credit notes)
  reference_document_id UUID REFERENCES documents(id),

  -- Status
  status document_status DEFAULT 'draft' NOT NULL,

  -- Dates
  issue_date DATE,
  due_date DATE,
  paid_date DATE,

  -- Customer snapshot (immutable after issue)
  customer_snapshot JSONB, -- name, address, vat_number, etc.

  -- Company snapshot (immutable after issue)
  company_snapshot JSONB, -- name, address, vat_number, bank details, etc.

  -- Amounts (calculated from lines)
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Tax breakdown
  tax_breakdown JSONB DEFAULT '[]', -- [{rate: "20%", base: 1000, amount: 200}]

  -- Payment
  payment_terms_days INTEGER,
  payment_reference VARCHAR(100), -- Austrian payment reference
  payment_notes TEXT,

  -- Notes
  notes TEXT, -- Public notes on invoice
  internal_notes TEXT, -- Internal notes

  -- Files
  pdf_url TEXT,

  -- Lock flag (prevents all changes except status/payment)
  is_locked BOOLEAN DEFAULT FALSE NOT NULL,
  locked_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  issued_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT document_number_required_when_issued
    CHECK (status = 'draft' OR document_number IS NOT NULL)
);

-- ============================================================================
-- DOCUMENT LINES
-- ============================================================================

CREATE TABLE document_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Line order
  line_number INTEGER NOT NULL,

  -- Item details
  description TEXT NOT NULL,

  -- Quantity and pricing
  quantity DECIMAL(10, 3) DEFAULT 1 NOT NULL,
  unit VARCHAR(20) DEFAULT 'hours', -- hours, pieces, etc.
  unit_price DECIMAL(12, 4) NOT NULL,

  -- Tax
  tax_rate tax_rate DEFAULT 'standard_20' NOT NULL,

  -- Calculated amounts
  subtotal DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  tax_amount DECIMAL(12, 2), -- Calculated based on tax_rate
  total DECIMAL(12, 2),

  -- Link to time entries (optional)
  time_entry_ids UUID[] DEFAULT '{}',

  -- Project reference (for reporting)
  project_id UUID REFERENCES projects(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT unique_line_number UNIQUE (document_id, line_number)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Document number series
CREATE INDEX idx_doc_series_company ON document_number_series(company_id);
CREATE INDEX idx_doc_series_lookup ON document_number_series(company_id, document_type, year);

-- Documents
CREATE INDEX idx_documents_company_id ON documents(company_id);
CREATE INDEX idx_documents_customer_id ON documents(customer_id);
CREATE INDEX idx_documents_status ON documents(company_id, status);
CREATE INDEX idx_documents_type ON documents(company_id, document_type);
CREATE INDEX idx_documents_issue_date ON documents(company_id, issue_date);
CREATE INDEX idx_documents_number ON documents(company_id, document_number);
CREATE INDEX idx_documents_due_date ON documents(company_id, due_date) WHERE status = 'issued';

-- Document lines
CREATE INDEX idx_document_lines_document_id ON document_lines(document_id);
CREATE INDEX idx_document_lines_company_id ON document_lines(company_id);
CREATE INDEX idx_document_lines_project_id ON document_lines(project_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_document_number_series_updated_at
  BEFORE UPDATE ON document_number_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_lines_updated_at
  BEFORE UPDATE ON document_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Get next document number (with locking)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_document_number(
  p_company_id UUID,
  p_document_type document_type,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TEXT AS $$
DECLARE
  v_series_id UUID;
  v_next_number INTEGER;
  v_prefix VARCHAR(20);
  v_padding INTEGER;
  v_separator VARCHAR(5);
  v_document_number TEXT;
BEGIN
  -- Get or create series with lock
  SELECT id, prefix, number_padding, separator
  INTO v_series_id, v_prefix, v_padding, v_separator
  FROM document_number_series
  WHERE company_id = p_company_id
    AND document_type = p_document_type
    AND year = p_year
  FOR UPDATE;

  IF v_series_id IS NULL THEN
    -- Create new series
    v_prefix := CASE p_document_type
      WHEN 'invoice' THEN 'INV'
      WHEN 'credit_note' THEN 'CN'
    END;
    v_padding := 5;
    v_separator := '-';

    INSERT INTO document_number_series (company_id, document_type, year, prefix, last_number)
    VALUES (p_company_id, p_document_type, p_year, v_prefix, 1)
    RETURNING id, last_number INTO v_series_id, v_next_number;
  ELSE
    -- Increment existing series
    UPDATE document_number_series
    SET last_number = last_number + 1, updated_at = NOW()
    WHERE id = v_series_id
    RETURNING last_number INTO v_next_number;
  END IF;

  -- Format: PREFIX-YEAR-PADDED_NUMBER (e.g., INV-2026-00001)
  v_document_number := v_prefix || v_separator || p_year::TEXT || v_separator ||
                       LPAD(v_next_number::TEXT, v_padding, '0');

  RETURN v_document_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Calculate document line tax
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_line_tax()
RETURNS TRIGGER AS $$
DECLARE
  v_tax_percent DECIMAL(5, 2);
BEGIN
  -- Get tax percentage
  v_tax_percent := CASE NEW.tax_rate
    WHEN 'standard_20' THEN 20.00
    WHEN 'reduced_10' THEN 10.00
    WHEN 'zero' THEN 0.00
  END;

  -- Calculate tax and total
  NEW.tax_amount := ROUND(NEW.subtotal * v_tax_percent / 100, 2);
  NEW.total := NEW.subtotal + NEW.tax_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_document_line_tax
  BEFORE INSERT OR UPDATE ON document_lines
  FOR EACH ROW EXECUTE FUNCTION calculate_line_tax();

-- ============================================================================
-- FUNCTION: Update document totals from lines
-- ============================================================================

CREATE OR REPLACE FUNCTION update_document_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE documents
  SET
    subtotal = COALESCE((SELECT SUM(subtotal) FROM document_lines WHERE document_id = COALESCE(NEW.document_id, OLD.document_id)), 0),
    tax_amount = COALESCE((SELECT SUM(tax_amount) FROM document_lines WHERE document_id = COALESCE(NEW.document_id, OLD.document_id)), 0),
    total = COALESCE((SELECT SUM(total) FROM document_lines WHERE document_id = COALESCE(NEW.document_id, OLD.document_id)), 0),
    tax_breakdown = (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'rate', tax_rate,
        'base', base,
        'amount', tax
      )), '[]'::jsonb)
      FROM (
        SELECT tax_rate, SUM(subtotal) as base, SUM(tax_amount) as tax
        FROM document_lines
        WHERE document_id = COALESCE(NEW.document_id, OLD.document_id)
        GROUP BY tax_rate
      ) breakdown
    )
  WHERE id = COALESCE(NEW.document_id, OLD.document_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_totals_on_line_change
  AFTER INSERT OR UPDATE OR DELETE ON document_lines
  FOR EACH ROW EXECUTE FUNCTION update_document_totals();

-- ============================================================================
-- FUNCTION: Prevent changes to locked documents
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_locked_document_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked AND TG_OP = 'UPDATE' THEN
    -- Allow only specific fields to change
    IF OLD.status != NEW.status OR
       OLD.paid_date != NEW.paid_date OR
       (OLD.paid_date IS NULL AND NEW.paid_date IS NOT NULL) OR
       OLD.internal_notes != NEW.internal_notes THEN
      -- These changes are allowed
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Cannot modify locked document. Only status, paid_date, and internal_notes can be changed.';
    END IF;
  END IF;

  IF OLD.is_locked AND TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cannot delete locked document';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_locked_document_changes
  BEFORE UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION prevent_locked_document_changes();

-- ============================================================================
-- FUNCTION: Lock document and create snapshots when issuing
-- ============================================================================

CREATE OR REPLACE FUNCTION issue_document()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'issued' AND OLD.status = 'draft' THEN
    -- Generate document number if not set
    IF NEW.document_number IS NULL THEN
      NEW.document_number := get_next_document_number(NEW.company_id, NEW.document_type);
    END IF;

    -- Set issue date if not set
    IF NEW.issue_date IS NULL THEN
      NEW.issue_date := CURRENT_DATE;
    END IF;

    -- Create customer snapshot
    NEW.customer_snapshot := (
      SELECT jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'legal_name', c.legal_name,
        'vat_number', c.vat_number,
        'address_line1', c.address_line1,
        'address_line2', c.address_line2,
        'postal_code', c.postal_code,
        'city', c.city,
        'country', c.country,
        'email', c.email
      )
      FROM customers c
      WHERE c.id = NEW.customer_id
    );

    -- Create company snapshot
    NEW.company_snapshot := (
      SELECT jsonb_build_object(
        'id', co.id,
        'name', co.name,
        'legal_name', co.legal_name,
        'vat_number', co.vat_number,
        'registration_number', co.registration_number,
        'address_line1', co.address_line1,
        'address_line2', co.address_line2,
        'postal_code', co.postal_code,
        'city', co.city,
        'country', co.country,
        'email', co.email,
        'phone', co.phone,
        'website', co.website
      )
      FROM companies co
      WHERE co.id = NEW.company_id
    );

    -- Lock the document
    NEW.is_locked := TRUE;
    NEW.locked_at := NOW();
    NEW.issued_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issue_document_trigger
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION issue_document();

-- ============================================================================
-- Add FK from time_entries to documents
-- ============================================================================

ALTER TABLE time_entries
  ADD CONSTRAINT fk_time_entry_document
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE document_number_series IS 'Sequential numbering series for documents per company/type/year';
COMMENT ON TABLE documents IS 'Invoices and credit notes with immutability after issue';
COMMENT ON TABLE document_lines IS 'Line items for documents';
COMMENT ON COLUMN documents.customer_snapshot IS 'Immutable customer data snapshot at issue time (Austrian requirement)';
COMMENT ON COLUMN documents.is_locked IS 'Prevents modifications after document is issued';
COMMENT ON FUNCTION get_next_document_number IS 'Thread-safe sequential document number generator';
