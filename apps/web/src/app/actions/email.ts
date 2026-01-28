'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { invoiceEmailTemplate, paymentReminderTemplate } from '@/lib/email/templates'
import { env } from '@/lib/env'
import type { ActionResult, Document, Customer } from '@/types'

export async function sendInvoiceEmail(documentId: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Fetch document with customer
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('*, customer:customers(*)')
    .eq('id', documentId)
    .single()

  if (docError || !document) {
    return { success: false, error: 'Document not found' }
  }

  if (!['issued', 'paid'].includes(document.status)) {
    return { success: false, error: 'Document must be issued before sending' }
  }

  const customer = document.customer as Customer
  if (!customer?.email) {
    return { success: false, error: 'Customer has no email address' }
  }

  // Get company info
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', document.company_id)
    .single()

  const companyInfo = {
    name: company?.name || 'Company',
    email: company?.email,
    phone: company?.phone,
    website: company?.website,
    address: [
      company?.address_line1,
      company?.address_line2,
      [company?.postal_code, company?.city].filter(Boolean).join(' '),
      company?.country,
    ]
      .filter(Boolean)
      .join(', '),
  }

  // Generate PDF URL
  const pdfUrl = `${env.NEXT_PUBLIC_APP_URL}/api/documents/${documentId}/pdf`

  // Generate email content
  const { subject, html, text } = invoiceEmailTemplate(
    document as Document,
    customer,
    companyInfo,
    pdfUrl
  )

  // Send email
  const result = await sendEmail({
    to: customer.email,
    subject,
    html,
    text,
    replyTo: company?.email,
  })

  if (!result.success) {
    return { success: false, error: result.error || 'Failed to send email' }
  }

  // Log the email send
  await supabase.from('audit_log').insert({
    company_id: document.company_id,
    action: 'email_sent',
    entity_type: 'document',
    entity_id: documentId,
    details: {
      to: customer.email,
      subject,
      message_id: result.messageId,
    },
  })

  // Update document with email sent timestamp
  await supabase
    .from('documents')
    .update({
      last_email_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)

  revalidatePath(`/documents/${documentId}`)
  return { success: true }
}

export async function sendPaymentReminder(documentId: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Fetch document with customer
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('*, customer:customers(*)')
    .eq('id', documentId)
    .single()

  if (docError || !document) {
    return { success: false, error: 'Document not found' }
  }

  if (document.status !== 'issued') {
    return { success: false, error: 'Can only send reminders for issued invoices' }
  }

  if (document.document_type !== 'invoice') {
    return { success: false, error: 'Can only send reminders for invoices' }
  }

  const customer = document.customer as Customer
  if (!customer?.email) {
    return { success: false, error: 'Customer has no email address' }
  }

  // Get company info
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', document.company_id)
    .single()

  const companyInfo = {
    name: company?.name || 'Company',
    email: company?.email,
    phone: company?.phone,
  }

  // Calculate days overdue
  const dueDate = new Date(document.due_date)
  const today = new Date()
  const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

  // Generate PDF URL
  const pdfUrl = `${env.NEXT_PUBLIC_APP_URL}/api/documents/${documentId}/pdf`

  // Generate email content
  const { subject, html, text } = paymentReminderTemplate(
    document as Document,
    customer,
    companyInfo,
    daysOverdue,
    pdfUrl
  )

  // Send email
  const result = await sendEmail({
    to: customer.email,
    subject,
    html,
    text,
    replyTo: company?.email,
  })

  if (!result.success) {
    return { success: false, error: result.error || 'Failed to send email' }
  }

  // Log the reminder
  await supabase.from('audit_log').insert({
    company_id: document.company_id,
    action: 'payment_reminder_sent',
    entity_type: 'document',
    entity_id: documentId,
    details: {
      to: customer.email,
      subject,
      days_overdue: daysOverdue,
      message_id: result.messageId,
    },
  })

  // Update document
  await supabase
    .from('documents')
    .update({
      reminder_count: (document.reminder_count || 0) + 1,
      last_reminder_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)

  revalidatePath(`/documents/${documentId}`)
  return { success: true }
}

// Get overdue invoices for reminder sending
export async function getOverdueInvoices(): Promise<{
  data: (Document & { customer: Customer; days_overdue: number })[]
  error?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return { data: [], error: 'No company membership' }
  }

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('documents')
    .select('*, customer:customers(*)')
    .eq('company_id', membership.company_id)
    .eq('document_type', 'invoice')
    .eq('status', 'issued')
    .lt('due_date', today)
    .order('due_date', { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }

  const todayDate = new Date()
  const overdueInvoices = (data || []).map((doc: any) => {
    const dueDate = new Date(doc.due_date)
    const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    return {
      ...doc,
      days_overdue: daysOverdue,
    }
  })

  return { data: overdueInvoices }
}
