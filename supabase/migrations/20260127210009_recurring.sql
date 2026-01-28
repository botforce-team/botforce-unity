-- ============================================================================
-- RECURRING FREQUENCY ENUM
-- ============================================================================
CREATE TYPE recurring_frequency AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');

-- ============================================================================
-- RECURRING_INVOICE_TEMPLATES TABLE
-- ============================================================================
CREATE TABLE recurring_invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  frequency recurring_frequency NOT NULL DEFAULT 'monthly',
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 28)),
  day_of_week INTEGER CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  payment_terms_days INTEGER NOT NULL DEFAULT 14,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  next_issue_date DATE,
  last_issued_at TIMESTAMPTZ,
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recurring_templates_company ON recurring_invoice_templates(company_id);
CREATE INDEX idx_recurring_templates_customer ON recurring_invoice_templates(customer_id);
CREATE INDEX idx_recurring_templates_active ON recurring_invoice_templates(company_id, is_active);
CREATE INDEX idx_recurring_templates_next_issue ON recurring_invoice_templates(next_issue_date) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE recurring_invoice_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RECURRING_INVOICE_LINES TABLE
-- ============================================================================
CREATE TABLE recurring_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'hours',
  unit_price DECIMAL(15, 2) NOT NULL,
  tax_rate tax_rate NOT NULL DEFAULT 'standard_20',
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recurring_lines_template ON recurring_invoice_lines(template_id);

-- Enable RLS
ALTER TABLE recurring_invoice_lines ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RECURRING TEMPLATES RLS POLICIES
-- ============================================================================

CREATE POLICY "Superadmins can view recurring templates"
  ON recurring_invoice_templates FOR SELECT
  USING (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Superadmins can insert recurring templates"
  ON recurring_invoice_templates FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Superadmins can update recurring templates"
  ON recurring_invoice_templates FOR UPDATE
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Superadmins can delete recurring templates"
  ON recurring_invoice_templates FOR DELETE
  USING (company_id = get_user_company_id() AND is_superadmin());

-- ============================================================================
-- RECURRING LINES RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view recurring lines"
  ON recurring_invoice_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recurring_invoice_templates t
      WHERE t.id = recurring_invoice_lines.template_id
      AND t.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Superadmins can insert recurring lines"
  ON recurring_invoice_lines FOR INSERT
  WITH CHECK (
    is_superadmin()
    AND EXISTS (
      SELECT 1 FROM recurring_invoice_templates t
      WHERE t.id = recurring_invoice_lines.template_id
      AND t.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Superadmins can update recurring lines"
  ON recurring_invoice_lines FOR UPDATE
  USING (
    is_superadmin()
    AND EXISTS (
      SELECT 1 FROM recurring_invoice_templates t
      WHERE t.id = recurring_invoice_lines.template_id
      AND t.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Superadmins can delete recurring lines"
  ON recurring_invoice_lines FOR DELETE
  USING (
    is_superadmin()
    AND EXISTS (
      SELECT 1 FROM recurring_invoice_templates t
      WHERE t.id = recurring_invoice_lines.template_id
      AND t.company_id = get_user_company_id()
    )
  );

-- ============================================================================
-- TRIGGER: Update template totals when lines change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_recurring_template_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_template_id UUID;
  v_subtotal DECIMAL(15, 2);
  v_tax_amount DECIMAL(15, 2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_template_id := OLD.template_id;
  ELSE
    v_template_id := NEW.template_id;
  END IF;

  -- Calculate totals from lines
  SELECT
    COALESCE(SUM(quantity * unit_price), 0),
    COALESCE(SUM(
      CASE tax_rate
        WHEN 'standard_20' THEN quantity * unit_price * 0.20
        WHEN 'reduced_10' THEN quantity * unit_price * 0.10
        ELSE 0
      END
    ), 0)
  INTO v_subtotal, v_tax_amount
  FROM recurring_invoice_lines
  WHERE template_id = v_template_id;

  UPDATE recurring_invoice_templates
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total = v_subtotal + v_tax_amount,
    updated_at = NOW()
  WHERE id = v_template_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_recurring_template_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON recurring_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_template_totals();

-- Apply updated_at triggers
CREATE TRIGGER set_recurring_templates_updated_at
  BEFORE UPDATE ON recurring_invoice_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_recurring_lines_updated_at
  BEFORE UPDATE ON recurring_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
