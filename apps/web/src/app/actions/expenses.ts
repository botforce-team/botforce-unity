'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface CompanyMembership {
  company_id: string
  role: string
}

// Austrian standard mileage rate (Kilometergeld) - internal constant
const MILEAGE_RATE_DEFAULT = 0.42

export async function createExpense(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company membership
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership) {
    return { error: 'No company access' }
  }

  // Accountants cannot create expenses
  if (membership.role === 'accountant') {
    return { error: 'Accountants cannot create expenses' }
  }

  const category = formData.get('category') as string
  const projectId = formData.get('project_id') as string || null
  const date = formData.get('date') as string
  const description = formData.get('description') as string || null
  const merchant = formData.get('merchant') as string || null

  let amount: number

  // Calculate amount based on category
  if (category === 'mileage') {
    const distanceKm = parseFloat(formData.get('distance_km') as string) || 0
    const ratePerKm = parseFloat(formData.get('rate_per_km') as string) || MILEAGE_RATE_DEFAULT
    amount = distanceKm * ratePerKm
  } else if (category === 'travel_time') {
    const hours = parseFloat(formData.get('hours') as string) || 0
    const hourlyRate = parseFloat(formData.get('hourly_rate') as string) || 0
    amount = hours * hourlyRate
  } else {
    // Direct amount for reimbursements and other categories
    amount = parseFloat(formData.get('amount') as string) || 0
  }

  if (amount <= 0) {
    return { error: 'Amount must be greater than 0' }
  }

  // Build metadata for specific expense types
  let fullDescription = description || ''
  if (category === 'mileage') {
    const distanceKm = parseFloat(formData.get('distance_km') as string) || 0
    const ratePerKm = parseFloat(formData.get('rate_per_km') as string) || MILEAGE_RATE_DEFAULT
    const route = formData.get('route') as string || ''
    fullDescription = `${route ? route + ' - ' : ''}${distanceKm} km @ €${ratePerKm.toFixed(2)}/km${description ? ' - ' + description : ''}`
  } else if (category === 'travel_time') {
    const hours = parseFloat(formData.get('hours') as string) || 0
    const hourlyRate = parseFloat(formData.get('hourly_rate') as string) || 0
    fullDescription = `${hours}h @ €${hourlyRate.toFixed(2)}/h${description ? ' - ' + description : ''}`
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      company_id: membership.company_id,
      user_id: user.id,
      project_id: projectId || null,
      date,
      amount,
      category,
      description: fullDescription || null,
      merchant,
      status: 'draft',
      is_reimbursable: true,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating expense:', error)
    return { error: error.message }
  }

  revalidatePath('/expenses')
  return { data }
}

export async function submitExpense(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({ status: 'submitted' } as never)
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    console.error('Error submitting expense:', error)
    return { error: error.message }
  }

  revalidatePath('/expenses')
  return { data }
}

export async function approveExpense(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
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

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can approve expenses' }
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({
      status: 'approved',
      approved_by: user.id,
    } as never)
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .eq('status', 'submitted')
    .select()
    .single()

  if (error) {
    console.error('Error approving expense:', error)
    return { error: error.message }
  }

  revalidatePath('/expenses')
  return { data }
}

export async function rejectExpense(id: string, reason: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
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

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can reject expenses' }
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({
      status: 'rejected',
      rejected_by: user.id,
      rejection_reason: reason,
    } as never)
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .eq('status', 'submitted')
    .select()
    .single()

  if (error) {
    console.error('Error rejecting expense:', error)
    return { error: error.message }
  }

  revalidatePath('/expenses')
  return { data }
}

export async function deleteExpense(id: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Can only delete own draft expenses
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'draft')

  if (error) {
    console.error('Error deleting expense:', error)
    return { error: error.message }
  }

  revalidatePath('/expenses')
  return { success: true }
}

