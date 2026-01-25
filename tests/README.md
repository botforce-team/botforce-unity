# BOTFORCE Unity Test Suite

## Overview

This directory contains tests for the BOTFORCE Unity application, including:

- **RLS Policy Tests**: SQL-based tests for Row Level Security
- **API Tests**: Server action and API route tests
- **Integration Tests**: End-to-end workflow tests

## Prerequisites

1. **Local Supabase instance running**
   ```bash
   supabase start
   ```

2. **Database migrated**
   ```bash
   supabase db reset
   ```

3. **Test users created** in Supabase Auth Dashboard:
   - `admin@botforce.at` (password: `testadmin123`)
   - `employee1@botforce.at` (password: `testemployee123`)
   - `accountant@botforce.at` (password: `testaccountant123`)

## Running RLS Tests

### Manual Testing via Supabase Dashboard

1. Open Supabase Studio: `http://localhost:54323`
2. Go to SQL Editor
3. Copy and run sections from `rls_tests.sql`

### Automated Testing

```bash
# Connect to local database
psql postgresql://postgres:postgres@localhost:54322/postgres

# Run RLS tests
\i tests/rls_tests.sql
```

## Test Cases

### 1. Employee Project Assignment

**Scenario**: Employee tries to access unassigned project

**Steps**:
1. Login as `employee1@botforce.at`
2. Query projects table
3. Should only see assigned projects

**Expected**: Only assigned projects visible

**Verification**:
```sql
-- As employee (set JWT first)
SELECT id, name FROM projects;
-- Should return only assigned projects, not all 4
```

### 2. Employee Time Entry Restriction

**Scenario**: Employee tries to create time entry for unassigned project

**Steps**:
1. Login as `employee1@botforce.at`
2. Get ID of project not assigned to employee
3. Try to insert time entry for that project

**Expected**: Insert fails with RLS violation

**Verification**:
```sql
-- This should fail
INSERT INTO time_entries (company_id, project_id, user_id, date, hours)
VALUES ('company-id', 'unassigned-project-id', 'employee-id', '2026-01-25', 2);
-- Error: new row violates row-level security policy
```

### 3. Sequential Document Numbering

**Scenario**: Generate multiple invoice numbers

**Steps**:
1. Call `get_next_document_number` multiple times
2. Verify numbers are sequential

**Expected**: INV-2026-00001, INV-2026-00002, etc.

**Verification**:
```sql
SELECT get_next_document_number('company-id', 'invoice');
SELECT get_next_document_number('company-id', 'invoice');
-- Should increment each time
```

### 4. Document Immutability

**Scenario**: Try to modify issued invoice

**Steps**:
1. Create draft invoice
2. Issue the invoice
3. Try to modify locked fields

**Expected**: Modification fails for locked documents

**Verification**:
```sql
-- After issuing
UPDATE documents SET notes = 'Changed' WHERE id = 'doc-id';
-- Error: Cannot modify locked document
```

### 5. Accountant Access Control

**Scenario**: Accountant tries to modify documents

**Steps**:
1. Login as `accountant@botforce.at`
2. Try to create/update/delete document

**Expected**: All modifications fail, only SELECT works

### 6. Audit Trail

**Scenario**: Verify audit logging for document issue

**Steps**:
1. Issue a document
2. Query audit_log table

**Expected**: Entry exists with action='issue_document'

**Verification**:
```sql
SELECT * FROM audit_log
WHERE table_name = 'documents'
  AND action = 'issue_document'
ORDER BY created_at DESC
LIMIT 1;
```

## Application Tests

### Running Next.js Tests

```bash
cd apps/web
pnpm test
```

### Test Coverage Areas

1. **Authentication**
   - Login flow
   - Session management
   - Redirect behavior

2. **Time Entry CRUD**
   - Create entry
   - Update draft entry
   - Submit entry
   - Employee cannot edit submitted entry

3. **Document Workflow**
   - Create invoice
   - Add line items
   - Issue invoice
   - Mark as paid

4. **Role-based UI**
   - Admin sees all navigation
   - Employee sees limited navigation
   - Accountant sees read-only views

## Test Data Setup

Run the seed script to create initial test data:

```bash
psql $DATABASE_URL -f supabase/seed/seed.sql
```

Then manually:

1. Create auth users via Supabase Dashboard
2. Update company_members with actual user IDs
3. Create project_assignments for employees

## Troubleshooting

### RLS Blocking All Queries

Make sure you're authenticated. In Supabase Studio, queries run as the service role which bypasses RLS. Use the API or SDK for accurate RLS testing.

### JWT Token Issues

When testing programmatically, ensure you're setting the correct JWT token to simulate different users.

### Migration Errors

If tests fail due to missing tables/functions:
```bash
supabase db reset
```

This reapplies all migrations from scratch.
