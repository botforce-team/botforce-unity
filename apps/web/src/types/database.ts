export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'superadmin' | 'employee' | 'accountant'
export type TimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'invoiced'
export type DocumentType = 'invoice' | 'credit_note'
export type DocumentStatus = 'draft' | 'issued' | 'paid' | 'cancelled'
export type BillingType = 'hourly' | 'fixed'
export type TaxRate = 'standard_20' | 'reduced_10' | 'zero'
export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'exported'
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          legal_name: string | null
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
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          legal_name?: string | null
          vat_number?: string | null
          registration_number?: string | null
          address_line1?: string | null
          address_line2?: string | null
          postal_code?: string | null
          city?: string | null
          country?: string
          email?: string | null
          phone?: string | null
          website?: string | null
          logo_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          legal_name?: string | null
          vat_number?: string | null
          registration_number?: string | null
          address_line1?: string | null
          address_line2?: string | null
          postal_code?: string | null
          city?: string | null
          country?: string
          email?: string | null
          phone?: string | null
          website?: string | null
          logo_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          avatar_url: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      company_members: {
        Row: {
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
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          role?: UserRole
          hourly_rate?: number | null
          is_active?: boolean
          invited_at?: string | null
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          role?: UserRole
          hourly_rate?: number | null
          is_active?: boolean
          invited_at?: string | null
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          company_id: string
          name: string
          legal_name: string | null
          customer_number: string | null
          vat_number: string | null
          tax_exempt: boolean
          reverse_charge: boolean
          email: string | null
          phone: string | null
          website: string | null
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
        Insert: {
          id?: string
          company_id: string
          name: string
          legal_name?: string | null
          customer_number?: string | null
          vat_number?: string | null
          tax_exempt?: boolean
          reverse_charge?: boolean
          email?: string | null
          phone?: string | null
          website?: string | null
          address_line1?: string | null
          address_line2?: string | null
          postal_code?: string | null
          city?: string | null
          country?: string
          payment_terms_days?: number
          default_tax_rate?: TaxRate
          currency?: string
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          legal_name?: string | null
          customer_number?: string | null
          vat_number?: string | null
          tax_exempt?: boolean
          reverse_charge?: boolean
          email?: string | null
          phone?: string | null
          website?: string | null
          address_line1?: string | null
          address_line2?: string | null
          postal_code?: string | null
          city?: string | null
          country?: string
          payment_terms_days?: number
          default_tax_rate?: TaxRate
          currency?: string
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          name: string
          code: string | null
          description: string | null
          billing_type: BillingType
          hourly_rate: number | null
          fixed_price: number | null
          budget_hours: number | null
          budget_amount: number | null
          start_date: string | null
          end_date: string | null
          is_active: boolean
          is_billable: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          name: string
          code?: string | null
          description?: string | null
          billing_type?: BillingType
          hourly_rate?: number | null
          fixed_price?: number | null
          budget_hours?: number | null
          budget_amount?: number | null
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          is_billable?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string
          name?: string
          code?: string | null
          description?: string | null
          billing_type?: BillingType
          hourly_rate?: number | null
          fixed_price?: number | null
          budget_hours?: number | null
          budget_amount?: number | null
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          is_billable?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      project_assignments: {
        Row: {
          id: string
          company_id: string
          project_id: string
          user_id: string
          hourly_rate_override: number | null
          assigned_at: string
          unassigned_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          user_id: string
          hourly_rate_override?: number | null
          assigned_at?: string
          unassigned_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          user_id?: string
          hourly_rate_override?: number | null
          assigned_at?: string
          unassigned_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      time_entries: {
        Row: {
          id: string
          company_id: string
          project_id: string
          user_id: string
          date: string
          hours: number
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
          document_line_id: string | null
          invoiced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          user_id: string
          date: string
          hours: number
          description?: string | null
          is_billable?: boolean
          hourly_rate?: number | null
          status?: TimeEntryStatus
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          document_id?: string | null
          document_line_id?: string | null
          invoiced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          user_id?: string
          date?: string
          hours?: number
          description?: string | null
          is_billable?: boolean
          hourly_rate?: number | null
          status?: TimeEntryStatus
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          document_id?: string | null
          document_line_id?: string | null
          invoiced_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          document_type: DocumentType
          document_number: string | null
          series_id: string | null
          reference_document_id: string | null
          status: DocumentStatus
          issue_date: string | null
          due_date: string | null
          paid_date: string | null
          customer_snapshot: Json | null
          company_snapshot: Json | null
          subtotal: number
          tax_amount: number
          total: number
          currency: string
          tax_breakdown: Json
          payment_terms_days: number | null
          payment_reference: string | null
          payment_notes: string | null
          notes: string | null
          internal_notes: string | null
          pdf_url: string | null
          is_locked: boolean
          locked_at: string | null
          created_at: string
          updated_at: string
          issued_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          document_type: DocumentType
          document_number?: string | null
          series_id?: string | null
          reference_document_id?: string | null
          status?: DocumentStatus
          issue_date?: string | null
          due_date?: string | null
          paid_date?: string | null
          customer_snapshot?: Json | null
          company_snapshot?: Json | null
          subtotal?: number
          tax_amount?: number
          total?: number
          currency?: string
          tax_breakdown?: Json
          payment_terms_days?: number | null
          payment_reference?: string | null
          payment_notes?: string | null
          notes?: string | null
          internal_notes?: string | null
          pdf_url?: string | null
          is_locked?: boolean
          locked_at?: string | null
          created_at?: string
          updated_at?: string
          issued_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string
          document_type?: DocumentType
          document_number?: string | null
          series_id?: string | null
          reference_document_id?: string | null
          status?: DocumentStatus
          issue_date?: string | null
          due_date?: string | null
          paid_date?: string | null
          customer_snapshot?: Json | null
          company_snapshot?: Json | null
          subtotal?: number
          tax_amount?: number
          total?: number
          currency?: string
          tax_breakdown?: Json
          payment_terms_days?: number | null
          payment_reference?: string | null
          payment_notes?: string | null
          notes?: string | null
          internal_notes?: string | null
          pdf_url?: string | null
          is_locked?: boolean
          locked_at?: string | null
          created_at?: string
          updated_at?: string
          issued_at?: string | null
        }
      }
      document_lines: {
        Row: {
          id: string
          company_id: string
          document_id: string
          line_number: number
          description: string
          quantity: number
          unit: string
          unit_price: number
          tax_rate: TaxRate
          subtotal: number
          tax_amount: number | null
          total: number | null
          time_entry_ids: string[]
          project_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          document_id: string
          line_number: number
          description: string
          quantity?: number
          unit?: string
          unit_price: number
          tax_rate?: TaxRate
          time_entry_ids?: string[]
          project_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          document_id?: string
          line_number?: number
          description?: string
          quantity?: number
          unit?: string
          unit_price?: number
          tax_rate?: TaxRate
          time_entry_ids?: string[]
          project_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          company_id: string
          user_id: string
          project_id: string | null
          date: string
          amount: number
          currency: string
          tax_rate: TaxRate
          tax_amount: number | null
          category: string
          description: string | null
          merchant: string | null
          status: ExpenseStatus
          submitted_at: string | null
          approved_at: string | null
          approved_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          exported_at: string | null
          export_id: string | null
          receipt_file_id: string | null
          is_reimbursable: boolean
          reimbursed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          project_id?: string | null
          date: string
          amount: number
          currency?: string
          tax_rate?: TaxRate
          tax_amount?: number | null
          category: string
          description?: string | null
          merchant?: string | null
          status?: ExpenseStatus
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          exported_at?: string | null
          export_id?: string | null
          receipt_file_id?: string | null
          is_reimbursable?: boolean
          reimbursed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          project_id?: string | null
          date?: string
          amount?: number
          currency?: string
          tax_rate?: TaxRate
          tax_amount?: number | null
          category?: string
          description?: string | null
          merchant?: string | null
          status?: ExpenseStatus
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          exported_at?: string | null
          export_id?: string | null
          receipt_file_id?: string | null
          is_reimbursable?: boolean
          reimbursed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      files: {
        Row: {
          id: string
          company_id: string
          storage_path: string
          storage_bucket: string
          file_name: string
          file_type: string | null
          file_size: number | null
          uploaded_by: string | null
          category: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          storage_path: string
          storage_bucket?: string
          file_name: string
          file_type?: string | null
          file_size?: number | null
          uploaded_by?: string | null
          category?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          storage_path?: string
          storage_bucket?: string
          file_name?: string
          file_type?: string | null
          file_size?: number | null
          uploaded_by?: string | null
          category?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      accounting_exports: {
        Row: {
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
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string | null
          period_start: string
          period_end: string
          status?: ExportStatus
          created_by: string
          processed_at?: string | null
          completed_at?: string | null
          failed_at?: string | null
          error_message?: string | null
          csv_file_id?: string | null
          zip_file_id?: string | null
          invoice_count?: number
          credit_note_count?: number
          expense_count?: number
          total_revenue?: number
          total_expenses?: number
          is_locked?: boolean
          locked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string | null
          period_start?: string
          period_end?: string
          status?: ExportStatus
          created_by?: string
          processed_at?: string | null
          completed_at?: string | null
          failed_at?: string | null
          error_message?: string | null
          csv_file_id?: string | null
          zip_file_id?: string | null
          invoice_count?: number
          credit_note_count?: number
          expense_count?: number
          total_revenue?: number
          total_expenses?: number
          is_locked?: boolean
          locked_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          company_id: string
          user_id: string | null
          user_email: string | null
          action: string
          table_name: string
          record_id: string | null
          old_data: Json | null
          new_data: Json | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id?: string | null
          user_email?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string | null
          user_email?: string | null
          action?: string
          table_name?: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      recurring_invoice_templates: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          name: string
          description: string | null
          frequency: RecurrenceFrequency
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
          currency: string
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          name: string
          description?: string | null
          frequency?: RecurrenceFrequency
          day_of_month?: number | null
          day_of_week?: number | null
          payment_terms_days?: number
          notes?: string | null
          is_active?: boolean
          next_issue_date?: string | null
          last_issued_at?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          currency?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string
          name?: string
          description?: string | null
          frequency?: RecurrenceFrequency
          day_of_month?: number | null
          day_of_week?: number | null
          payment_terms_days?: number
          notes?: string | null
          is_active?: boolean
          next_issue_date?: string | null
          last_issued_at?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          currency?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      recurring_invoice_lines: {
        Row: {
          id: string
          company_id: string
          template_id: string
          line_number: number
          description: string
          quantity: number
          unit: string
          unit_price: number
          tax_rate: TaxRate
          subtotal: number
          project_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          template_id: string
          line_number: number
          description: string
          quantity?: number
          unit?: string
          unit_price: number
          tax_rate?: TaxRate
          project_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          template_id?: string
          line_number?: number
          description?: string
          quantity?: number
          unit?: string
          unit_price?: number
          tax_rate?: TaxRate
          project_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      get_user_role: {
        Args: { p_company_id: string }
        Returns: UserRole | null
      }
      is_superadmin: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      is_accountant: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      is_employee: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      has_project_access: {
        Args: { p_project_id: string }
        Returns: boolean
      }
    }
  }
}
