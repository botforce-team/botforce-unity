'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { format } from 'date-fns'
import type { Database, DocumentType, DocumentStatus, TaxRate } from '@/types/database'
import { sendEmail } from '@/lib/email'
import { getInvoiceEmailHtml, getPaymentReminderEmailHtml } from '@/lib/email/templates'
import { generateInvoicePDF, type InvoiceData } from '@/lib/pdf/invoice-generator'

interface CompanyMembership {
  company_id: string
  role: string
}

type DocumentInsert = Database['public']['Tables']['documents']['Insert']
type DocumentRow = Database['public']['Tables']['documents']['Row']
type DocumentLineInsert = Database['public']['Tables']['document_lines']['Insert']

const documentLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default('hours'),
  unit_price: z.number().min(0),
  tax_rate: z.enum(['standard_20', 'reduced_10', 'zero']).default('standard_20'),
  project_id: z.string().uuid().optional(),
})

const documentSchema = z.object({
  customer_id: z.string().uuid(),
  document_type: z.enum(['invoice', 'credit_note']),
  notes: z.string().optional(),
  payment_terms_days: z.number().int().positive().default(14),
  lines: z.array(documentLineSchema),
  expense_ids: z.array(z.string().uuid()).optional(),
})

export async function createDocument(formData: FormData) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company and verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can create documents' }
  }

  // Parse JSON data from form
  const jsonData = formData.get('data') as string
  let rawData
  try {
    rawData = JSON.parse(jsonData)
  } catch {
    return { error: 'Invalid JSON data' }
  }

  const result = documentSchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input', details: result.error.flatten() }
  }

  const { customer_id, document_type, notes, payment_terms_days, lines, expense_ids } = result.data

  // Validate at least one line item or expense
  if (lines.length === 0 && (!expense_ids || expense_ids.length === 0)) {
    return { error: 'Invoice must have at least one line item or expense' }
  }

  // If we have expense_ids, fetch them to verify they're valid and approved
  let expenses: {
    id: string
    amount: number
    category: string
    description: string | null
    merchant: string | null
    project_id: string | null
  }[] = []
  if (expense_ids && expense_ids.length > 0) {
    const { data: expenseData, error: expError } = await supabase
      .from('expenses')
      .select('id, amount, category, description, merchant, project_id')
      .in('id', expense_ids)
      .eq('company_id', membership.company_id)
      .eq('status', 'approved')
      .is('exported_at', null)

    if (expError) {
      return { error: 'Error fetching expenses: ' + expError.message }
    }

    if (!expenseData || expenseData.length !== expense_ids.length) {
      return { error: 'Some expenses are invalid, already invoiced, or not approved' }
    }

    expenses = expenseData
  }

  // Create document
  const documentData: DocumentInsert = {
    company_id: membership.company_id,
    customer_id,
    document_type: document_type as DocumentType,
    notes,
    payment_terms_days,
    status: 'draft' as DocumentStatus,
  }

  const { data: documentData2, error: docError } = await supabase
    .from('documents')
    .insert(documentData as never)
    .select()
    .single()

  const document = documentData2 as DocumentRow | null

  if (docError || !document) {
    console.error('Error creating document:', docError)
    return { error: docError?.message || 'Failed to create document' }
  }

  // Create document lines for services
  let lineNumber = 0
  const lineInserts: DocumentLineInsert[] = lines.map((line) => {
    lineNumber++
    return {
      company_id: membership.company_id,
      document_id: document.id,
      line_number: lineNumber,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unit_price,
      tax_rate: line.tax_rate as TaxRate,
      project_id: line.project_id || null,
    }
  })

  // Add expense lines
  const expenseLineInserts: DocumentLineInsert[] = expenses.map((expense) => {
    lineNumber++
    const categoryLabel =
      expense.category === 'mileage'
        ? 'Kilometergeld'
        : expense.category === 'travel_time'
          ? 'Reisezeit'
          : 'Auslagenersatz'
    const description = `${categoryLabel}${expense.merchant ? ` - ${expense.merchant}` : ''}${expense.description ? ` (${expense.description})` : ''}`

    return {
      company_id: membership.company_id,
      document_id: document.id,
      line_number: lineNumber,
      description,
      quantity: 1,
      unit: 'pcs',
      unit_price: Number(expense.amount),
      tax_rate: 'zero' as TaxRate,
      project_id: expense.project_id || null,
    }
  })

  const allLines: DocumentLineInsert[] = [...lineInserts, ...expenseLineInserts]

  if (allLines.length > 0) {
    const { error: linesError } = await supabase.from('document_lines').insert(allLines as never)

    if (linesError) {
      console.error('Error creating document lines:', linesError)
      // Clean up document
      await supabase.from('documents').delete().eq('id', document.id)
      return { error: linesError.message }
    }
  }

  // Mark expenses as included in document
  if (expense_ids && expense_ids.length > 0) {
    const { error: expUpdateError } = await supabase
      .from('expenses')
      .update({ exported_at: new Date().toISOString() } as never)
      .in('id', expense_ids)

    if (expUpdateError) {
      console.error('Error marking expenses as invoiced:', expUpdateError)
      // Don't fail the whole operation for this
    }
  }

  revalidatePath('/documents')
  revalidatePath('/expenses')
  return { data: document }
}

