// ============================================================================
// User & Auth Types
// ============================================================================

export type UserRole = 'superadmin' | 'employee' | 'accountant'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface CompanyMember {
  id: string
  company_id: string
  user_id: string
  role: UserRole
  hourly_rate: number | null
  is_active: boolean
  invited_at: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
  // Joined
  profile?: Profile
}

// ============================================================================
// Company Types
// ============================================================================

export interface Company {
  id: string
  name: string
  legal_name: string
  vat_number: string | null
  registration_number: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string
  email: string | null
  phone: string | null
  website: string | null
  logo_url: string | null
  settings: CompanySettings
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  default_payment_terms_days: number
  invoice_prefix: string
  credit_note_prefix: string
  default_tax_rate: TaxRate
  mileage_rate: number
}

// ============================================================================
// Customer Types
// ============================================================================

export interface Customer {
  id: string
  company_id: string
  name: string
  legal_name: string | null
  vat_number: string | null
  tax_exempt: boolean
  reverse_charge: boolean
  email: string | null
  phone: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string
  payment_terms_days: number
  default_tax_rate: TaxRate
  currency: string
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// Project Types
// ============================================================================

export type BillingType = 'hourly' | 'fixed'
export type TimeRecordingMode = 'hours' | 'start_end'

export interface Project {
  id: string
  company_id: string
  customer_id: string
  name: string
  code: string
  description: string | null
  billing_type: BillingType
  hourly_rate: number | null
  fixed_price: number | null
  budget_hours: number | null
  budget_amount: number | null
  start_date: string | null
  end_date: string | null
  time_recording_mode: TimeRecordingMode
  is_active: boolean
  is_billable: boolean
  created_at: string
  updated_at: string
  // Joined
  customer?: Customer
}

export interface ProjectAssignment {
  id: string
  project_id: string
  user_id: string
  hourly_rate_override: number | null
  assigned_at: string
  unassigned_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  project?: Project
  profile?: Profile
}

// ============================================================================
// Time Entry Types
// ============================================================================

export type TimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'invoiced'

export interface TimeEntry {
  id: string
  company_id: string
  project_id: string
  user_id: string
  date: string
  hours: number
  start_time: string | null
  end_time: string | null
  break_minutes: number | null
  description: string | null
  is_billable: boolean
  hourly_rate: number | null
  status: TimeEntryStatus
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  rejection_reason: string | null
  document_id: string | null
  invoiced_at: string | null
  created_at: string
  updated_at: string
  // Joined
  project?: Project
  profile?: Profile
  approved_by_profile?: Profile
}

// ============================================================================
// Expense Types
// ============================================================================

export type ExpenseCategory =
  | 'mileage'
  | 'travel_time'
  | 'materials'
  | 'accommodation'
  | 'meals'
  | 'transport'
  | 'communication'
  | 'software'
  | 'other'

export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'exported'

export type TaxRate = 'standard_20' | 'reduced_10' | 'zero' | 'reverse_charge'

export interface Expense {
  id: string
  company_id: string
  user_id: string
  project_id: string | null
  date: string
  amount: number
  currency: string
  tax_rate: TaxRate
  tax_amount: number
  category: ExpenseCategory
  description: string | null
  merchant: string | null
  receipt_file_id: string | null
  is_reimbursable: boolean
  reimbursed_at: string | null
  status: ExpenseStatus
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  rejection_reason: string | null
  exported_at: string | null
  export_id: string | null
  created_at: string
  updated_at: string
  // Joined
  project?: Project
  profile?: Profile
  receipt_file?: FileRecord
}

// ============================================================================
// Document Types
// ============================================================================

export type DocumentType = 'invoice' | 'credit_note'
export type DocumentStatus = 'draft' | 'issued' | 'paid' | 'cancelled'

export interface Document {
  id: string
  company_id: string
  customer_id: string
  document_type: DocumentType
  document_number: string | null
  status: DocumentStatus
  issue_date: string | null
  due_date: string | null
  paid_date: string | null
  customer_snapshot: CustomerSnapshot | null
  company_snapshot: CompanySnapshot | null
  payment_terms_days: number
  payment_reference: string | null
  notes: string | null
  internal_notes: string | null
  subtotal: number
  tax_amount: number
  total: number
  tax_breakdown: TaxBreakdown | null
  currency: string
  is_locked: boolean
  locked_at: string | null
  created_at: string
  updated_at: string
  // Joined
  customer?: Customer
  lines?: DocumentLine[]
}

export interface CustomerSnapshot {
  name: string
  legal_name: string | null
  vat_number: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string
  reverse_charge: boolean
}

export interface CompanySnapshot {
  name: string
  legal_name: string
  vat_number: string | null
  registration_number: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string
  email: string | null
  phone: string | null
  website: string | null
}

export interface TaxBreakdown {
  standard_20?: number
  reduced_10?: number
  zero?: number
  reverse_charge?: number
}

export interface DocumentLine {
  id: string
  document_id: string
  line_number: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  tax_rate: TaxRate
  subtotal: number
  tax_amount: number
  total: number
  time_entry_ids: string[] | null
  expense_ids: string[] | null
  project_id: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// File Types
// ============================================================================

export type FileCategory = 'receipt' | 'logo' | 'avatar' | 'attachment'

export interface FileRecord {
  id: string
  company_id: string
  user_id: string
  category: FileCategory
  filename: string
  original_filename: string
  mime_type: string
  size_bytes: number
  storage_path: string
  created_at: string
}

// ============================================================================
// Accounting Export Types
// ============================================================================

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface AccountingExport {
  id: string
  company_id: string
  name: string
  description: string | null
  period_start: string
  period_end: string
  status: ExportStatus
  created_by: string
  processed_at: string | null
  completed_at: string | null
  failed_at: string | null
  error_message: string | null
  csv_file_id: string | null
  zip_file_id: string | null
  invoice_count: number
  credit_note_count: number
  expense_count: number
  total_revenue: number
  total_expenses: number
  is_locked: boolean
  locked_at: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Recurring Invoice Types
// ============================================================================

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface RecurringInvoiceTemplate {
  id: string
  company_id: string
  customer_id: string
  name: string
  description: string | null
  frequency: RecurringFrequency
  day_of_month: number | null
  day_of_week: number | null
  payment_terms_days: number
  notes: string | null
  is_active: boolean
  next_issue_date: string | null
  last_issued_at: string | null
  subtotal: number
  tax_amount: number
  total: number
  created_at: string
  updated_at: string
  // Joined
  customer?: Customer
  lines?: RecurringInvoiceLine[]
}

export interface RecurringInvoiceLine {
  id: string
  template_id: string
  line_number: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  tax_rate: TaxRate
  project_id: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Audit Log Types
// ============================================================================

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'issue'
  | 'approve'
  | 'reject'
  | 'lock'

export interface AuditLog {
  id: string
  company_id: string
  user_id: string
  user_email: string
  action: AuditAction
  table_name: string
  record_id: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ============================================================================
// Revolut Integration Types
// ============================================================================

export type RevolutConnectionStatus = 'active' | 'expired' | 'revoked' | 'error'
export type RevolutSyncStatus = 'pending' | 'syncing' | 'completed' | 'failed'
export type RevolutPaymentStatus = 'pending' | 'processing' | 'completed' | 'declined' | 'failed' | 'cancelled'

export interface RevolutConnection {
  id: string
  company_id: string
  status: RevolutConnectionStatus
  revolut_business_id: string | null
  last_sync_at: string | null
  last_sync_status: RevolutSyncStatus | null
  last_sync_error: string | null
  connected_at: string
  disconnected_at: string | null
  created_at: string
  updated_at: string
}

export interface RevolutAccount {
  id: string
  company_id: string
  connection_id: string
  revolut_account_id: string
  name: string | null
  currency: string
  balance: number
  state: string | null
  iban: string | null
  bic: string | null
  account_number: string | null
  sort_code: string | null
  is_primary: boolean
  balance_updated_at: string | null
  created_at: string
  updated_at: string
}

export interface RevolutTransaction {
  id: string
  company_id: string
  account_id: string
  revolut_transaction_id: string
  revolut_leg_id: string | null
  type: string
  state: string
  amount: number
  currency: string
  fee: number | null
  balance_after: number | null
  counterparty_name: string | null
  counterparty_account_id: string | null
  counterparty_account_type: string | null
  reference: string | null
  description: string | null
  merchant_name: string | null
  merchant_category_code: string | null
  merchant_city: string | null
  merchant_country: string | null
  card_last_four: string | null
  transaction_date: string
  created_at_revolut: string | null
  completed_at_revolut: string | null
  expense_id: string | null
  document_id: string | null
  category: string | null
  is_reconciled: boolean
  reconciled_at: string | null
  reconciled_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  account?: RevolutAccount
  expense?: Expense
  document?: Document
}

export interface RevolutPayment {
  id: string
  company_id: string
  connection_id: string
  source_account_id: string | null
  revolut_payment_id: string | null
  amount: number
  currency: string
  reference: string | null
  recipient_name: string
  recipient_iban: string | null
  recipient_bic: string | null
  recipient_account_number: string | null
  recipient_sort_code: string | null
  recipient_country: string | null
  status: RevolutPaymentStatus
  reason_code: string | null
  error_message: string | null
  document_id: string | null
  expense_id: string | null
  request_id: string
  created_by: string
  approved_by: string | null
  scheduled_date: string | null
  submitted_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface RevolutSyncLog {
  id: string
  company_id: string
  connection_id: string
  sync_type: string
  status: RevolutSyncStatus
  records_fetched: number
  records_created: number
  records_updated: number
  error_message: string | null
  error_details: Record<string, unknown> | null
  started_at: string
  completed_at: string | null
  duration_ms: number | null
}

// ============================================================================
// UI / Helper Types
// ============================================================================

export interface SelectOption<T = string> {
  value: T
  label: string
  disabled?: boolean
}

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}
