-- ============================================================================
-- PROFILES TABLE
-- Stores user profile information linked to auth.users
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- COMPANIES TABLE
-- Stores company/tenant information
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  vat_number TEXT,
  registration_number TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'AT',
  email TEXT,
  phone TEXT,
  website TEXT,
  logo_url TEXT,
  settings JSONB NOT NULL DEFAULT '{
    "default_payment_terms_days": 14,
    "invoice_prefix": "INV",
    "credit_note_prefix": "CN",
    "default_tax_rate": "standard_20",
    "mileage_rate": 0.42
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMPANY_MEMBERS TABLE
-- Links users to companies with roles
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('superadmin', 'employee', 'accountant');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'employee',
  hourly_rate DECIMAL(15, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_active ON company_members(company_id, is_active);

-- Enable RLS
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Helper function to get user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM company_members
  WHERE user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to get user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM company_members
  WHERE user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to check if user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE user_id = auth.uid()
    AND is_active = TRUE
    AND role = 'superadmin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Companies RLS: Users can only see their company
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  USING (id = get_user_company_id());

DROP POLICY IF EXISTS "Superadmins can update their company" ON companies;
CREATE POLICY "Superadmins can update their company"
  ON companies FOR UPDATE
  USING (id = get_user_company_id() AND is_superadmin())
  WITH CHECK (id = get_user_company_id() AND is_superadmin());

-- Company members RLS
DROP POLICY IF EXISTS "Users can view members in their company" ON company_members;
CREATE POLICY "Users can view members in their company"
  ON company_members FOR SELECT
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Superadmins can insert members" ON company_members;
CREATE POLICY "Superadmins can insert members"
  ON company_members FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

DROP POLICY IF EXISTS "Superadmins can update members" ON company_members;
CREATE POLICY "Superadmins can update members"
  ON company_members FOR UPDATE
  USING (company_id = get_user_company_id() AND is_superadmin())
  WITH CHECK (company_id = get_user_company_id() AND is_superadmin());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_companies_updated_at ON companies;
CREATE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_company_members_updated_at ON company_members;
CREATE TRIGGER set_company_members_updated_at
  BEFORE UPDATE ON company_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- FUNCTION: Create profile on user signup
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