export async function issueDocument(id: string) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as { role: string } | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can issue documents' }
  }

  // Get document to verify it's a draft
  const { data: documentData } = await supabase
    .from('documents')
    .select('status')
    .eq('id', id)
    .single()

  const documentCheck = documentData as { status: string } | null

  if (!documentCheck) {
    return { error: 'Document not found' }
  }

  if (documentCheck.status !== 'draft') {
    return { error: 'Only draft documents can be issued' }
  }

  // Calculate due date
  const issueDate = new Date()
  const dueDate = new Date(issueDate)

  const { data: docData } = await supabase
    .from('documents')
    .select('payment_terms_days')
    .eq('id', id)
    .single()

  const doc = docData as { payment_terms_days: number | null } | null

  if (doc?.payment_terms_days) {
    dueDate.setDate(dueDate.getDate() + doc.payment_terms_days)
  } else {
    dueDate.setDate(dueDate.getDate() + 14)
  }

  // Issue the document (trigger will handle numbering, snapshots, locking)
  const { data, error } = await supabase
    .from('documents')
    .update({
      status: 'issued' as DocumentStatus,
      issue_date: issueDate.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
    } as never)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error issuing document:', error)
    return { error: error.message }
  }

  revalidatePath('/documents')
  return { data }
}

export async function markDocumentPaid(id: string) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('documents')
    .update({
      status: 'paid' as DocumentStatus,
      paid_date: new Date().toISOString().split('T')[0],
    } as never)
    .eq('id', id)
    .eq('status', 'issued')
    .select()
    .single()

  if (error) {
    console.error('Error marking document paid:', error)
    return { error: error.message }
  }

  revalidatePath('/documents')
  return { data }
}

export async function deleteDocument(id: string) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Only draft documents can be deleted
  const { error } = await supabase.from('documents').delete().eq('id', id).eq('status', 'draft')

  if (error) {
    console.error('Error deleting document:', error)
    return { error: error.message }
  }

  revalidatePath('/documents')
  return { success: true }
}

// Generate PDF for a document
export async function generateDocumentPDF(id: string) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as { company_id: string } | null

  if (!membership) {
    return { error: 'No company membership found' }
  }

  // Get document with all details
  const { data: documentData, error: docError } = await supabase
    .from('documents')
    .select(
      `
      *,
      customer:customers(*),
      lines:document_lines(*)
    `
    )
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .single()

  if (docError || !documentData) {
    return { error: 'Document not found' }
  }

  // Type assertion for the complex query result
  const document = documentData as DocumentRow & {
    customer: Database['public']['Tables']['customers']['Row']
    lines: Database['public']['Tables']['document_lines']['Row'][]
  }

  // Get company details
  const { data: companyData } = await supabase
    .from('companies')
    .select('*')
    .eq('id', membership.company_id)
    .single()

  if (!companyData) {
    return { error: 'Company not found' }
  }

  const company = companyData as Database['public']['Tables']['companies']['Row']

  // Prepare invoice data
  const invoiceData: InvoiceData = {
    documentNumber: document.document_number || 'DRAFT',
    documentType: document.document_type as 'invoice' | 'credit_note',
    issueDate: document.issue_date || new Date().toISOString().split('T')[0],
    dueDate: document.due_date || new Date().toISOString().split('T')[0],
    status: document.status,
    company: {
      name: company.name,
      legalName: company.legal_name || undefined,
      vatNumber: company.vat_number || undefined,
      registrationNumber: company.registration_number || undefined,
      addressLine1: company.address_line1 || undefined,
      addressLine2: company.address_line2 || undefined,
      postalCode: company.postal_code || undefined,
      city: company.city || undefined,
      country: company.country || undefined,
      email: company.email || undefined,
      phone: company.phone || undefined,
      website: company.website || undefined,
    },
    customer: {
      name: document.customer.name,
      legalName: document.customer.legal_name || undefined,
      vatNumber: document.customer.vat_number || undefined,
      addressLine1: document.customer.address_line1 || undefined,
      addressLine2: document.customer.address_line2 || undefined,
      postalCode: document.customer.postal_code || undefined,
      city: document.customer.city || undefined,
      country: document.customer.country || undefined,
      email: document.customer.email || undefined,
    },
    lines: (document.lines || []).map((line) => {
      const l = line as {
        line_number: number
        description: string
        quantity: number
        unit: string
        unit_price: number
        tax_rate: string
        subtotal: number
        tax_amount: number | null
        total: number | null
      }
      return {
        lineNumber: l.line_number,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unit_price,
        taxRate: l.tax_rate,
        subtotal: l.subtotal,
        taxAmount: l.tax_amount || 0,
        total: l.total || l.subtotal,
      }
    }),
    subtotal: document.subtotal,
    taxAmount: document.tax_amount,
    total: document.total,
    currency: document.currency,
    taxBreakdown: (document.tax_breakdown as Record<string, { base: number; tax: number }>) || {},
    notes: document.notes || undefined,
    paymentNotes: document.payment_notes || undefined,
  }

  try {
    const pdfBuffer = await generateInvoicePDF(invoiceData)

    // Convert to base64 for client-side download
    const base64 = pdfBuffer.toString('base64')

    return {
      success: true,
      data: {
        base64,
        filename: `${document.document_number || 'draft'}.pdf`,
        contentType: 'application/pdf',
      },
    }
  } catch (error) {
    console.error('Error generating PDF:', error)
    return { error: 'Failed to generate PDF' }
  }
}

