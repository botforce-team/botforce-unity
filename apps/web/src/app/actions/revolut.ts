'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

// ============================================================================
// Types
// ============================================================================

export interface RevolutConnectionInfo {
  id: string
  status: 'active' | 'expired' | 'revoked' | 'error'
  connected_at: string
  last_sync_at: string | null
  last_sync_status: 'pending' | 'syncing' | 'completed' | 'failed' | null
  last_sync_error: string | null
}

export interface RevolutAccountInfo {
  id: string
  revolut_account_id: string
  name: string | null
  currency: string
  balance: number
  state: string | null
  iban: string | null
  is_primary: boolean
  balance_updated_at: string | null
}

export interface RevolutTransactionInfo {
  id: string
  revolut_transaction_id: string
  type: string
  state: string
  amount: number
  currency: string
  counterparty_name: string | null
  reference: string | null
  description: string | null
  merchant_name: string | null
  transaction_date: string
  is_reconciled: boolean
  expense_id: string | null
  document_id: string | null
  category: string | null
  account?: {
    name: string | null
    currency: string
  }
}

export interface RevolutPaymentInfo {
  id: string
  amount: number
  currency: string
  recipient_name: string
  recipient_iban: string | null
  reference: string | null
  status: string
  created_at: string
  completed_at: string | null
  document_id: string | null
}

// ============================================================================
// Connection
// ============================================================================

/**
 * Get Revolut connection status
 */
export async function getRevolutConnection(): Promise<ActionResult<RevolutConnectionInfo | null>> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  const { data: connection, error } = await supabase
    .from('revolut_connections')
    .select(`
      id,
      status,
      connected_at,
      last_sync_at,
      last_sync_status,
      last_sync_error
    `)
    .eq('company_id', membership.company_id)
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: connection as RevolutConnectionInfo | null }
}

// ============================================================================
// Accounts
// ============================================================================

/**
 * Get all Revolut accounts
 */
export async function getRevolutAccounts(): Promise<ActionResult<RevolutAccountInfo[]>> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  // Only superadmin and accountant can view accounts
  if (membership.role !== 'superadmin' && membership.role !== 'accountant') {
    return { success: false, error: 'Insufficient permissions' }
  }

  const { data: accounts, error } = await supabase
    .from('revolut_accounts')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('is_primary', { ascending: false })
    .order('currency')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: accounts as RevolutAccountInfo[] }
}

/**
 * Get total balance by currency
 */
export async function getRevolutBalances(): Promise<ActionResult<Record<string, number>>> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  // Only superadmin and accountant can view balances
  if (membership.role !== 'superadmin' && membership.role !== 'accountant') {
    return { success: false, error: 'Insufficient permissions' }
  }

  const { data: accounts, error } = await supabase
    .from('revolut_accounts')
    .select('balance, currency')
    .eq('company_id', membership.company_id)
    .eq('state', 'active')

  if (error) {
    return { success: false, error: error.message }
  }

  // Group by currency
  const balances = (accounts || []).reduce((acc, account) => {
    acc[account.currency] = (acc[account.currency] || 0) + Number(account.balance)
    return acc
  }, {} as Record<string, number>)

  return { success: true, data: balances }
}

// ============================================================================
// Transactions
// ============================================================================

export interface TransactionFilters {
  accountId?: string
  fromDate?: string
  toDate?: string
  type?: string
  isReconciled?: boolean
  limit?: number
  offset?: number
}

/**
 * Get Revolut transactions with filters
 */
export async function getRevolutTransactions(
  filters: TransactionFilters = {}
): Promise<ActionResult<{ transactions: RevolutTransactionInfo[]; total: number }>> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  // Only superadmin and accountant can view transactions
  if (membership.role !== 'superadmin' && membership.role !== 'accountant') {
    return { success: false, error: 'Insufficient permissions' }
  }

  const { limit = 50, offset = 0 } = filters

  let query = supabase
    .from('revolut_transactions')
    .select(`
      *,
      account:revolut_accounts(name, currency)
    `, { count: 'exact' })
    .eq('company_id', membership.company_id)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.accountId) {
    query = query.eq('account_id', filters.accountId)
  }
  if (filters.fromDate) {
    query = query.gte('transaction_date', filters.fromDate)
  }
  if (filters.toDate) {
    query = query.lte('transaction_date', filters.toDate)
  }
  if (filters.type) {
    query = query.eq('type', filters.type)
  }
  if (filters.isReconciled !== undefined) {
    query = query.eq('is_reconciled', filters.isReconciled)
  }

  query = query.range(offset, offset + limit - 1)

  const { data: transactions, error, count } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: {
      transactions: transactions as RevolutTransactionInfo[],
      total: count || 0,
    },
  }
}

