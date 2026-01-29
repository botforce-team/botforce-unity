-- ============================================================================
-- SEED DATA FOR DEVELOPMENT
-- Creates test users, company, and sample data
-- ============================================================================

-- Note: This seed file is designed to be run after migrations
-- Users are created via Supabase Auth, then we add company and membership data

-- ============================================================================
-- CREATE TEST COMPANY
-- ============================================================================
INSERT INTO companies (
  id,
  name,
  legal_name,
  vat_number,
  registration_number,
  address_line1,
  postal_code,
  city,
  country,
  email,
  phone,
  website,
  settings
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'BOTFORCE',
  'BOTFORCE GmbH',
  'ATU12345678',
  'FN 123456a',
  'Mariahilfer Straße 1',
  '1060',
  'Vienna',
  'AT',
  'office@botforce.at',
  '+43 1 234 5678',
  'https://www.botforce.at',
  '{
    "default_payment_terms_days": 14,
    "invoice_prefix": "INV",
    "credit_note_prefix": "CN",
    "default_tax_rate": "standard_20",
    "mileage_rate": 0.42
  }'::jsonb
);

-- ============================================================================
-- NOTE: Users must be created via Supabase Auth
-- After running this seed, create these users in the Supabase Dashboard:
--
-- 1. admin@botforce.at (password: password123) - Superadmin
-- 2. employee@botforce.at (password: password123) - Employee
-- 3. accountant@botforce.at (password: password123) - Accountant
--
-- Then run the membership inserts below with the correct user IDs
-- ============================================================================

-- Placeholder for company members (update user IDs after creating users via Auth)
-- These will be inserted after users are created in auth.users

-- ============================================================================
-- SAMPLE CUSTOMERS
-- ============================================================================
INSERT INTO customers (
  id,
  company_id,
  name,
  legal_name,
  vat_number,
  email,
  address_line1,
  postal_code,
  city,
  country,
  payment_terms_days,
  default_tax_rate
) VALUES
(
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'TechCorp Austria',
  'TechCorp Austria GmbH',
  'ATU87654321',
  'contact@techcorp.at',
  'Kärntner Ring 10',
  '1010',
  'Vienna',
  'AT',
  14,
  'standard_20'
),
(
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'Digital Solutions Germany',
  'Digital Solutions GmbH',
  'DE123456789',
  'info@digitalsolutions.de',
  'Friedrichstraße 100',
  '10117',
  'Berlin',
  'DE',
  30,
  'reverse_charge'
),
(
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000001',
  'StartupXYZ',
  'StartupXYZ e.U.',
  NULL,
  'hello@startupxyz.at',
  'Gumpendorfer Straße 50',
  '1060',
  'Vienna',
  'AT',
  7,
  'standard_20'
);

-- ============================================================================
-- SAMPLE PROJECTS
-- ============================================================================
INSERT INTO projects (
  id,
  company_id,
  customer_id,
  name,
  code,
  description,
  billing_type,
  hourly_rate,
  budget_hours,
  is_active,
  is_billable
) VALUES
(
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Website Redesign',
  'TC-WEB',
  'Complete website redesign with new CMS',
  'hourly',
  120.00,
  200,
  TRUE,
  TRUE
),
(
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Mobile App Development',
  'TC-APP',
  'Native mobile app for iOS and Android',
  'fixed',
  NULL,
  500,
  TRUE,
  TRUE
),
(
  '00000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  'API Integration',
  'DS-API',
  'REST API integration with third-party services',
  'hourly',
  150.00,
  80,
  TRUE,
  TRUE
),
(
  '00000000-0000-0000-0000-000000000023',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000012',
  'MVP Development',
  'SX-MVP',
  'Minimum viable product development',
  'hourly',
  100.00,
  300,
  TRUE,
  TRUE
);

-- ============================================================================
-- HELPER FUNCTION: Setup test users after auth creation
-- Run this function after creating users via Supabase Auth Dashboard
-- ============================================================================
CREATE OR REPLACE FUNCTION setup_test_users()
RETURNS void AS $$
DECLARE
  v_admin_id UUID;
  v_employee_id UUID;
  v_accountant_id UUID;
BEGIN
  -- Get user IDs by email
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@botforce.at';
  SELECT id INTO v_employee_id FROM auth.users WHERE email = 'employee@botforce.at';
  SELECT id INTO v_accountant_id FROM auth.users WHERE email = 'accountant@botforce.at';

  -- Create company memberships
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO company_members (company_id, user_id, role, hourly_rate, is_active, joined_at)
    VALUES ('00000000-0000-0000-0000-000000000001', v_admin_id, 'superadmin', 150.00, TRUE, NOW())
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END IF;

  IF v_employee_id IS NOT NULL THEN
    INSERT INTO company_members (company_id, user_id, role, hourly_rate, is_active, joined_at)
    VALUES ('00000000-0000-0000-0000-000000000001', v_employee_id, 'employee', 80.00, TRUE, NOW())
    ON CONFLICT (company_id, user_id) DO NOTHING;

    -- Assign employee to projects
    INSERT INTO project_assignments (project_id, user_id, is_active)
    VALUES
      ('00000000-0000-0000-0000-000000000020', v_employee_id, TRUE),
      ('00000000-0000-0000-0000-000000000023', v_employee_id, TRUE)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;

  IF v_accountant_id IS NOT NULL THEN
    INSERT INTO company_members (company_id, user_id, role, hourly_rate, is_active, joined_at)
    VALUES ('00000000-0000-0000-0000-000000000001', v_accountant_id, 'accountant', NULL, TRUE, NOW())
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Test users setup complete';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Add any user as superadmin
-- Use this to add your actual user account to the company
-- ============================================================================
CREATE OR REPLACE FUNCTION add_user_as_superadmin(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Get user ID by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = user_email;

  IF v_user_id IS NULL THEN
    RETURN 'Error: User with email ' || user_email || ' not found in auth.users';
  END IF;

  -- Check if company exists
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = v_company_id) THEN
    -- Create the company if it doesn't exist
    INSERT INTO companies (id, name, legal_name, country, settings)
    VALUES (v_company_id, 'BOTFORCE', 'BOTFORCE GmbH', 'AT', '{}'::jsonb);
  END IF;

  -- Create company membership
  INSERT INTO company_members (company_id, user_id, role, hourly_rate, is_active, joined_at)
  VALUES (v_company_id, v_user_id, 'superadmin', 150.00, TRUE, NOW())
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET role = 'superadmin', is_active = TRUE;

  RETURN 'Success: User ' || user_email || ' added as superadmin to BOTFORCE company';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INSTRUCTIONS
-- ============================================================================
-- 1. Run migrations: supabase db push
-- 2. Create users in Supabase Dashboard (Authentication > Users):
--    - admin@botforce.at / password123
--    - employee@botforce.at / password123
--    - accountant@botforce.at / password123
-- 3. Run: SELECT setup_test_users();
--
-- OR: To add your own user as superadmin:
-- Run: SELECT add_user_as_superadmin('your-email@example.com');
-- ============================================================================