// File upload for receipt
export async function uploadReceipt(expenseId: string, formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company membership
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as { company_id: string } | null

  if (!membership) {
    return { error: 'No company access' }
  }

  // Verify expense ownership
  const { data: expense } = await supabase
    .from('expenses')
    .select('id, user_id, status')
    .eq('id', expenseId)
    .eq('company_id', membership.company_id)
    .single()

  if (!expense) {
    return { error: 'Expense not found' }
  }

  if ((expense as any).user_id !== user.id) {
    return { error: 'You can only upload receipts to your own expenses' }
  }

  if ((expense as any).status !== 'draft') {
    return { error: 'Can only upload receipts to draft expenses' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'No file provided' }
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF' }
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: 'File too large. Maximum size is 5MB' }
  }

  // Generate unique file path
  const fileExt = file.name.split('.').pop()
  const fileName = `${membership.company_id}/${expenseId}/${Date.now()}.${fileExt}`

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('Error uploading file:', uploadError)
    return { error: uploadError.message }
  }

  // Create file record
  const { data: fileRecord, error: fileError } = await supabase
    .from('files')
    .insert({
      company_id: membership.company_id,
      storage_path: uploadData.path,
      storage_bucket: 'receipts',
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
      category: 'receipt',
    } as never)
    .select()
    .single()

  if (fileError) {
    console.error('Error creating file record:', fileError)
    // Clean up uploaded file
    await supabase.storage.from('receipts').remove([uploadData.path])
    return { error: fileError.message }
  }

  // Update expense with receipt file ID
  const { error: updateError } = await supabase
    .from('expenses')
    .update({ receipt_file_id: (fileRecord as any).id } as never)
    .eq('id', expenseId)

  if (updateError) {
    console.error('Error updating expense:', updateError)
    return { error: updateError.message }
  }

  revalidatePath('/expenses')
  return { success: true, fileId: (fileRecord as any).id }
}

// Get receipt download URL
export async function getReceiptUrl(expenseId: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company membership
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as { company_id: string } | null

  if (!membership) {
    return { error: 'No company access' }
  }

  // Get expense with file
  const { data: expense } = await supabase
    .from('expenses')
    .select(`
      id,
      receipt_file_id,
      receipt:files(storage_path, file_name)
    `)
    .eq('id', expenseId)
    .eq('company_id', membership.company_id)
    .single()

  if (!expense || !(expense as any).receipt_file_id) {
    return { error: 'No receipt found for this expense' }
  }

  const receipt = (expense as any).receipt as { storage_path: string; file_name: string }

  // Generate signed URL (valid for 1 hour)
  const { data: signedUrl, error: signedError } = await supabase.storage
    .from('receipts')
    .createSignedUrl(receipt.storage_path, 3600)

  if (signedError) {
    console.error('Error creating signed URL:', signedError)
    return { error: signedError.message }
  }

  return {
    url: signedUrl.signedUrl,
    fileName: receipt.file_name,
  }
}

// Bulk operations
export async function bulkApproveExpenses(ids: string[]) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
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

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can approve expenses' }
  }

  let successCount = 0
  let errorCount = 0

  for (const id of ids) {
    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      } as never)
      .eq('id', id)
      .eq('company_id', membership.company_id)
      .eq('status', 'submitted')

    if (error) {
      errorCount++
    } else {
      successCount++
    }
  }

  revalidatePath('/expenses')
  return { success: true, approved: successCount, errors: errorCount }
}

export async function bulkRejectExpenses(ids: string[], reason: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
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

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can reject expenses' }
  }

  let successCount = 0
  let errorCount = 0

  for (const id of ids) {
    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'rejected',
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      } as never)
      .eq('id', id)
      .eq('company_id', membership.company_id)
      .eq('status', 'submitted')

    if (error) {
      errorCount++
    } else {
      successCount++
    }
  }

  revalidatePath('/expenses')
  return { success: true, rejected: successCount, errors: errorCount }
}