// Send invoice by email
export async function sendDocumentByEmail(id: string, recipientEmail?: string) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as { company_id: string; role: string } | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can send documents' }
  }

  // Get document with customer
  const { data: documentData, error: docError } = await supabase
    .from('documents')
    .select(
      `
      *,
      customer:customers(name, email)
    `
    )
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .single()

  if (docError || !documentData) {
    return { error: 'Document not found' }
  }

  const document = documentData as DocumentRow & {
    customer: { name: string; email?: string }
  }

  if (document.status === 'draft') {
    return { error: 'Cannot send draft documents. Please issue the document first.' }
  }

  // Get company name
  const { data: companyResult } = await supabase
    .from('companies')
    .select('name')
    .eq('id', membership.company_id)
    .single()

  const companyName = (companyResult as { name: string } | null)?.name || 'BOTFORCE'

  const customerEmail = recipientEmail || document.customer?.email
  if (!customerEmail) {
    return { error: 'No email address found for customer' }
  }

  // Generate PDF
  const pdfResult = await generateDocumentPDF(id)
  if ('error' in pdfResult && pdfResult.error) {
    return { error: pdfResult.error }
  }

  if (!pdfResult.data) {
    return { error: 'Failed to generate PDF' }
  }

  // Send email
  const docTypeLabel = document.document_type === 'invoice' ? 'Invoice' : 'Credit Note'
  const emailHtml = getInvoiceEmailHtml({
    customerName: document.customer.name,
    documentNumber: document.document_number || 'N/A',
    total: document.total,
    currency: document.currency,
    dueDate: document.due_date ? format(new Date(document.due_date), 'dd.MM.yyyy') : 'N/A',
    companyName: companyName,
  })

  const result = await sendEmail({
    to: customerEmail,
    subject: `${docTypeLabel} ${document.document_number} from ${companyName}`,
    html: emailHtml,
    attachments: [
      {
        filename: pdfResult.data.filename,
        content: Buffer.from(pdfResult.data.base64, 'base64'),
        contentType: 'application/pdf',
      },
    ],
  })

  if (!result.success) {
    return { error: result.error || 'Failed to send email' }
  }

  revalidatePath('/documents')
  return { success: true, message: `${docTypeLabel} sent to ${customerEmail}` }
}

// Send payment reminder
export async function sendPaymentReminder(id: string) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as { company_id: string; role: string } | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can send reminders' }
  }

  // Get document with customer
  const { data: reminderDocData, error: docError } = await supabase
    .from('documents')
    .select(
      `
      *,
      customer:customers(name, email)
    `
    )
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .single()

  if (docError || !reminderDocData) {
    return { error: 'Document not found' }
  }

  const reminderDoc = reminderDocData as DocumentRow & {
    customer: { name: string; email?: string }
  }

  if (reminderDoc.status !== 'issued') {
    return { error: 'Can only send reminders for issued (unpaid) invoices' }
  }

  const customerEmail = reminderDoc.customer?.email
  if (!customerEmail) {
    return { error: 'No email address found for customer' }
  }

  // Get company name
  const { data: reminderCompanyData } = await supabase
    .from('companies')
    .select('name')
    .eq('id', membership.company_id)
    .single()

  const reminderCompanyName = (reminderCompanyData as { name: string } | null)?.name || 'BOTFORCE'

  // Calculate days overdue
  const dueDate = reminderDoc.due_date ? new Date(reminderDoc.due_date) : new Date()
  const today = new Date()
  const daysOverdue = Math.max(
    0,
    Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
  )

  const emailHtml = getPaymentReminderEmailHtml({
    customerName: reminderDoc.customer.name,
    documentNumber: reminderDoc.document_number || 'N/A',
    total: reminderDoc.total,
    currency: reminderDoc.currency,
    dueDate: reminderDoc.due_date ? format(new Date(reminderDoc.due_date), 'dd.MM.yyyy') : 'N/A',
    daysOverdue,
    companyName: reminderCompanyName,
  })

  const result = await sendEmail({
    to: customerEmail,
    subject: `Payment Reminder: Invoice ${reminderDoc.document_number} - ${daysOverdue} days overdue`,
    html: emailHtml,
  })

  if (!result.success) {
    return { error: result.error || 'Failed to send reminder' }
  }

  return { success: true, message: `Reminder sent to ${customerEmail}` }
}
