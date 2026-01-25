-- Seed data for BOTFORCE Unity
-- Run after migrations to set up initial test data

-- ============================================================================
-- Create test company
-- ============================================================================

INSERT INTO companies (id, name, legal_name, vat_number, registration_number, address_line1, postal_code, city, country, email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'BOTFORCE GmbH',
  'BOTFORCE GmbH',
  'ATU12345678',
  'FN 123456a',
  'Teststraße 1',
  '1010',
  'Vienna',
  'AT',
  'office@botforce.at'
);

-- ============================================================================
-- Create test users (you need to create these via Supabase Auth first)
-- These are placeholder UUIDs - replace with actual auth.users IDs
-- ============================================================================

-- To create test users:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Create users with these emails:
--    - admin@botforce.at (superadmin)
--    - employee1@botforce.at (employee)
--    - accountant@botforce.at (accountant)
-- 3. Update the UUIDs below with the actual user IDs

-- Placeholder for manual profile creation after auth users exist:
-- INSERT INTO profiles (id, email, first_name, last_name) VALUES
-- ('ADMIN-UUID-HERE', 'admin@botforce.at', 'Admin', 'User'),
-- ('EMPLOYEE-UUID-HERE', 'employee1@botforce.at', 'Test', 'Employee'),
-- ('ACCOUNTANT-UUID-HERE', 'accountant@botforce.at', 'Test', 'Accountant');

-- Company memberships (update UUIDs after creating auth users):
-- INSERT INTO company_members (company_id, user_id, role) VALUES
-- ('00000000-0000-0000-0000-000000000001', 'ADMIN-UUID-HERE', 'superadmin'),
-- ('00000000-0000-0000-0000-000000000001', 'EMPLOYEE-UUID-HERE', 'employee'),
-- ('00000000-0000-0000-0000-000000000001', 'ACCOUNTANT-UUID-HERE', 'accountant');

-- ============================================================================
-- Create test customers
-- ============================================================================

INSERT INTO customers (id, company_id, name, legal_name, vat_number, email, address_line1, postal_code, city, country, payment_terms_days)
VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Acme Corp', 'Acme Corporation GmbH', 'ATU87654321', 'billing@acme.at', 'Kundenstraße 1', '1020', 'Vienna', 'AT', 30),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Beta Industries', 'Beta Industries KG', 'ATU11223344', 'finance@beta.at', 'Industrieweg 5', '4020', 'Linz', 'AT', 14),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Gamma Solutions', 'Gamma Solutions OG', NULL, 'office@gamma.at', 'Technikgasse 10', '8010', 'Graz', 'AT', 14);

-- ============================================================================
-- Create test projects
-- ============================================================================

INSERT INTO projects (id, company_id, customer_id, name, code, description, billing_type, hourly_rate, budget_hours, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Website Redesign', 'ACME-WEB', 'Complete website redesign for Acme Corp', 'hourly', 120.00, 200, true),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Mobile App', 'ACME-APP', 'Native mobile application', 'hourly', 140.00, 500, true),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'ERP Integration', 'BETA-ERP', 'ERP system integration project', 'fixed', NULL, NULL, true),
  ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'Consulting', 'GAMMA-CON', 'Technical consulting services', 'hourly', 150.00, NULL, true);

-- Set fixed price for BETA-ERP
UPDATE projects SET fixed_price = 25000.00 WHERE id = '00000000-0000-0000-0000-000000000023';

-- ============================================================================
-- Note: Project assignments, time entries, documents, and expenses
-- should be created after auth users are set up, as they reference user IDs.
-- ============================================================================

-- Example project assignment (update USER-UUID after creating auth users):
-- INSERT INTO project_assignments (company_id, project_id, user_id)
-- VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'EMPLOYEE-UUID-HERE');

SELECT 'Seed data loaded successfully. Remember to create auth users and update references.' AS status;
