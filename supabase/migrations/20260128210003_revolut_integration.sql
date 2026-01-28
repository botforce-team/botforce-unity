-- ============================================================================
-- REVOLUT BUSINESS API INTEGRATION
-- Tables for OAuth connections, accounts, transactions, and payments
-- ============================================================================

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE revolut_connection_status AS ENUM ('active', 'expired', 'revoked', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE revolut_sync_status AS ENUM ('pending', 'syncing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE revolut_payment_status AS ENUM ('pending', 'processing', 'completed', 'declined', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- REVOLUT CONNECTIONS
-- Stores OAuth tokens (encrypted) and connection metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS revolut_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- OAuth tokens (encrypted with pgcrypto)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',

  -- Token expiry
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ,

  -- Connection metadata
  revolut_business_id VARCHAR(100),
  status revolut_connection_status NOT NULL DEFAULT 'active',

  -- Sync tracking
  last_sync_at TIMESTAMPTZ,
  last_sync_status revolut_sync_status,
  last_sync_error TEXT,
  sync_cursor TEXT, -- For incremental sync

  -- Timestamps
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_company_revolut UNIQUE (company_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revolut_connections_company ON revolut_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_revolut_connections_status ON revolut_connections(status);

-- Enable RLS
ALTER TABLE revolut_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Superadmins can manage revolut connections" ON revolut_connections;
CREATE POLICY "Superadmins can manage revolut connections"
  ON revolut_connections FOR ALL
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

DROP POLICY IF EXISTS "Users can view revolut connections" ON revolut_connections;
CREATE POLICY "Users can view revolut connections"
  ON revolut_connections FOR SELECT
  USING (company_id = get_user_company_id());

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_revolut_connections_updated_at ON revolut_connections;
CREATE TRIGGER set_revolut_connections_updated_at
  BEFORE UPDATE ON revolut_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- REVOLUT ACCOUNTS
-- Synced bank accounts with balances
-- ============================================================================

CREATE TABLE IF NOT EXISTS revolut_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES revolut_connections(id) ON DELETE CASCADE,

  -- Revolut identifiers
  revolut_account_id VARCHAR(100) NOT NULL,

  -- Account details
  name VARCHAR(255),
  currency VARCHAR(3) NOT NULL,
  balance DECIMAL(18, 2) NOT NULL DEFAULT 0,
  state VARCHAR(50), -- 'active', 'inactive'

  -- IBAN/Account number
  iban VARCHAR(50),
  bic VARCHAR(20),
  account_number VARCHAR(50),
  sort_code VARCHAR(20),

  -- Metadata
  is_primary BOOLEAN DEFAULT FALSE,

  -- Timestamps
  balance_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_revolut_account UNIQUE (company_id, revolut_account_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revolut_accounts_company ON revolut_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_revolut_accounts_connection ON revolut_accounts(connection_id);
CREATE INDEX IF NOT EXISTS idx_revolut_accounts_currency ON revolut_accounts(company_id, currency);

-- Enable RLS
ALTER TABLE revolut_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Superadmins can manage revolut accounts" ON revolut_accounts;
CREATE POLICY "Superadmins can manage revolut accounts"
  ON revolut_accounts FOR ALL
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

DROP POLICY IF EXISTS "Users can view revolut accounts" ON revolut_accounts;
CREATE POLICY "Users can view revolut accounts"
  ON revolut_accounts FOR SELECT
  USING (company_id = get_user_company_id());

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_revolut_accounts_updated_at ON revolut_accounts;
CREATE TRIGGER set_revolut_accounts_updated_at
  BEFORE UPDATE ON revolut_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- REVOLUT TRANSACTIONS
-- Synced transactions with reconciliation support
-- ============================================================================

CREATE TABLE IF NOT EXISTS revolut_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES revolut_accounts(id) ON DELETE CASCADE,

  -- Revolut identifiers
  revolut_transaction_id VARCHAR(100) NOT NULL,
  revolut_leg_id VARCHAR(100),

  -- Transaction details
  type VARCHAR(50) NOT NULL, -- 'transfer', 'card_payment', 'atm', 'fee', 'exchange', etc.
  state VARCHAR(50) NOT NULL, -- 'pending', 'completed', 'declined', 'reverted', 'failed'

  -- Amounts
  amount DECIMAL(18, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  fee DECIMAL(18, 2) DEFAULT 0,

  -- Running balance after transaction
  balance_after DECIMAL(18, 2),

  -- Counterparty info
  counterparty_name VARCHAR(255),
  counterparty_account_id VARCHAR(100),
  counterparty_account_type VARCHAR(50),

  -- Reference/Description
  reference VARCHAR(255),
  description TEXT,

  -- Merchant info (for card payments)
  merchant_name VARCHAR(255),
  merchant_category_code VARCHAR(10),
  merchant_city VARCHAR(100),
  merchant_country VARCHAR(2),

  -- Card info
  card_last_four VARCHAR(4),

  -- Dates
  transaction_date DATE NOT NULL,
  created_at_revolut TIMESTAMPTZ,
  completed_at_revolut TIMESTAMPTZ,

  -- Local categorization/linking
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  category VARCHAR(100),
  is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES profiles(id),
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_revolut_transaction UNIQUE (company_id, revolut_transaction_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revolut_transactions_company ON revolut_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_revolut_transactions_account ON revolut_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_revolut_transactions_date ON revolut_transactions(company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_revolut_transactions_type ON revolut_transactions(company_id, type);
CREATE INDEX IF NOT EXISTS idx_revolut_transactions_state ON revolut_transactions(company_id, state);
CREATE INDEX IF NOT EXISTS idx_revolut_transactions_reconciled ON revolut_transactions(company_id, is_reconciled);
CREATE INDEX IF NOT EXISTS idx_revolut_transactions_expense ON revolut_transactions(expense_id) WHERE expense_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_revolut_transactions_document ON revolut_transactions(document_id) WHERE document_id IS NOT NULL;

-- Enable RLS
ALTER TABLE revolut_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Superadmins can manage revolut transactions" ON revolut_transactions;
CREATE POLICY "Superadmins can manage revolut transactions"
  ON revolut_transactions FOR ALL
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

DROP POLICY IF EXISTS "Accountants can view and update revolut transactions" ON revolut_transactions;
CREATE POLICY "Accountants can view and update revolut transactions"
  ON revolut_transactions FOR SELECT
  USING (company_id = get_user_company_id() AND get_user_role() IN ('superadmin', 'accountant'));

DROP POLICY IF EXISTS "Accountants can reconcile transactions" ON revolut_transactions;
CREATE POLICY "Accountants can reconcile transactions"
  ON revolut_transactions FOR UPDATE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('superadmin', 'accountant'))
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('superadmin', 'accountant'));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_revolut_transactions_updated_at ON revolut_transactions;
CREATE TRIGGER set_revolut_transactions_updated_at
  BEFORE UPDATE ON revolut_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- REVOLUT PAYMENTS
-- Outgoing payments initiated via the app
-- ============================================================================

CREATE TABLE IF NOT EXISTS revolut_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES revolut_connections(id) ON DELETE CASCADE,

  -- Source account
  source_account_id UUID REFERENCES revolut_accounts(id),

  -- Revolut payment ID (assigned after submission)
  revolut_payment_id VARCHAR(100),

  -- Payment details
  amount DECIMAL(18, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  reference VARCHAR(140), -- SEPA reference max 140 chars

  -- Recipient info
  recipient_name VARCHAR(255) NOT NULL,
  recipient_iban VARCHAR(50),
  recipient_bic VARCHAR(20),
  recipient_account_number VARCHAR(50),
  recipient_sort_code VARCHAR(20),
  recipient_country VARCHAR(2),

  -- Status tracking
  status revolut_payment_status NOT NULL DEFAULT 'pending',
  reason_code VARCHAR(100),
  error_message TEXT,

  -- Linked entities
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,

  -- Idempotency key
  request_id VARCHAR(100) UNIQUE,

  -- Initiated by
  created_by UUID NOT NULL REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),

  -- Timestamps
  scheduled_date DATE,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revolut_payments_company ON revolut_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_revolut_payments_status ON revolut_payments(company_id, status);
CREATE INDEX IF NOT EXISTS idx_revolut_payments_document ON revolut_payments(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_revolut_payments_expense ON revolut_payments(expense_id) WHERE expense_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_revolut_payments_created_by ON revolut_payments(created_by);

-- Enable RLS
ALTER TABLE revolut_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Superadmins can manage revolut payments" ON revolut_payments;
CREATE POLICY "Superadmins can manage revolut payments"
  ON revolut_payments FOR ALL
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

DROP POLICY IF EXISTS "Accountants can view revolut payments" ON revolut_payments;
CREATE POLICY "Accountants can view revolut payments"
  ON revolut_payments FOR SELECT
  USING (company_id = get_user_company_id() AND get_user_role() IN ('superadmin', 'accountant'));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_revolut_payments_updated_at ON revolut_payments;
CREATE TRIGGER set_revolut_payments_updated_at
  BEFORE UPDATE ON revolut_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- REVOLUT SYNC LOG
-- Audit trail for sync operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS revolut_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES revolut_connections(id) ON DELETE CASCADE,

  -- Sync details
  sync_type VARCHAR(50) NOT NULL, -- 'accounts', 'transactions', 'full'
  status revolut_sync_status NOT NULL,

  -- Stats
  records_fetched INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revolut_sync_log_company ON revolut_sync_log(company_id);
CREATE INDEX IF NOT EXISTS idx_revolut_sync_log_connection ON revolut_sync_log(connection_id);
CREATE INDEX IF NOT EXISTS idx_revolut_sync_log_started ON revolut_sync_log(started_at DESC);

-- Enable RLS
ALTER TABLE revolut_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Admins can view sync logs" ON revolut_sync_log;
CREATE POLICY "Admins can view sync logs"
  ON revolut_sync_log FOR SELECT
  USING (company_id = get_user_company_id() AND get_user_role() IN ('superadmin', 'accountant'));

DROP POLICY IF EXISTS "System can manage sync logs" ON revolut_sync_log;
CREATE POLICY "System can manage sync logs"
  ON revolut_sync_log FOR ALL
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

-- ============================================================================
-- HELPER FUNCTION: Check if user is accountant
-- ============================================================================

CREATE OR REPLACE FUNCTION is_accountant()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE user_id = auth.uid()
    AND is_active = TRUE
    AND role = 'accountant'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
