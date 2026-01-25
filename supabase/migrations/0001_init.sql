-- Migration: 0001_init.sql
-- Description: Extensions, enums, and base tables (companies, profiles, company_members)
-- BOTFORCE Unity

-- ============================================================================
-- EXTENSIONS (pgcrypto provides gen_random_uuid() which works reliably in Supabase)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- User roles within a company
CREATE TYPE user_role AS ENUM ('superadmin', 'employee', 'accountant');

-- Time entry workflow status
CREATE TYPE time_entry_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'invoiced');

-- Document types
CREATE TYPE document_type AS ENUM ('invoice', 'credit_note');

-- Document status
CREATE TYPE document_status AS ENUM ('draft', 'issued', 'paid', 'cancelled');

-- Project billing type
CREATE TYPE billing_type AS ENUM ('hourly', 'fixed');

-- Tax rates (Austrian)
CREATE TYPE tax_rate AS ENUM ('standard_20', 'reduced_10', 'zero');

-- Expense status
CREATE TYPE expense_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'exported');

-- Accounting export status
CREATE TYPE export_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Audit action types
CREATE TYPE audit_action AS ENUM (
  'create', 'update', 'delete', 'status_change',
  'issue_document', 'approve_time', 'reject_time',
  'export_created', 'lock_export'
);

-- ============================================================================
-- BASE TABLES
-- ============================================================================

-- Companies (tenants)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  vat_number VARCHAR(50),
  registration_number VARCHAR(100),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  postal_code VARCHAR(20),
  city VARCHAR(100),
  country VARCHAR(2) DEFAULT 'AT',
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Profiles (linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Company members (user-company-role junction)
CREATE TABLE company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'employee',
  hourly_rate DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT unique_company_member UNIQUE (company_id, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_company_members_company_id ON company_members(company_id);
CREATE INDEX idx_company_members_user_id ON company_members(user_id);
CREATE INDEX idx_company_members_role ON company_members(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ============================================================================
-- TRIGGERS: Auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_members_updated_at
  BEFORE UPDATE ON company_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGER: Auto-create profile on auth.users insert
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE companies IS 'Tenant companies using the system';
COMMENT ON TABLE profiles IS 'User profiles, linked 1:1 with auth.users';
COMMENT ON TABLE company_members IS 'Junction table linking users to companies with roles';
COMMENT ON COLUMN company_members.role IS 'User role: superadmin (full access), employee (assigned projects), accountant (read-only docs)';
