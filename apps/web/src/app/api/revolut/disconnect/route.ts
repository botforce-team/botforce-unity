/**
 * Revolut Disconnect
 * Disconnects the Revolut integration and optionally removes synced data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  successResponse,
} from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({}))
    const deleteData = body.deleteData === true

    // Verify user is authenticated and is superadmin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorizedResponse()
    }

    // Get company membership with role using admin client to bypass RLS
    const adminClient = await createAdminClient()
    const { data: membership, error: membershipError } = await adminClient
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (membershipError || !membership) {
      return unauthorizedResponse('No active company membership')
    }

    if (membership.role !== 'superadmin') {
      return forbiddenResponse('Only superadmins can disconnect Revolut')
    }

    // Get Revolut connection
    const { data: connection, error: connError } = await supabase
      .from('revolut_connections')
      .select('id')
      .eq('company_id', membership.company_id)
      .single()

    if (connError || !connection) {
      return errorResponse('No Revolut connection found', 400, 'NO_CONNECTION')
    }

    if (deleteData) {
      // Delete all Revolut data (cascades from connection)
      // Due to foreign key constraints, deleting connection will delete:
      // - revolut_accounts
      // - revolut_transactions
      // - revolut_payments
      // - revolut_sync_log
      const { error: deleteError } = await supabase
        .from('revolut_connections')
        .delete()
        .eq('id', connection.id)

      if (deleteError) {
        console.error('Failed to delete Revolut connection:', deleteError)
        return errorResponse('Failed to disconnect', 500, 'DELETE_FAILED')
      }
    } else {
      // Just mark as revoked, keep data for historical purposes
      const { error: updateError } = await supabase
        .from('revolut_connections')
        .update({
          status: 'revoked',
          disconnected_at: new Date().toISOString(),
          access_token_encrypted: '', // Clear tokens
          refresh_token_encrypted: '',
        })
        .eq('id', connection.id)

      if (updateError) {
        console.error('Failed to revoke Revolut connection:', updateError)
        return errorResponse('Failed to disconnect', 500, 'UPDATE_FAILED')
      }
    }

    return successResponse({
      success: true,
      dataDeleted: deleteData,
    })

  } catch (error) {
    console.error('Revolut disconnect error:', error)
    return errorResponse('Failed to disconnect Revolut', 500, 'DISCONNECT_FAILED')
  }
}
