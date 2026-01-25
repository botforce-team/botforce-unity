import { Database, UserRole, TimeEntryStatus, DocumentStatus, ExpenseStatus } from './database'

// Table row types
export type Company = Database['public']['Tables']['companies']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type CompanyMember = Database['public']['Tables']['company_members']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectAssignment = Database['public']['Tables']['project_assignments']['Row']
export type TimeEntry = Database['public']['Tables']['time_entries']['Row']
export type Document = Database['public']['Tables']['documents']['Row']
export type DocumentLine = Database['public']['Tables']['document_lines']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type File = Database['public']['Tables']['files']['Row']
export type AccountingExport = Database['public']['Tables']['accounting_exports']['Row']
export type AuditLog = Database['public']['Tables']['audit_log']['Row']

// Re-export enums
export type { UserRole, TimeEntryStatus, DocumentStatus, ExpenseStatus }
export type { DocumentType, BillingType, TaxRate, ExportStatus } from './database'

// Extended types with joins
export interface TimeEntryWithProject extends TimeEntry {
  project: Pick<Project, 'id' | 'name' | 'code'>
  profile?: Pick<Profile, 'id' | 'email' | 'first_name' | 'last_name'>
}

export interface ProjectWithCustomer extends Project {
  customer: Pick<Customer, 'id' | 'name'>
}

export interface DocumentWithCustomer extends Document {
  customer: Pick<Customer, 'id' | 'name'>
}

export interface ExpenseWithUser extends Expense {
  profile: Pick<Profile, 'id' | 'email' | 'first_name' | 'last_name'>
}

export interface CompanyMemberWithProfile extends CompanyMember {
  profile: Profile
}

// Auth context types
export interface AuthUser {
  id: string
  email: string
  profile: Profile | null
  memberships: CompanyMemberWithProfile[]
  currentCompany: Company | null
  currentRole: UserRole | null
}

// Form types
export interface TimeEntryFormData {
  project_id: string
  date: string
  hours: number
  description: string
  is_billable: boolean
}

export interface DocumentFormData {
  customer_id: string
  document_type: 'invoice' | 'credit_note'
  notes?: string
  payment_terms_days?: number
  lines: DocumentLineFormData[]
}

export interface DocumentLineFormData {
  description: string
  quantity: number
  unit: string
  unit_price: number
  tax_rate: 'standard_20' | 'reduced_10' | 'zero'
  project_id?: string
}

export interface ExpenseFormData {
  project_id?: string
  date: string
  amount: number
  category: string
  description?: string
  merchant?: string
  tax_rate: 'standard_20' | 'reduced_10' | 'zero'
  is_reimbursable: boolean
}

// Filter types
export interface TimeEntryFilters {
  project_id?: string
  user_id?: string
  status?: TimeEntryStatus
  date_from?: string
  date_to?: string
}

export interface DocumentFilters {
  customer_id?: string
  document_type?: 'invoice' | 'credit_note'
  status?: DocumentStatus
  date_from?: string
  date_to?: string
}

export interface ExpenseFilters {
  user_id?: string
  project_id?: string
  status?: ExpenseStatus
  category?: string
  date_from?: string
  date_to?: string
}
