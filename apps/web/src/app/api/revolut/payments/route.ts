/**
 * Revolut Payment Creation
 * Creates a new payment via Revolut Business API
 */

import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  successResponse,
  badRequestResponse,
} from '@/lib/api-utils'
import { RevolutClient } from '@/lib/revolut'
import { decrypt } from '@/lib/revolut/encryption'
import { randomUUID } from 'crypto'

interface PaymentRequest {
  sourceAccountId: string
  recipient: {
    name: string
    iban: string
    bic?: string
  }
  amount: number
  currency: string
  reference: string
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: PaymentRequest = await request.json()

    // Validate required fields
    if (!body.sourceAccountId || !body.recipient?.name || !body.recipient?.iban || !body.amount || !body.currency || !body.reference) {
      return badRequestResponse('Missing required fields')
    }

    if (body.amount <= 0) {
      return badRequestResponse('Amount must be positive')
    }

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
      return forbiddenResponse('Only superadmins can create payments')
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

    // Get the source account to verify it exists
    const { data: account, error: accountError } = await supabase
      .from('revolut_accounts')
      .select('revolut_account_id, currency')
      .eq('id', body.sourceAccountId)
      .eq('company_id', membership.company_id)
      .single()

    if (accountError || !account) {
      return errorResponse('Source account not found', 400, 'ACCOUNT_NOT_FOUND')
    }

    // Decrypt access token
    const accessToken = decrypt(connection.access_token_encrypted)

    // Create API client
    const client = new RevolutClient(accessToken)

    // Generate unique request ID for idempotency
    const requestId = randomUUID()

    // Create counterparty first (Revolut requires this)
    let counterpartyId: string

    try {
      const counterparty = await client.createCounterparty({
        company_name: body.recipient.name,
        bank_country: body.recipient.iban.substring(0, 2), // Extract country from IBAN
        currency: body.currency,
        iban: body.recipient.iban,
        bic: body.recipient.bic,
      })
      counterpartyId = counterparty.id
    } catch (cpError) {
      console.error('Failed to create counterparty:', cpError)
      return errorResponse(
        'Failed to create recipient. Please verify IBAN and recipient details.',
        400,
        'COUNTERPARTY_FAILED'
      )
    }

    // Create the payment
    try {
      const payment = await client.createPayment({
        request_id: requestId,
        account_id: account.revolut_account_id,
        receiver: {
          counterparty_id: counterpartyId,
          account_id: counterpartyId, // For external transfers, same as counterparty_id
        },
        amount: Math.round(body.amount * 100), // Convert to minor units (cents)
        currency: body.currency,
        reference: body.reference,
      })

      // Store payment in database
      const { data: dbPayment, error: dbError } = await supabase
        .from('revolut_payments')
        .insert({
          company_id: membership.company_id,
          connection_id: connection.id,
          revolut_payment_id: payment.id,
          request_id: requestId,
          source_account_id: body.sourceAccountId,
          recipient_name: body.recipient.name,
          recipient_iban: body.recipient.iban,
          recipient_bic: body.recipient.bic || null,
          amount: body.amount,
          currency: body.currency,
          reference: body.reference,
          status: payment.state || 'pending',
          created_by: user.id,
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (dbError) {
        console.error('Failed to store payment in database:', dbError)
        // Payment was created in Revolut, but we failed to store it locally
        // Return success anyway since the payment is processing
      }

      return successResponse({
        success: true,
        payment: {
          id: dbPayment?.id || payment.id,
          revolut_id: payment.id,
          status: payment.state || 'pending',
          amount: body.amount,
          currency: body.currency,
          recipient: body.recipient.name,
          reference: body.reference,
        },
      })

    } catch (paymentError) {
      console.error('Failed to create payment:', paymentError)
      const message = paymentError instanceof Error ? paymentError.message : 'Payment creation failed'
      return errorResponse(message, 400, 'PAYMENT_FAILED')
    }

  } catch (error) {
    console.error('Payment API error:', error)
    const message = error instanceof Error ? error.message : 'An error occurred'
    return errorResponse(message, 500, 'INTERNAL_ERROR')
  }
}

// GET endpoint to list payments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorizedResponse()
    }

    // Get company membership using admin client to bypass RLS
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

    // Get query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    // Build query
    let query = supabase
      .from('revolut_payments')
      .select('*', { count: 'exact' })
      .eq('company_id', membership.company_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: payments, error: paymentsError, count } = await query

    if (paymentsError) {
      console.error('Failed to fetch payments:', paymentsError)
      return errorResponse('Failed to fetch payments', 500, 'FETCH_FAILED')
    }

    return successResponse({
      payments: payments || [],
      total: count || 0,
      limit,
      offset,
    })

  } catch (error) {
    console.error('Payments list error:', error)
    return errorResponse('An error occurred', 500, 'INTERNAL_ERROR')
  }
}
