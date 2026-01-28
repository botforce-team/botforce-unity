'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  Document,
  DocumentLine,
  DocumentType,
  DocumentStatus,
  TaxRate,
  ActionResult,
  PaginatedResult,
  CustomerSnapshot,
  CompanySnapshot,
  TaxBreakdown,
} from '@/types'

export interface DocumentsFilter {
  customerId?: string
  documentType?: DocumentType
  status?: DocumentStatus
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

type DocumentWithRelations = Document & {
  customer?: { name: string }
}

export async function getDocuments(
  filter: DocumentsFilter = {}
): Promise<PaginatedResult<DocumentWithRelations>> {
  const supabase = await createClient()

  const {
    customerId,
    documentType,
    status,
    dateFrom,
    dateTo,
    page = 1,
    limit = 50,
  } = filter

  let query = supabase
    .from('documents')
    .select('*, customer:customers(name)', { count: 'exact' })

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  if (documentType) {
    query = query.eq('document_type', documentType)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (dateFrom) {
    query = query.gte('issue_date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('issue_date', dateTo)
  }

  query = query.order('created_at', { ascending: false })

  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching documents:', error)
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return {
    data: data as DocumentWithRelations[],
    total,
    page,
    limit,
    totalPages,
  }
}

export async function getDocument(id: string): Promise<DocumentWithRelations | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('documents')
    .select('*, customer:customers(name), lines:document_lines(*)')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching document:', error)
    return null
  }

  return data as DocumentWithRelations
}

export interface CreateDocumentLineInput {
  description: string
  quantity: number
  unit: string
  unit_price: number
  tax_rate: TaxRate
  project_id?: string | null
  time_entry_ids?: string[] | null
  expense_ids?: string[] | null
}

export interface CreateDocumentInput {
  customer_id: string
  document_type: DocumentType
  payment_terms_days?: number
  notes?: string | null
  internal_notes?: string | null
  lines: CreateDocumentLineInput[]
}

// Calculate tax amount based on rate
function calculateTax(amount: number, taxRate: TaxRate): number {
  const taxRates: Record<TaxRate, number> = {
    standard_20: 0.20,
    reduced_10: 0.10,
    zero: 0,
    reverse_charge: 0,
  }
  return Math.round(amount * taxRates[taxRate] * 100) / 100
}

export async function createDocument(
  input: CreateDocumentInput
): Promise<ActionResult<Document>> {
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

  // Get customer for payment terms and currency
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', input.customer_id)
    .single()

  if (!customer) {
    return { success: false, error: 'Customer not found' }
  }

  // Calculate totals
  let subtotal = 0
  let totalTax = 0
  const taxBreakdown: TaxBreakdown = {}

  const processedLines = input.lines.map((line, index) => {
    const lineSubtotal = Math.round(line.quantity * line.unit_price * 100) / 100
    const lineTax = calculateTax(lineSubtotal, line.tax_rate)
    subtotal += lineSubtotal
    totalTax += lineTax

    // Update tax breakdown
    if (line.tax_rate in taxBreakdown) {
      taxBreakdown[line.tax_rate] = (taxBreakdown[line.tax_rate] || 0) + lineTax
    } else {
      taxBreakdown[line.tax_rate] = lineTax
    }

    return {
      ...line,
      line_number: index + 1,
      subtotal: lineSubtotal,
      tax_amount: lineTax,
      total: lineSubtotal + lineTax,
    }
  })

  const total = subtotal + totalTax
  const paymentTerms = input.payment_terms_days ?? customer.payment_terms_days

  // Create document
  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
      company_id: membership.company_id,
      customer_id: input.customer_id,
      document_type: input.document_type,
      status: 'draft',
      payment_terms_days: paymentTerms,
      notes: input.notes || null,
      internal_notes: input.internal_notes || null,
      subtotal,
      tax_amount: totalTax,
      total,
      tax_breakdown: taxBreakdown,
      currency: customer.currency || 'EUR',
    })
    .select()
    .single()

  if (docError) {
    console.error('Error creating document:', docError)
    return { success: false, error: docError.message }
  }

  // Create document lines
  const linesWithDocId = processedLines.map((line) => ({
    document_id: document.id,
    line_number: line.line_number,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
    tax_rate: line.tax_rate,
    subtotal: line.subtotal,
    tax_amount: line.tax_amount,
    total: line.total,
    project_id: line.project_id || null,
    time_entry_ids: line.time_entry_ids || null,
    expense_ids: line.expense_ids || null,
  }))

  const { error: linesError } = await supabase
    .from('document_lines')
    .insert(linesWithDocId)

  if (linesError) {
    console.error('Error creating document lines:', linesError)
    // Clean up the document
    await supabase.from('documents').delete().eq('id', document.id)
    return { success: false, error: linesError.message }
  }

  revalidatePath('/documents')
  return { success: true, data: document as Document }
}

