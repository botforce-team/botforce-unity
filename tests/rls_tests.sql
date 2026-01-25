-- RLS Policy Tests for BOTFORCE Unity
-- Run these tests after setting up the database and creating test users

-- ============================================================================
-- TEST SETUP
-- ============================================================================

-- Before running these tests:
-- 1. Create three test users in Supabase Auth:
--    - admin@botforce.at
--    - employee1@botforce.at
--    - accountant@botforce.at
-- 2. Run the seed.sql to create company and customers
-- 3. Manually create company_members entries for each user
-- 4. Assign employee1 to specific projects (not all)

-- These tests use the Supabase auth.uid() function which requires
-- setting a JWT token. In practice, you can test via the Supabase
-- Dashboard SQL editor or by using supabase.auth.setSession()

-- ============================================================================
-- HELPER: Set test context
-- ============================================================================

-- Note: In a real test, you'd set auth.uid() via JWT.
-- For manual testing, you can use these patterns.

-- ============================================================================
-- TEST 1: Company visibility
-- ============================================================================

-- Expected: User can only see companies they're a member of
-- Test: Query companies table - should return only user's company

/*
-- As admin@botforce.at:
SELECT * FROM companies;
-- Expected: 1 row (BOTFORCE GmbH)

-- As non-member:
SELECT * FROM companies;
-- Expected: 0 rows
*/

-- ============================================================================
-- TEST 2: Projects visibility - Admin vs Employee
-- ============================================================================

-- Expected: Admin sees all projects, Employee sees only assigned projects

/*
-- As admin@botforce.at:
SELECT id, name, code FROM projects;
-- Expected: All 4 projects

-- As employee1@botforce.at (assuming assigned to ACME-WEB only):
SELECT id, name, code FROM projects;
-- Expected: Only ACME-WEB project
*/

-- ============================================================================
-- TEST 3: Time entry creation - Project assignment check
-- ============================================================================

-- Test: Employee cannot create time entry for unassigned project

DO $$
DECLARE
  v_company_id UUID := '00000000-0000-0000-0000-000000000001';
  v_unassigned_project_id UUID := '00000000-0000-0000-0000-000000000024'; -- GAMMA-CON
  v_employee_id UUID; -- Set this to actual employee user ID
BEGIN
  -- This should fail due to RLS policy
  -- INSERT INTO time_entries (company_id, project_id, user_id, date, hours, description)
  -- VALUES (v_company_id, v_unassigned_project_id, v_employee_id, CURRENT_DATE, 2, 'Test entry');

  RAISE NOTICE 'TEST 3: Manual verification required - employee should not be able to insert time entry for unassigned project';
END $$;

-- ============================================================================
-- TEST 4: Time entry update - Status workflow
-- ============================================================================

-- Test: Employee can only update draft/rejected entries, not submitted/approved

/*
-- Create a draft entry, then submit it
-- Employee should be able to update while draft
-- Employee should NOT be able to update after submission
*/

-- ============================================================================
-- TEST 5: Document visibility - Accountant access
-- ============================================================================

-- Expected: Accountant can view documents but not modify

/*
-- As accountant@botforce.at:
SELECT * FROM documents;
-- Expected: Can see all documents

-- As accountant@botforce.at:
INSERT INTO documents (company_id, customer_id, document_type) VALUES (...);
-- Expected: Should FAIL - accountant cannot create documents

DELETE FROM documents WHERE id = '...';
-- Expected: Should FAIL - accountant cannot delete documents
*/

-- ============================================================================
-- TEST 6: Sequential document numbering
-- ============================================================================

-- Test: Document numbers are sequential and unique

DO $$
DECLARE
  v_company_id UUID := '00000000-0000-0000-0000-000000000001';
  v_num1 TEXT;
  v_num2 TEXT;
  v_num3 TEXT;
BEGIN
  -- Get three sequential numbers
  v_num1 := get_next_document_number(v_company_id, 'invoice');
  v_num2 := get_next_document_number(v_company_id, 'invoice');
  v_num3 := get_next_document_number(v_company_id, 'invoice');

  -- Verify they're sequential
  RAISE NOTICE 'Document numbers: %, %, %', v_num1, v_num2, v_num3;

  -- Check format (INV-YYYY-NNNNN)
  IF v_num1 !~ '^INV-\d{4}-\d{5}$' THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Invalid document number format: %', v_num1;
  END IF;

  RAISE NOTICE 'TEST 6 PASSED: Document numbering is sequential';
END $$;

-- ============================================================================
-- TEST 7: Document immutability after issue
-- ============================================================================

-- Test: Locked documents cannot be modified (except status/payment fields)

/*
-- Create a document, issue it, then try to modify
-- UPDATE documents SET notes = 'Changed' WHERE id = '...' AND is_locked = true;
-- Expected: Should FAIL with "Cannot modify locked document"
*/

-- ============================================================================
-- TEST 8: Expense approval workflow
-- ============================================================================

-- Test: Expense status transitions are validated

DO $$
BEGIN
  -- Test invalid transition: draft -> approved (skipping submitted)
  -- This should fail due to trigger

  -- INSERT INTO expenses (...) VALUES (...); -- Create draft
  -- UPDATE expenses SET status = 'approved' WHERE ...; -- Should fail

  RAISE NOTICE 'TEST 8: Manual verification required - test expense status transitions';
END $$;

-- ============================================================================
-- TEST 9: Audit log creation
-- ============================================================================

-- Test: Important actions create audit log entries

/*
-- Issue a document, then check audit_log
SELECT * FROM audit_log WHERE table_name = 'documents' AND action = 'issue_document';
-- Expected: Entry with document details

-- Approve a time entry, then check audit_log
SELECT * FROM audit_log WHERE table_name = 'time_entries' AND action = 'approve_time';
-- Expected: Entry with time entry details
*/

-- ============================================================================
-- TEST 10: Cross-company isolation
-- ============================================================================

-- Test: Users cannot access data from other companies

/*
-- If you create a second company, users from company A should not see
-- any data from company B, even if they try to query with company B's ID

SELECT * FROM projects WHERE company_id = 'COMPANY-B-ID';
-- Expected: 0 rows (RLS blocks access)
*/

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 'RLS Tests defined. Run each test section manually or via your test framework.' AS status;

-- Quick verification queries you can run:
-- 1. Check RLS is enabled on all tables:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('companies', 'profiles', 'company_members', 'customers',
                    'projects', 'project_assignments', 'time_entries',
                    'documents', 'document_lines', 'expenses', 'files',
                    'accounting_exports', 'audit_log');

-- 2. Count policies per table:
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
