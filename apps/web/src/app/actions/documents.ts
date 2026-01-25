'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

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
  lines: z.array(documentLineSchema).min(1),
})

export async function createDocument(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company and verify admin role
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

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

  const { customer_id, document_type, notes, payment_terms_days, lines } = result.data

  // Create document
  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
      company_id: membership.company_id,
      customer_id,
      document_type,
      notes,
      payment_terms_days,
      status: 'draft',
    })
    .select()
    .single()

  if (docError) {
    console.error('Error creating document:', docError)
    return { error: docError.message }
  }

  // Create document lines
  const lineInserts = lines.map((line, index) => ({
    company_id: membership.company_id,
    document_id: document.id,
    line_number: index + 1,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
    tax_rate: line.tax_rate,
    project_id: line.project_id || null,
  }))

  const { error: linesError } = await supabase
    .from('document_lines')
    .insert(lineInserts)

  if (linesError) {
    console.error('Error creating document lines:', linesError)
    // Clean up document
    await supabase.from('documents').delete().eq('id', document.id)
    return { error: linesError.message }
  }

  revalidatePath('/documents')
  return { data: document }
}

export async function issueDocument(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can issue documents' }
  }

  // Get document to verify it's a draft
  const { data: document } = await supabase
    .from('documents')
    .select('status')
    .eq('id', id)
    .single()

  if (!document) {
    return { error: 'Document not found' }
  }

  if (document.status !== 'draft') {
    return { error: 'Only draft documents can be issued' }
  }

  // Calculate due date
  const issueDate = new Date()
  const dueDate = new Date(issueDate)

  const { data: doc } = await supabase
    .from('documents')
    .select('payment_terms_days')
    .eq('id', id)
    .single()

  if (doc?.payment_terms_days) {
    dueDate.setDate(dueDate.getDate() + doc.payment_terms_days)
  } else {
    dueDate.setDate(dueDate.getDate() + 14)
  }

  // Issue the document (trigger will handle numbering, snapshots, locking)
  const { data, error } = await supabase
    .from('documents')
    .update({
      status: 'issued',
      issue_date: issueDate.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
    })
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('documents')
    .update({
      status: 'paid',
      paid_date: new Date().toISOString().split('T')[0],
    })
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Only draft documents can be deleted
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('status', 'draft')

  if (error) {
    console.error('Error deleting document:', error)
    return { error: error.message }
  }

  revalidatePath('/documents')
  return { success: true }
}
