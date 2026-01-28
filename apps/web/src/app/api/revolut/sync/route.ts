/**
 * Revolut Manual Sync Trigger
 * Triggers a sync of Revolut data for the current company
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  successResponse,
} from '@/lib/api-utils'
import { RevolutClient, parseAccount, parseTransaction } from '@/lib/revolut'
import { decrypt } from '@/lib/revolut/encryption'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and is superadmin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorizedResponse()
    }

    // Get company membership with role
    const { data: membership, error: membershipError } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (membershipError || !membership) {
      return unauthorizedResponse('No active company membership')
    }

    if (membership.role !== 'superadmin') {
      return forbiddenResponse('Only superadmins can trigger sync')
    }

    // Get Revolut connection
    const { data: connection, error: connError } = await supabase
      .from('revolut_connections')
      .select('*')
      .eq('company_id', membership.company_id)
      .eq('status', 'active')
      .single()

    if (connError || !connection) {
      return errorResponse('No active Revolut connection', 400, 'NO_CONNECTION')
    }

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('revolut_sync_log')
      .insert({
        company_id: membership.company_id,
        connection_id: connection.id,
        sync_type: 'full',
        status: 'syncing',
      })
      .select()
      .single()

    if (logError) {
      console.error('Failed to create sync log:', logError)
    }

    try {
      // Decrypt access token
      const accessToken = decrypt(connection.access_token_encrypted)

      // TODO: Check if token needs refresh and refresh if needed

      // Create API client
      const client = new RevolutClient(accessToken)

      // Sync accounts
      const accounts = await client.getAccounts()
      let accountsSynced = 0

      for (const account of accounts) {
        const parsed = parseAccount(account)

        const { error: upsertError } = await supabase
          .from('revolut_accounts')
          .upsert({
            company_id: membership.company_id,
            connection_id: connection.id,
            ...parsed,
            balance_updated_at: new Date().toISOString(),
          }, {
            onConflict: 'company_id,revolut_account_id',
          })

        if (!upsertError) {
          accountsSynced++
        }
      }

      // Get account IDs for transaction sync
      const { data: dbAccounts } = await supabase
        .from('revolut_accounts')
        .select('id, revolut_account_id')
        .eq('company_id', membership.company_id)

      const accountMap = new Map(
        dbAccounts?.map(a => [a.revolut_account_id, a.id]) || []
      )

      // Sync transactions (last 30 days)
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 30)

      const transactions = await client.getTransactions({
        from: fromDate.toISOString(),
        count: 1000,
      })

      let transactionsSynced = 0

      for (const tx of transactions) {
        // Find the account this transaction belongs to
        const leg = tx.legs[0]
        const accountId = accountMap.get(leg?.account_id)

        if (!accountId) continue

        const parsed = parseTransaction(tx, leg.account_id)

        const { error: upsertError } = await supabase
          .from('revolut_transactions')
          .upsert({
            company_id: membership.company_id,
            account_id: accountId,
            ...parsed,
          }, {
            onConflict: 'company_id,revolut_transaction_id',
          })

        if (!upsertError) {
          transactionsSynced++
        }
      }

      // Update sync log
      if (syncLog) {
        await supabase
          .from('revolut_sync_log')
          .update({
            status: 'completed',
            records_fetched: accounts.length + transactions.length,
            records_created: accountsSynced + transactionsSynced,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - new Date(syncLog.started_at).getTime(),
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

      return successResponse({
        success: true,
        accounts_synced: accountsSynced,
        transactions_synced: transactionsSynced,
      })

    } catch (syncError) {
      const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown error'

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

      throw syncError
    }

  } catch (error) {
    console.error('Revolut sync error:', error)
    const message = error instanceof Error ? error.message : 'Sync failed'
    return errorResponse(message, 500, 'SYNC_FAILED')
  }
}
