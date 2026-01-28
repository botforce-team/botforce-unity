'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { AccountingExport, ActionResult, PaginatedResult } from '@/types'

export interface ExportsFilter {
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  page?: number
  limit?: number
}

export async function getAccountingExports(
  filter: ExportsFilter = {}
): Promise<PaginatedResult<AccountingExport>> {
  const supabase = await createClient()

  const { status, page = 1, limit = 20 } = filter

  let query = supabase
    .from('accounting_exports')
    .select('*', { count: 'exact' })

  if (status) {
    query = query.eq('status', status)
  }

  query = query.order('created_at', { ascending: false })

  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching accounting exports:', error)
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return {
    data: data as AccountingExport[],
    total,
    page,
    limit,
    totalPages,
  }
}

export async function getAccountingExport(id: string): Promise<AccountingExport | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('accounting_exports')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching accounting export:', error)
    return null
  }

  return data as AccountingExport
}

export interface CreateExportInput {
  name: string
  description?: string | null
  period_start: string
  period_end: string
}

export async function createAccountingExport(
  input: CreateExportInput
): Promise<ActionResult<AccountingExport>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return { success: false, error: 'No company membership found' }
  }

  // Count documents and expenses in the period
  const { data: invoices } = await supabase
    .from('documents')
    .select('total')
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', input.period_start)
    .lte('issue_date', input.period_end)

  const { data: creditNotes } = await supabase
    .from('documents')
    .select('total')
    .eq('document_type', 'credit_note')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', input.period_start)
    .lte('issue_date', input.period_end)

  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('status', 'approved')
    .gte('date', input.period_start)
    .lte('date', input.period_end)

  const invoiceCount = invoices?.length || 0
  const creditNoteCount = creditNotes?.length || 0
  const expenseCount = expenses?.length || 0
  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0
  const totalCreditNotes = creditNotes?.reduce((sum, cn) => sum + (cn.total || 0), 0) || 0
  const totalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0

  const { data, error } = await supabase
    .from('accounting_exports')
    .insert({
      company_id: membership.company_id,
      name: input.name,
      description: input.description || null,
      period_start: input.period_start,
      period_end: input.period_end,
      status: 'completed', // For now, mark as completed immediately
      created_by: user.id,
      completed_at: new Date().toISOString(),
      invoice_count: invoiceCount,
      credit_note_count: creditNoteCount,
      expense_count: expenseCount,
      total_revenue: totalRevenue - totalCreditNotes,
      total_expenses: totalExpenses,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating accounting export:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/accounting-export')
  return { success: true, data: data as AccountingExport }
}

export async function deleteAccountingExport(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('accounting_exports')
    .select('is_locked')
    .eq('id', id)
    .single()

  if (existing?.is_locked) {
    return { success: false, error: 'Cannot delete a locked export' }
  }

  const { error } = await supabase
    .from('accounting_exports')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting accounting export:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/accounting-export')
  return { success: true }
}

// Generate CSV data for an export
export async function generateExportCSV(id: string): Promise<ActionResult<string>> {
  const supabase = await createClient()

  const { data: exportData } = await supabase
    .from('accounting_exports')
    .select('*')
    .eq('id', id)
    .single()

  if (!exportData) {
    return { success: false, error: 'Export not found' }
  }

  // Get invoices
  const { data: invoices } = await supabase
    .from('documents')
    .select('*, customer:customers(name)')
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', exportData.period_start)
    .lte('issue_date', exportData.period_end)
    .order('issue_date')

  // Get credit notes
  const { data: creditNotes } = await supabase
    .from('documents')
    .select('*, customer:customers(name)')
    .eq('document_type', 'credit_note')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', exportData.period_start)
    .lte('issue_date', exportData.period_end)
    .order('issue_date')

  // Get expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('status', 'approved')
    .gte('date', exportData.period_start)
    .lte('date', exportData.period_end)
    .order('date')

  // Generate CSV content
  let csv = 'Type,Date,Number,Customer/Merchant,Category,Subtotal,Tax,Total,Status\n'

  // Add invoices
  invoices?.forEach((inv: any) => {
    csv += `Invoice,${inv.issue_date},${inv.document_number},"${inv.customer?.name || ''}",,"${inv.subtotal}","${inv.tax_amount}","${inv.total}",${inv.status}\n`
  })

  // Add credit notes
  creditNotes?.forEach((cn: any) => {
    csv += `Credit Note,${cn.issue_date},${cn.document_number},"${cn.customer?.name || ''}",,"${cn.subtotal}","${cn.tax_amount}","${cn.total}",${cn.status}\n`
  })

  // Add expenses
  expenses?.forEach((exp: any) => {
    csv += `Expense,${exp.date},,"${exp.merchant || ''}",${exp.category},"${exp.amount}","${exp.tax_amount}","${exp.amount + exp.tax_amount}",${exp.status}\n`
  })

  return { success: true, data: csv }
}

// Generate ZIP export with PDFs and receipts
export async function generateExportZip(id: string): Promise<ActionResult<{
  csvData: string
  invoices: Array<{ id: string; number: string; customerId: string }>
  receipts: Array<{ expenseId: string; fileId: string; storagePath: string }>
}>> {
  const supabase = await createClient()

  const { data: exportData } = await supabase
    .from('accounting_exports')
    .select('*')
    .eq('id', id)
    .single()

  if (!exportData) {
    return { success: false, error: 'Export not found' }
  }

  // Get invoices with their PDF info
  const { data: invoices } = await supabase
    .from('documents')
    .select('id, document_number, customer_id')
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', exportData.period_start)
    .lte('issue_date', exportData.period_end)
    .order('issue_date')

  // Get credit notes
  const { data: creditNotes } = await supabase
    .from('documents')
    .select('id, document_number, customer_id')
    .eq('document_type', 'credit_note')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', exportData.period_start)
    .lte('issue_date', exportData.period_end)
    .order('issue_date')

  // Get expenses with receipt files
  const { data: expenses } = await supabase
    .from('expenses')
    .select(`
      id,
      receipt_file_id,
      receipt_file:files(id, storage_path, original_filename)
    `)
    .eq('status', 'approved')
    .gte('date', exportData.period_start)
    .lte('date', exportData.period_end)
    .not('receipt_file_id', 'is', null)

  // Generate CSV
  const csvResult = await generateExportCSV(id)
  if (!csvResult.success || !csvResult.data) {
    return { success: false, error: 'Failed to generate CSV' }
  }

  // Compile receipt info
  const receipts = (expenses || [])
    .filter((exp: any) => exp.receipt_file)
    .map((exp: any) => ({
      expenseId: exp.id,
      fileId: exp.receipt_file.id,
      storagePath: exp.receipt_file.storage_path,
    }))

  // Compile invoice info for PDF generation
  const allDocs = [
    ...(invoices || []).map((inv: any) => ({
      id: inv.id,
      number: inv.document_number,
      customerId: inv.customer_id,
    })),
    ...(creditNotes || []).map((cn: any) => ({
      id: cn.id,
      number: cn.document_number,
      customerId: cn.customer_id,
    })),
  ]

  return {
    success: true,
    data: {
      csvData: csvResult.data,
      invoices: allDocs,
      receipts,
    },
  }
}

// Get signed URLs for receipt files
export async function getReceiptSignedUrls(
  receiptPaths: string[]
): Promise<ActionResult<Record<string, string>>> {
  const supabase = await createClient()

  const urls: Record<string, string> = {}

  for (const path of receiptPaths) {
    const { data } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600) // 1 hour validity

    if (data?.signedUrl) {
      urls[path] = data.signedUrl
    }
  }

  return { success: true, data: urls }
}

// Get available period stats (for the form)
export async function getExportPeriodStats(
  periodStart: string,
  periodEnd: string
): Promise<{
  invoiceCount: number
  creditNoteCount: number
  expenseCount: number
  totalRevenue: number
  totalExpenses: number
}> {
  const supabase = await createClient()

  const { data: invoices } = await supabase
    .from('documents')
    .select('total')
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', periodStart)
    .lte('issue_date', periodEnd)

  const { data: creditNotes } = await supabase
    .from('documents')
    .select('total')
    .eq('document_type', 'credit_note')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', periodStart)
    .lte('issue_date', periodEnd)

  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('status', 'approved')
    .gte('date', periodStart)
    .lte('date', periodEnd)

  return {
    invoiceCount: invoices?.length || 0,
    creditNoteCount: creditNotes?.length || 0,
    expenseCount: expenses?.length || 0,
    totalRevenue:
      (invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0) -
      (creditNotes?.reduce((sum, cn) => sum + (cn.total || 0), 0) || 0),
    totalExpenses: expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0,
  }
}
