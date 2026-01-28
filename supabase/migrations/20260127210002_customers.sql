-- ============================================================================
-- TAX RATE ENUM
-- ============================================================================
CREATE TYPE tax_rate AS ENUM ('standard_20', 'reduced_10', 'zero', 'reverse_charge');

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  legal_name TEXT,
  vat_number TEXT,
  tax_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  reverse_charge BOOLEAN NOT NULL DEFAULT FALSE,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'AT',
  payment_terms_days INTEGER NOT NULL DEFAULT 14,
  default_tax_rate tax_rate NOT NULL DEFAULT 'standard_20',
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_customers_active ON customers(company_id, is_active);
CREATE INDEX idx_customers_name ON customers(company_id, name);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CUSTOMERS RLS POLICIES
-- ============================================================================

-- Superadmins can do everything with customers
CREATE POLICY "Superadmins can view all customers"
  ON customers FOR SELECT
  USING (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Superadmins can insert customers"
  ON customers FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Superadmins can update customers"
  ON customers FOR UPDATE
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Superadmins can delete customers"
  ON customers FOR DELETE
  USING (company_id = get_user_company_id() AND is_superadmin());

-- ============================================================================
-- TRIGGER: Auto-detect reverse charge
-- For EU countries (except Austria), if customer has VAT number, set reverse_charge
-- ============================================================================
CREATE OR REPLACE FUNCTION check_reverse_charge()
RETURNS TRIGGER AS $$
DECLARE
  eu_countries TEXT[] := ARRAY['BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'EL', 'ES', 'FR', 'HR', 'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SI', 'SK', 'FI', 'SE'];
BEGIN
  -- Auto-set reverse_charge for EU B2B (non-AT with VAT number)
  IF NEW.country != 'AT'
     AND NEW.country = ANY(eu_countries)
     AND NEW.vat_number IS NOT NULL
     AND NEW.vat_number != '' THEN
    NEW.reverse_charge := TRUE;
    NEW.default_tax_rate := 'reverse_charge';
  ELSE
    -- If not EU or no VAT, ensure reverse_charge is false (unless manually set)
    IF NEW.country = 'AT' THEN
      NEW.reverse_charge := FALSE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_customer_reverse_charge
  BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION check_reverse_charge();

-- Apply updated_at trigger
CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
