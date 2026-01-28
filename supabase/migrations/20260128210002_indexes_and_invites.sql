-- ============================================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_company_active ON customers(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(company_id, name);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_company_active ON projects(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id, is_active);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(company_id, code);

-- Time entries indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_date ON time_entries(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(company_id, status);
CREATE INDEX IF NOT EXISTS idx_time_entries_billable ON time_entries(company_id, is_billable, status);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(company_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(company_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_reimbursable ON expenses(company_id, is_reimbursable, reimbursed_at);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_number ON documents(company_id, document_number);
CREATE INDEX IF NOT EXISTS idx_documents_issue_date ON documents(company_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_due_date ON documents(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_documents_status_type ON documents(company_id, document_type, status);

-- Document lines indexes
CREATE INDEX IF NOT EXISTS idx_document_lines_project ON document_lines(project_id);

-- Project assignments indexes
CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON project_assignments(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id, is_active);

-- Company members indexes
CREATE INDEX IF NOT EXISTS idx_company_members_user_active ON company_members(user_id, is_active);

-- Recurring invoice templates indexes
CREATE INDEX IF NOT EXISTS idx_recurring_templates_active ON recurring_invoice_templates(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_next_date ON recurring_invoice_templates(next_issue_date) WHERE is_active = true;

-- Files indexes
CREATE INDEX IF NOT EXISTS idx_files_company_category ON files(company_id, category);

-- Accounting exports indexes
CREATE INDEX IF NOT EXISTS idx_accounting_exports_company ON accounting_exports(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_exports_period ON accounting_exports(company_id, period_start, period_end);

-- ============================================================================
-- TEAM INVITES TABLE
-- For tracking pending team invitations
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  hourly_rate DECIMAL(10, 2),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for team_invites
CREATE INDEX IF NOT EXISTS idx_team_invites_company ON team_invites(company_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_expires ON team_invites(expires_at) WHERE accepted_at IS NULL;

-- RLS for team_invites (disabled for now to avoid recursion issues)
-- ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RECEIPTS STORAGE BUCKET
-- Create the storage bucket for receipt uploads if it doesn't exist
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts bucket
CREATE POLICY "Users can upload receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Users can view receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'receipts');

CREATE POLICY "Users can delete their receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'receipts');
