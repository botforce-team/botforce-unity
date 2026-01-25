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
  lines: z.array(documentLineSchema),
  expense_ids: z.array(z.string().uuid()).optional(),
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

  const { customer_id, document_type, notes, payment_terms_days, lines, expense_ids } = result.data

  // Validate at least one line item or expense
  if (lines.length === 0 && (!expense_ids || expense_ids.length === 0)) {
    return { error: 'Invoice must have at least one line item or expense' }
  }

  // If we have expense_ids, fetch them to verify they're valid and approved
  let expenses: { id: string, amount: number, category: string, description: string | null, merchant: string | null, project_id: string | null }[] = []
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

  // Create document lines for services
  let lineNumber = 0
  const lineInserts = lines.map((line) => {
    lineNumber++
    return {
      company_id: membership.company_id,
      document_id: document.id,
      line_number: lineNumber,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unit_price,
      tax_rate: line.tax_rate,
      project_id: line.project_id || null,
    }
  })

  // Add expense lines
  const expenseLineInserts = expenses.map((expense) => {
    lineNumber++
    const categoryLabel = expense.category === 'mileage' ? 'Kilometergeld' :
                          expense.category === 'travel_time' ? 'Reisezeit' :
                          'Auslagenersatz'
    const description = `${categoryLabel}${expense.merchant ? ` - ${expense.merchant}` : ''}${expense.description ? ` (${expense.description})` : ''}`

    return {
      company_id: membership.company_id,
      document_id: document.id,
      line_number: lineNumber,
      description,
      quantity: 1,
      unit: 'pcs',
      unit_price: Number(expense.amount),
      tax_rate: 'zero' as const, // Expenses typically have tax already included or are 0%
      project_id: expense.project_id || null,
    }
  })

  const allLines = [...lineInserts, ...expenseLineInserts]

  if (allLines.length > 0) {
    const { error: linesError } = await supabase
      .from('document_lines')
      .insert(allLines)

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
      .update({ exported_at: new Date().toISOString() })
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
