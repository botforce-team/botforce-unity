'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
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
  project?: { id: string; name: string; code: string } | null
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
  } else {
    // Hide cancelled documents from the default list — surface them only when
    // the user explicitly filters for them.
    query = query.neq('status', 'cancelled')
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

  // Fetch project separately if project_id exists (no FK constraint in DB)
  let project = null
  if (data.project_id) {
    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, code')
      .eq('id', data.project_id)
      .single()
    project = projectData
  }

  return { ...data, project } as DocumentWithRelations
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
  project_id?: string | null
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

  const adminClient = await createAdminClient()
  const { data: membership } = await adminClient
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
      project_id: input.project_id || null,
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
    logo_url: company.logo_url,
    bank_name: company.bank_name,
    bank_iban: company.bank_iban,
    bank_bic: company.bank_bic,
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
      skonto_percent: document.customer.skonto_percent ?? null,
      skonto_days: document.customer.skonto_days ?? null,
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

export async function cancelDocument(
  id: string,
  reason?: string
): Promise<ActionResult<Document>> {
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
    return { success: false, error: 'Locked documents cannot be cancelled (already in an accounting export)' }
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

  // Unlock any time entries linked to this document so they can be edited and
  // re-invoiced. Approved entries are reverted to 'rejected' with a reason —
  // editing them flips them back to 'draft' (see updateTimeEntry).
  // The `approved -> rejected` transition is gated by the enforce_time_entry_status
  // trigger; superadmin + non-empty rejection_reason are required.
  const rejectionReason = reason
    ? `Invoice cancelled: ${reason}`
    : 'Invoice cancelled'

  const { error: unlockError } = await supabase
    .from('time_entries')
    .update({
      document_id: null,
      status: 'rejected',
      rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
    })
    .eq('document_id', id)

  if (unlockError) {
    console.error('Document cancelled but time entries failed to unlock:', unlockError)
    return {
      success: false,
      error: `Document cancelled, but failed to unlock linked time entries: ${unlockError.message}`,
    }
  }

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  revalidatePath('/timesheets')
  return { success: true, data: data as Document }
}

/**
 * Re-issue a cancelled invoice as a new draft.
 * Clones customer / project / payment terms / notes, then rebuilds line items
 * from the now-corrected source data:
 *   - Time-entry-backed lines: recalculated from the linked entries' current
 *     hours and rates (entries must be approved + unlinked).
 *   - Expense lines and manual lines: copied verbatim.
 * Re-links time entries to the new draft. Caller lands on the new document
 * for review and re-issuing.
 */
export async function reissueFromCancelledInvoice(
  sourceDocId: string
): Promise<ActionResult<Document>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const adminClient = await createAdminClient()
  const { data: membership } = await adminClient
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (!membership) {
    return { success: false, error: 'No company membership found' }
  }

  const { data: source, error: srcErr } = await supabase
    .from('documents')
    .select('*, lines:document_lines(*)')
    .eq('id', sourceDocId)
    .single()

  if (srcErr || !source) {
    return { success: false, error: 'Source document not found' }
  }
  if (source.status !== 'cancelled') {
    return { success: false, error: 'Only cancelled documents can be re-issued' }
  }

  const sourceLines = (source.lines ?? []) as DocumentLine[]

  // Collect every time entry referenced across all lines and validate state
  const allEntryIds: string[] = []
  for (const line of sourceLines) {
    if (line.time_entry_ids && line.time_entry_ids.length > 0) {
      allEntryIds.push(...line.time_entry_ids)
    }
  }

  const entriesById = new Map<string, { id: string; hours: number; hourly_rate: number | null; status: string; document_id: string | null; date: string }>()
  if (allEntryIds.length > 0) {
    const { data: entries, error: entriesErr } = await supabase
      .from('time_entries')
      .select('id, hours, hourly_rate, status, document_id, date')
      .in('id', allEntryIds)

    if (entriesErr) {
      return { success: false, error: entriesErr.message }
    }

    const blocked = (entries ?? []).filter(
      (e) => e.status !== 'approved' || e.document_id !== null
    )
    if (blocked.length > 0) {
      const summary = blocked
        .slice(0, 5)
        .map((e) =>
          e.document_id
            ? `${e.date}: linked to another invoice`
            : `${e.date}: status "${e.status}" (must be "approved")`
        )
        .join('; ')
      const more = blocked.length > 5 ? ` (+${blocked.length - 5} more)` : ''
      return {
        success: false,
        error: `Cannot re-issue: ${blocked.length} time entries are not ready — ${summary}${more}. Edit the rejected entries, submit, and approve them first.`,
      }
    }

    for (const e of entries ?? []) {
      entriesById.set(e.id, e)
    }
  }

  // Recalculate lines from corrected source data
  let subtotal = 0
  let totalTax = 0
  const taxBreakdown: TaxBreakdown = {}

  const recalculatedLines = sourceLines.map((line, idx) => {
    let lineQuantity = line.quantity
    let lineUnitPrice = line.unit_price
    let lineSubtotal = line.subtotal

    if (line.time_entry_ids && line.time_entry_ids.length > 0) {
      const lineEntries = line.time_entry_ids
        .map((id) => entriesById.get(id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
      const hours = lineEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
      const rate = lineEntries[0]?.hourly_rate ?? line.unit_price
      lineQuantity = hours
      lineUnitPrice = rate
      lineSubtotal = Math.round(hours * rate * 100) / 100
    }

    const lineTax = calculateTax(lineSubtotal, line.tax_rate)
    subtotal += lineSubtotal
    totalTax += lineTax
    if (lineTax > 0) {
      taxBreakdown[line.tax_rate] = (taxBreakdown[line.tax_rate] ?? 0) + lineTax
    }

    return {
      line_number: idx + 1,
      description: line.description,
      quantity: lineQuantity,
      unit: line.unit,
      unit_price: lineUnitPrice,
      tax_rate: line.tax_rate,
      subtotal: lineSubtotal,
      tax_amount: lineTax,
      total: lineSubtotal + lineTax,
      project_id: line.project_id ?? null,
      time_entry_ids: line.time_entry_ids ?? null,
      expense_ids: line.expense_ids ?? null,
    }
  })

  const total = subtotal + totalTax
  const today = new Date().toISOString().split('T')[0]
  const reissueNote = `[Re-issued from ${source.document_number ?? 'cancelled draft'} on ${today}]`
  const internalNotes = source.internal_notes
    ? `${source.internal_notes}\n${reissueNote}`
    : reissueNote

  const { data: newDoc, error: docErr } = await supabase
    .from('documents')
    .insert({
      company_id: membership.company_id,
      customer_id: source.customer_id,
      project_id: source.project_id,
      document_type: source.document_type,
      status: 'draft',
      payment_terms_days: source.payment_terms_days,
      notes: source.notes,
      internal_notes: internalNotes,
      subtotal,
      tax_amount: totalTax,
      total,
      tax_breakdown: taxBreakdown,
      currency: source.currency,
    })
    .select()
    .single()

  if (docErr || !newDoc) {
    return { success: false, error: docErr?.message ?? 'Failed to create new draft' }
  }

  const linesWithDocId = recalculatedLines.map((line) => ({
    ...line,
    document_id: newDoc.id,
  }))

  const { error: linesErr } = await supabase
    .from('document_lines')
    .insert(linesWithDocId)

  if (linesErr) {
    await supabase.from('documents').delete().eq('id', newDoc.id)
    return { success: false, error: linesErr.message }
  }

  // Re-link time entries to the new draft
  if (allEntryIds.length > 0) {
    const { error: linkErr } = await supabase
      .from('time_entries')
      .update({ document_id: newDoc.id, updated_at: new Date().toISOString() })
      .in('id', allEntryIds)

    if (linkErr) {
      await supabase.from('document_lines').delete().eq('document_id', newDoc.id)
      await supabase.from('documents').delete().eq('id', newDoc.id)
      return { success: false, error: `Failed to re-link time entries: ${linkErr.message}` }
    }
  }

  revalidatePath('/documents')
  revalidatePath('/timesheets')
  return { success: true, data: newDoc as Document }
}

/**
 * Refresh the company snapshot on an existing document
 * This updates the document with the latest company information (logo, bank details, etc.)
 */
export async function refreshDocumentCompanySnapshot(id: string): Promise<ActionResult<Document>> {
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  // Get the document
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('id, company_id, status')
    .eq('id', id)
    .single()

  if (docError || !document) {
    return { success: false, error: 'Document not found' }
  }

  // Get current company data
  const { data: company, error: companyError } = await adminClient
    .from('companies')
    .select('*')
    .eq('id', document.company_id)
    .single()

  if (companyError || !company) {
    return { success: false, error: 'Company not found' }
  }

  // Create new company snapshot with all fields including logo and bank details
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
    logo_url: company.logo_url,
    bank_name: company.bank_name,
    bank_iban: company.bank_iban,
    bank_bic: company.bank_bic,
  }

  // Update the document with the new snapshot
  const { data, error } = await supabase
    .from('documents')
    .update({
      company_snapshot: companySnapshot,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error refreshing company snapshot:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true, data: data as Document }
}

export async function updateDocumentProject(id: string, projectId: string | null): Promise<ActionResult<Document>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('documents')
    .update({
      project_id: projectId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating document project:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true, data: data as Document }
}

export async function autoDetectDocumentProject(id: string): Promise<ActionResult<Document>> {
  const supabase = await createClient()

  // Get all unique project_ids from document lines
  const { data: lines, error: linesError } = await supabase
    .from('document_lines')
    .select('project_id')
    .eq('document_id', id)
    .not('project_id', 'is', null)

  if (linesError) {
    return { success: false, error: linesError.message }
  }

  const uniqueProjectIds = [...new Set(lines?.map((l) => l.project_id).filter(Boolean))]

  if (uniqueProjectIds.length === 0) {
    return { success: false, error: 'No project found in document lines' }
  }

  if (uniqueProjectIds.length > 1) {
    return { success: false, error: 'Multiple projects found in document lines' }
  }

  // Set the single project on the document
  return updateDocumentProject(id, uniqueProjectIds[0] as string)
}

/**
 * Correct expense line tax rates on an issued document.
 * Uses admin client to bypass RLS (document_lines RLS requires status='draft').
 * This is for fixing VAT errors, e.g. expenses billed at 20% to a reverse charge customer.
 */
export async function correctExpenseTaxRates(
  documentId: string,
  newTaxRate: TaxRate
): Promise<ActionResult<Document>> {
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  // Verify user is authenticated and has access
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify document exists and belongs to user's company
  const { data: document } = await supabase
    .from('documents')
    .select('id, company_id, status, is_locked')
    .eq('id', documentId)
    .single()

  if (!document) {
    return { success: false, error: 'Document not found' }
  }

  if (document.is_locked) {
    return { success: false, error: 'Document is locked and cannot be corrected' }
  }

  // Get all lines for this document
  const { data: lines, error: linesError } = await adminClient
    .from('document_lines')
    .select('*')
    .eq('document_id', documentId)

  if (linesError || !lines) {
    return { success: false, error: 'Failed to fetch document lines' }
  }

  // Find expense lines (lines with expense_ids)
  const expenseLines = lines.filter(
    (line: DocumentLine) => line.expense_ids && line.expense_ids.length > 0
  )

  if (expenseLines.length === 0) {
    return { success: false, error: 'No expense lines found on this document' }
  }

  // Update each expense line's tax rate using admin client
  for (const line of expenseLines) {
    const lineTax = calculateTax(line.subtotal, newTaxRate)
    const { error: updateError } = await adminClient
      .from('document_lines')
      .update({
        tax_rate: newTaxRate,
        tax_amount: lineTax,
        total: line.subtotal + lineTax,
        updated_at: new Date().toISOString(),
      })
      .eq('id', line.id)

    if (updateError) {
      console.error('Error updating line:', updateError)
      return { success: false, error: `Failed to update line: ${line.description}` }
    }
  }

  // Recalculate document totals from all lines
  const { data: updatedLines } = await adminClient
    .from('document_lines')
    .select('*')
    .eq('document_id', documentId)

  if (!updatedLines) {
    return { success: false, error: 'Failed to fetch updated lines' }
  }

  let subtotal = 0
  let totalTax = 0
  const taxBreakdown: TaxBreakdown = {}

  for (const line of updatedLines) {
    subtotal += Number(line.subtotal)
    totalTax += Number(line.tax_amount)

    const rate = line.tax_rate as TaxRate
    if (rate in taxBreakdown) {
      taxBreakdown[rate] = (taxBreakdown[rate] || 0) + Number(line.tax_amount)
    } else {
      taxBreakdown[rate] = Number(line.tax_amount)
    }
  }

  const total = subtotal + totalTax

  // Update document totals using admin client (bypasses RLS)
  const { data: updatedDoc, error: docError } = await adminClient
    .from('documents')
    .update({
      subtotal,
      tax_amount: totalTax,
      total,
      tax_breakdown: taxBreakdown,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .select()
    .single()

  if (docError) {
    console.error('Error updating document totals:', docError)
    return { success: false, error: docError.message }
  }

  revalidatePath('/documents')
  revalidatePath(`/documents/${documentId}`)
  return { success: true, data: updatedDoc as Document }
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