export async function updateDocument(
  id: string,
  input: Partial<Omit<CreateDocumentInput, 'lines'>> & { lines?: CreateDocumentLineInput[] }
): Promise<ActionResult<Document>> {
  const supabase = await createClient()

  // Check if document is still a draft
  const { data: existing } = await supabase
    .from('documents')
    .select('status, is_locked')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: 'Document not found' }
  }

  if (existing.is_locked) {
    return { success: false, error: 'Document is locked and cannot be edited' }
  }

  if (existing.status !== 'draft') {
    return { success: false, error: 'Only draft documents can be edited' }
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.customer_id) updateData.customer_id = input.customer_id
  if (input.payment_terms_days !== undefined) updateData.payment_terms_days = input.payment_terms_days
  if (input.notes !== undefined) updateData.notes = input.notes
  if (input.internal_notes !== undefined) updateData.internal_notes = input.internal_notes

  // If lines are provided, recalculate totals
  if (input.lines) {
    let subtotal = 0
    let totalTax = 0
    const taxBreakdown: TaxBreakdown = {}

    const processedLines = input.lines.map((line, index) => {
      const lineSubtotal = Math.round(line.quantity * line.unit_price * 100) / 100
      const lineTax = calculateTax(lineSubtotal, line.tax_rate)
      subtotal += lineSubtotal
      totalTax += lineTax

      if (line.tax_rate in taxBreakdown) {
        taxBreakdown[line.tax_rate] = (taxBreakdown[line.tax_rate] || 0) + lineTax
      } else {
        taxBreakdown[line.tax_rate] = lineTax
      }

      return {
        document_id: id,
        line_number: index + 1,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
        subtotal: lineSubtotal,
        tax_amount: lineTax,
        total: lineSubtotal + lineTax,
        project_id: line.project_id || null,
        time_entry_ids: line.time_entry_ids || null,
        expense_ids: line.expense_ids || null,
      }
    })

    updateData.subtotal = subtotal
    updateData.tax_amount = totalTax
    updateData.total = subtotal + totalTax
    updateData.tax_breakdown = taxBreakdown

    // Delete existing lines
    await supabase.from('document_lines').delete().eq('document_id', id)

    // Insert new lines
    const { error: linesError } = await supabase
      .from('document_lines')
      .insert(processedLines)

    if (linesError) {
      console.error('Error updating document lines:', linesError)
      return { success: false, error: linesError.message }
    }
  }

  const { data, error } = await supabase
    .from('documents')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating document:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true, data: data as Document }
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('documents')
    .select('status, is_locked')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: 'Document not found' }
  }

  if (existing.is_locked || existing.status !== 'draft') {
    return { success: false, error: 'Only draft documents can be deleted' }
  }

  // Delete lines first
  await supabase.from('document_lines').delete().eq('document_id', id)

  const { error } = await supabase.from('documents').delete().eq('id', id)

  if (error) {
    console.error('Error deleting document:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/documents')
  return { success: true }
}

export async function issueDocument(id: string): Promise<ActionResult<Document>> {
  const supabase = await createClient()

  // Get document and company info
  const { data: document } = await supabase
    .from('documents')
    .select('*, customer:customers(*)')
    .eq('id', id)
    .single()

  if (!document) {
    return { success: false, error: 'Document not found' }
  }

  if (document.status !== 'draft') {
    return { success: false, error: 'Only draft documents can be issued' }
  }

  // Get company info for snapshot and numbering
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', document.company_id)
    .single()

  if (!company) {
    return { success: false, error: 'Company not found' }
  }

  // Generate document number
  const prefix = document.document_type === 'invoice'
    ? company.settings?.invoice_prefix || 'INV'
    : company.settings?.credit_note_prefix || 'CN'

  const year = new Date().getFullYear()

  // Get count of documents this year for numbering
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', document.company_id)
    .eq('document_type', document.document_type)
    .not('document_number', 'is', null)
    .gte('created_at', `${year}-01-01`)

  const sequenceNumber = (count || 0) + 1
  const documentNumber = `${prefix}-${year}-${String(sequenceNumber).padStart(4, '0')}`

  // Create snapshots
  const customerSnapshot: CustomerSnapshot = {
    name: document.customer.name,
    legal_name: document.customer.legal_name,
    vat_number: document.customer.vat_number,
    address_line1: document.customer.address_line1,
    address_line2: document.customer.address_line2,
    postal_code: document.customer.postal_code,
    city: document.customer.city,
    country: document.customer.country,
    reverse_charge: document.customer.reverse_charge,
  }

  const companySnapshot: CompanySnapshot = {
    name: company.name,
    legal_name: company.legal_name,
    vat_number: company.vat_number,
    registration_number: company.registration_number,
    address_line1: company.address_line1,
    address_line2: company.address_line2,
    postal_code: company.postal_code,
    city: company.city,
    country: company.country,
    email: company.email,
    phone: company.phone,
    website: company.website,
  }

  const issueDate = new Date().toISOString().split('T')[0]
  const dueDate = new Date(Date.now() + document.payment_terms_days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const { data, error } = await supabase
    .from('documents')
    .update({
      status: 'issued',
      document_number: documentNumber,
      issue_date: issueDate,
      due_date: dueDate,
      customer_snapshot: customerSnapshot,
      company_snapshot: companySnapshot,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error issuing document:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true, data: data as Document }
}

export async function markDocumentPaid(
  id: string,
  paidDate?: string,
  paymentReference?: string
): Promise<ActionResult<Document>> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('documents')
    .select('status')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: 'Document not found' }
  }

  if (existing.status !== 'issued') {
    return { success: false, error: 'Only issued documents can be marked as paid' }
  }

  const { data, error } = await supabase
    .from('documents')
    .update({
      status: 'paid',
      paid_date: paidDate || new Date().toISOString().split('T')[0],
      payment_reference: paymentReference || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error marking document paid:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true, data: data as Document }
}

export async function cancelDocument(id: string): Promise<ActionResult<Document>> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('documents')
    .select('status, is_locked')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: 'Document not found' }
  }

  if (existing.is_locked) {
    return { success: false, error: 'Locked documents cannot be cancelled' }
  }

  if (!['draft', 'issued'].includes(existing.status)) {
    return { success: false, error: 'Only draft or issued documents can be cancelled' }
  }

  const { data, error } = await supabase
    .from('documents')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error cancelling document:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true, data: data as Document }
}

// Helper to get customers for select
export async function getCustomersForDocumentSelect(): Promise<{ value: string; label: string }[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error fetching customers:', error)
    return []
  }

  return data.map((c) => ({ value: c.id, label: c.name }))
}
