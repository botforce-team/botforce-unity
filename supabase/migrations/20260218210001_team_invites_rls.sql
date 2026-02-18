-- ============================================================================
-- Enable RLS on team_invites
-- All app access uses the admin client (service role) which bypasses RLS,
-- so this just protects against direct API access via anon/authenticated keys.
-- ============================================================================

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Superadmins can manage invites for their company
CREATE POLICY "Superadmins can view team invites"
  ON team_invites FOR SELECT
  USING (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Superadmins can create team invites"
  ON team_invites FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Superadmins can update team invites"
  ON team_invites FOR UPDATE
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

CREATE POLICY "Superadmins can delete team invites"
  ON team_invites FOR DELETE
  USING (company_id = get_user_company_id() AND is_superadmin());
