/**
 * Supabase Edge Function: Sync Revolut Transactions
 *
 * Automatically syncs accounts and transactions from connected Revolut Business accounts.
 * Can be triggered via:
 * - Manual HTTP POST request
 * - Scheduled cron job (recommended: every 6 hours)
 *
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - REVOLUT_ENCRYPTION_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { createHash, createDecipheriv } from 'node:crypto'

// ============================================================================
// Types
// ============================================================================

interface RevolutConnection {
  id: string
  company_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  access_token_expires_at: string
  status: string
}

interface RevolutAccount {
  id: string
  name: string
  balance: number
  currency: string
  state: string
}

interface RevolutTransaction {
  id: string
  type: string
  state: string
  created_at: string
  completed_at?: string
  reference?: string
  legs: Array<{
    leg_id: string
    account_id: string
    counterparty?: {
      name?: string
      account_id?: string
      account_type?: string
    }
    amount: number
    currency: string
    description?: string
    balance?: number
  }>
  merchant?: {
    name?: string
    city?: string
    category_code?: string
    country?: string
  }
  card?: {
    card_number: string
  }
}

interface SyncResult {
  connectionId: string
  companyId: string
  status: 'success' | 'error' | 'skipped'
  accountsSynced: number
  transactionsSynced: number
  error?: string
}

// ============================================================================
// CORS Headers
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================================
// Encryption Utilities
// ============================================================================

function decrypt(encryptedText: string, encryptionKey: string): string {
  const key = createHash('sha256').update(encryptionKey).digest()
  const [ivHex, encrypted] = encryptedText.split(':')

  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted text format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', key, iv)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// ============================================================================
// Revolut API Client
// ============================================================================

const REVOLUT_API_BASE = 'https://sandbox-b2b.revolut.com/api/1.0'
// Production: 'https://b2b.revolut.com/api/1.0'

async function fetchRevolutAccounts(accessToken: string): Promise<RevolutAccount[]> {
  const response = await fetch(`${REVOLUT_API_BASE}/accounts`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch accounts: ${error}`)
  }

  return response.json()
}

async function fetchRevolutTransactions(
  accessToken: string,
  fromDate: string,
  count = 1000
): Promise<RevolutTransaction[]> {
  const params = new URLSearchParams({
    from: fromDate,
    count: count.toString(),
  })

  const response = await fetch(`${REVOLUT_API_BASE}/transactions?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch transactions: ${error}`)
  }

  return response.json()
}

// ============================================================================
// Sync Logic
// ============================================================================

async function syncConnection(
  connection: RevolutConnection,
  supabase: ReturnType<typeof createClient>,
  encryptionKey: string
): Promise<SyncResult> {
  const result: SyncResult = {
    connectionId: connection.id,
    companyId: connection.company_id,
    status: 'success',
    accountsSynced: 0,
    transactionsSynced: 0,
  }

  // Create sync log entry
  const { data: syncLog } = await supabase
    .from('revolut_sync_log')
    .insert({
      company_id: connection.company_id,
      connection_id: connection.id,
      sync_type: 'full',
      status: 'syncing',
    })
    .select()
    .single()

  try {
    // Decrypt access token
    const accessToken = decrypt(connection.access_token_encrypted, encryptionKey)

    // Check if token is expired (add 5 minute buffer)
    const expiresAt = new Date(connection.access_token_expires_at)
    const now = new Date()
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      // Token expired or expiring soon - mark connection for refresh
      await supabase
        .from('revolut_connections')
        .update({ status: 'expired' })
        .eq('id', connection.id)

      throw new Error('Access token expired')
    }

    // Sync accounts
    const accounts = await fetchRevolutAccounts(accessToken)

    for (const account of accounts) {
      const { error: upsertError } = await supabase
        .from('revolut_accounts')
        .upsert({
          company_id: connection.company_id,
          connection_id: connection.id,
          revolut_account_id: account.id,
          name: account.name,
          currency: account.currency,
          balance: account.balance,
          state: account.state,
          balance_updated_at: new Date().toISOString(),
        }, {
          onConflict: 'company_id,revolut_account_id',
        })

      if (!upsertError) {
        result.accountsSynced++
      }
    }

    // Get account mapping for transactions
    const { data: dbAccounts } = await supabase
      .from('revolut_accounts')
      .select('id, revolut_account_id')
      .eq('company_id', connection.company_id)

    const accountMap = new Map(
      dbAccounts?.map((a: { id: string; revolut_account_id: string }) => [a.revolut_account_id, a.id]) || []
    )

    // Sync transactions (last 30 days)
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 30)

    const transactions = await fetchRevolutTransactions(accessToken, fromDate.toISOString())

    for (const tx of transactions) {
      const leg = tx.legs[0]
      if (!leg) continue

      const accountId = accountMap.get(leg.account_id)
      if (!accountId) continue

      const { error: upsertError } = await supabase
        .from('revolut_transactions')
        .upsert({
          company_id: connection.company_id,
          account_id: accountId,
          revolut_transaction_id: tx.id,
          revolut_leg_id: leg.leg_id,
          type: tx.type,
          state: tx.state,
          amount: leg.amount,
          currency: leg.currency,
          balance_after: leg.balance,
          counterparty_name: leg.counterparty?.name,
          counterparty_account_id: leg.counterparty?.account_id,
          counterparty_account_type: leg.counterparty?.account_type,
          reference: tx.reference,
          description: leg.description,
          merchant_name: tx.merchant?.name,
          merchant_category_code: tx.merchant?.category_code,
          merchant_city: tx.merchant?.city,
          merchant_country: tx.merchant?.country,
          card_last_four: tx.card?.card_number?.slice(-4),
          transaction_date: new Date(tx.created_at).toISOString().split('T')[0],
          created_at_revolut: tx.created_at,
          completed_at_revolut: tx.completed_at,
        }, {
          onConflict: 'company_id,revolut_transaction_id',
        })

      if (!upsertError) {
        result.transactionsSynced++
      }
    }

    // Update sync log
    if (syncLog) {
      const duration = Date.now() - new Date(syncLog.started_at).getTime()
      await supabase
        .from('revolut_sync_log')
        .update({
          status: 'completed',
          records_fetched: accounts.length + transactions.length,
          records_created: result.accountsSynced + result.transactionsSynced,
          completed_at: new Date().toISOString(),
          duration_ms: duration,
        })
        .eq('id', syncLog.id)
    }

    // Update connection last sync
    await supabase
      .from('revolut_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'completed',
        last_sync_error: null,
      })
      .eq('id', connection.id)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.status = 'error'
    result.error = errorMessage

    // Update sync log with error
    if (syncLog) {
      await supabase
        .from('revolut_sync_log')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id)
    }

    // Update connection status
    await supabase
      .from('revolut_connections')
      .update({
        last_sync_status: 'failed',
        last_sync_error: errorMessage,
      })
      .eq('id', connection.id)
  }

  return result
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const encryptionKey = Deno.env.get('REVOLUT_ENCRYPTION_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    if (!encryptionKey) {
      throw new Error('Missing REVOLUT_ENCRYPTION_KEY')
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body for optional company filter
    let companyId: string | undefined
    try {
      const body = await req.json()
      companyId = body.companyId
    } catch {
      // No body or invalid JSON - sync all connections
    }

    // Get active connections
    let query = supabase
      .from('revolut_connections')
      .select('*')
      .eq('status', 'active')

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data: connections, error: connError } = await query

    if (connError) {
      throw new Error(`Failed to fetch connections: ${connError.message}`)
    }

    // Sync each connection
    const results: SyncResult[] = []

    for (const connection of connections || []) {
      const result = await syncConnection(connection, supabase, encryptionKey)
      results.push(result)
    }

    // Return summary
    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Sync error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