/**
 * Get recent transactions for dashboard
 */
export async function getRecentRevolutTransactions(
  limit = 10
): Promise<ActionResult<RevolutTransactionInfo[]>> {
  const result = await getRevolutTransactions({ limit })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data?.transactions || [] }
}

// ============================================================================
// Reconciliation
// ============================================================================

/**
 * Reconcile a transaction with an expense or document
 */
export async function reconcileTransaction(
  transactionId: string,
  data: {
    expenseId?: string | null
    documentId?: string | null
    category?: string | null
    notes?: string | null
  }
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  // Only superadmin and accountant can reconcile
  if (membership.role !== 'superadmin' && membership.role !== 'accountant') {
    return { success: false, error: 'Only admins and accountants can reconcile transactions' }
  }

  const { error } = await supabase
    .from('revolut_transactions')
    .update({
      expense_id: data.expenseId || null,
      document_id: data.documentId || null,
      category: data.category || null,
      notes: data.notes || null,
      is_reconciled: !!(data.expenseId || data.documentId),
      reconciled_at: data.expenseId || data.documentId ? new Date().toISOString() : null,
      reconciled_by: data.expenseId || data.documentId ? user.id : null,
    })
    .eq('id', transactionId)
    .eq('company_id', membership.company_id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/finance')
  return { success: true }
}

/**
 * Unreconcile a transaction
 */
export async function unreconcileTransaction(transactionId: string): Promise<ActionResult> {
  return reconcileTransaction(transactionId, {
    expenseId: null,
    documentId: null,
    category: null,
    notes: null,
  })
}

// ============================================================================
// Payments
// ============================================================================

/**
 * Get Revolut payments
 */
export async function getRevolutPayments(
  filters: { status?: string; limit?: number; offset?: number } = {}
): Promise<ActionResult<{ payments: RevolutPaymentInfo[]; total: number }>> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  // Only superadmin and accountant can view payments
  if (membership.role !== 'superadmin' && membership.role !== 'accountant') {
    return { success: false, error: 'Insufficient permissions' }
  }

  const { limit = 50, offset = 0 } = filters

  let query = supabase
    .from('revolut_payments')
    .select('*', { count: 'exact' })
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  query = query.range(offset, offset + limit - 1)

  const { data: payments, error, count } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: {
      payments: payments as RevolutPaymentInfo[],
      total: count || 0,
    },
  }
}

/**
 * Create a payment request
 */
export async function createPayment(data: {
  sourceAccountId: string
  amount: number
  currency: string
  recipientName: string
  recipientIban: string
  recipientBic?: string
  reference?: string
  documentId?: string
}): Promise<ActionResult<{ paymentId: string }>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  // Only superadmin can create payments
  if (membership.role !== 'superadmin') {
    return { success: false, error: 'Only superadmins can create payments' }
  }

  // Get connection
  const { data: connection, error: connError } = await supabase
    .from('revolut_connections')
    .select('id')
    .eq('company_id', membership.company_id)
    .eq('status', 'active')
    .single()

  if (connError || !connection) {
    return { success: false, error: 'No active Revolut connection' }
  }

  // Create payment record
  const { data: payment, error } = await supabase
    .from('revolut_payments')
    .insert({
      company_id: membership.company_id,
      connection_id: connection.id,
      source_account_id: data.sourceAccountId,
      amount: data.amount,
      currency: data.currency,
      recipient_name: data.recipientName,
      recipient_iban: data.recipientIban,
      recipient_bic: data.recipientBic,
      reference: data.reference,
      document_id: data.documentId,
      request_id: crypto.randomUUID(),
      created_by: user.id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // TODO: In production, trigger Edge Function to execute payment via Revolut API

  revalidatePath('/finance')
  return { success: true, data: { paymentId: payment.id } }
}

// ============================================================================
// Sync Log
// ============================================================================

/**
 * Get recent sync logs
 */
export async function getRevolutSyncLogs(
  limit = 10
): Promise<ActionResult<Array<{
  id: string
  sync_type: string
  status: string
  records_fetched: number
  records_created: number
  records_updated: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  duration_ms: number | null
}>>> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.company_id) {
    return { success: false, error: 'No company found' }
  }

  // Only superadmin and accountant can view logs
  if (membership.role !== 'superadmin' && membership.role !== 'accountant') {
    return { success: false, error: 'Insufficient permissions' }
  }

  const { data: logs, error } = await supabase
    .from('revolut_sync_log')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: logs }
}
