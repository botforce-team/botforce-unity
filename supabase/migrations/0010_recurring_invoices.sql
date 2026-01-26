-- ============================================================================
-- Migration: Recurring Invoices
-- Description: Adds support for recurring invoice templates
-- ============================================================================

-- Create enum for recurrence frequency
DO $$ BEGIN
  CREATE TYPE recurrence_frequency AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Recurring Invoice Templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Template details
  name TEXT NOT NULL,
  description TEXT,

  -- Recurrence settings
  frequency recurrence_frequency NOT NULL DEFAULT 'monthly',
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28), -- For monthly/quarterly/yearly
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- For weekly/biweekly (0=Sunday)

  -- Invoice defaults
  payment_terms_days INTEGER NOT NULL DEFAULT 14,
  notes TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_issue_date DATE,
  last_issued_at TIMESTAMPTZ,

  -- Totals (calculated from lines)
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- Recurring Invoice Template Lines
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurring_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,

  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_price NUMERIC(12,2) NOT NULL,
  tax_rate tax_rate NOT NULL DEFAULT 'standard_20',

  -- Calculated fields
  subtotal NUMERIC(12,2) NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED,

  -- Optional project link
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Track generated invoices from templates
-- ============================================================================

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS recurring_template_id UUID REFERENCES recurring_invoice_templates(id) ON DELETE SET NULL;

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_recurring_templates_company ON recurring_invoice_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_customer ON recurring_invoice_templates(customer_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_next_issue ON recurring_invoice_templates(next_issue_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_recurring_lines_template ON recurring_invoice_lines(template_id);
CREATE INDEX IF NOT EXISTS idx_documents_recurring_template ON documents(recurring_template_id) WHERE recurring_template_id IS NOT NULL;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at
CREATE TRIGGER set_recurring_templates_updated_at
  BEFORE UPDATE ON recurring_invoice_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_recurring_lines_updated_at
  BEFORE UPDATE ON recurring_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Calculate template totals when lines change
CREATE OR REPLACE FUNCTION update_recurring_template_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_tax_amount NUMERIC(12,2);
BEGIN
  -- Calculate totals from lines
  SELECT
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(
      CASE tax_rate
        WHEN 'standard_20' THEN subtotal * 0.20
        WHEN 'reduced_10' THEN subtotal * 0.10
        ELSE 0
      END
    ), 0)
  INTO v_subtotal, v_tax_amount
  FROM recurring_invoice_lines
  WHERE template_id = COALESCE(NEW.template_id, OLD.template_id);

  -- Update template
  UPDATE recurring_invoice_templates
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total = v_subtotal + v_tax_amount
  WHERE id = COALESCE(NEW.template_id, OLD.template_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_recurring_template_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON recurring_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_template_totals();

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE recurring_invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoice_lines ENABLE ROW LEVEL SECURITY;

-- Templates: Company members can view, admins can modify
CREATE POLICY recurring_templates_select ON recurring_invoice_templates
  FOR SELECT USING (is_company_member(company_id));

CREATE POLICY recurring_templates_insert ON recurring_invoice_templates
  FOR INSERT WITH CHECK (is_superadmin(company_id));

CREATE POLICY recurring_templates_update ON recurring_invoice_templates
  FOR UPDATE USING (is_superadmin(company_id));

CREATE POLICY recurring_templates_delete ON recurring_invoice_templates
  FOR DELETE USING (is_superadmin(company_id));

-- Lines: Same as templates
CREATE POLICY recurring_lines_select ON recurring_invoice_lines
  FOR SELECT USING (is_company_member(company_id));

CREATE POLICY recurring_lines_insert ON recurring_invoice_lines
  FOR INSERT WITH CHECK (is_superadmin(company_id));

CREATE POLICY recurring_lines_update ON recurring_invoice_lines
  FOR UPDATE USING (is_superadmin(company_id));

CREATE POLICY recurring_lines_delete ON recurring_invoice_lines
  FOR DELETE USING (is_superadmin(company_id));

-- ============================================================================
-- Function to process recurring invoices
-- ============================================================================

CREATE OR REPLACE FUNCTION process_recurring_invoices()
RETURNS TABLE(template_id UUID, document_id UUID, status TEXT) AS $$
DECLARE
  v_template RECORD;
  v_line RECORD;
  v_doc_id UUID;
  v_next_date DATE;
BEGIN
  -- Find all active templates due for processing
  FOR v_template IN
    SELECT t.*, c.name as customer_name
    FROM recurring_invoice_templates t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.is_active = true
    AND t.next_issue_date <= CURRENT_DATE
  LOOP
    -- Create draft invoice
    INSERT INTO documents (
      company_id,
      customer_id,
      document_type,
      status,
      payment_terms_days,
      notes,
      recurring_template_id
    ) VALUES (
      v_template.company_id,
      v_template.customer_id,
      'invoice',
      'draft',
      v_template.payment_terms_days,
      v_template.notes,
      v_template.id
    ) RETURNING id INTO v_doc_id;

    -- Copy lines
    INSERT INTO document_lines (
      company_id,
      document_id,
      line_number,
      description,
      quantity,
      unit,
      unit_price,
      tax_rate,
      project_id
    )
    SELECT
      company_id,
      v_doc_id,
      line_number,
      description,
      quantity,
      unit,
      unit_price,
      tax_rate,
      project_id
    FROM recurring_invoice_lines
    WHERE template_id = v_template.id
    ORDER BY line_number;

    -- Calculate next issue date
    v_next_date := CASE v_template.frequency
      WHEN 'weekly' THEN v_template.next_issue_date + INTERVAL '1 week'
      WHEN 'biweekly' THEN v_template.next_issue_date + INTERVAL '2 weeks'
      WHEN 'monthly' THEN v_template.next_issue_date + INTERVAL '1 month'
      WHEN 'quarterly' THEN v_template.next_issue_date + INTERVAL '3 months'
      WHEN 'yearly' THEN v_template.next_issue_date + INTERVAL '1 year'
    END;

    -- Update template
    UPDATE recurring_invoice_templates
    SET
      next_issue_date = v_next_date,
      last_issued_at = now()
    WHERE id = v_template.id;

    -- Return result
    template_id := v_template.id;
    document_id := v_doc_id;
    status := 'created';
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update database types (add to types/database.ts manually)
-- ============================================================================

COMMENT ON TABLE recurring_invoice_templates IS 'Templates for automatically generating recurring invoices';
COMMENT ON TABLE recurring_invoice_lines IS 'Line items for recurring invoice templates';
COMMENT ON FUNCTION process_recurring_invoices IS 'Processes due recurring invoice templates and creates draft invoices';
