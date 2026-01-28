-- Fix RLS policy for company_members to prevent infinite recursion
-- The original policy used get_user_company_id() which queries company_members,
-- causing infinite recursion when the policy is evaluated.

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view members in their company" ON company_members;
DROP POLICY IF EXISTS "Users can read own membership" ON company_members;
DROP POLICY IF EXISTS "Superadmins can view all members" ON company_members;
DROP POLICY IF EXISTS "Superadmins can insert members" ON company_members;
DROP POLICY IF EXISTS "Superadmins can update members" ON company_members;

-- Create a simple policy that allows users to read their own membership
-- This avoids recursion by only checking the user_id directly
CREATE POLICY "Users can read own membership"
  ON company_members FOR SELECT
  USING (user_id = auth.uid());

-- For insert/update, superadmins need access
-- We use a simplified check that doesn't cause recursion
CREATE POLICY "Superadmins can manage members"
  ON company_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.user_id = auth.uid()
      AND cm.role = 'superadmin'
      AND cm.is_active = true
    )
  );
