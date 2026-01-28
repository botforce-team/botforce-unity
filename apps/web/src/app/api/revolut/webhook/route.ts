/**
 * Revolut Webhook Handler
 * Receives payment status updates and transaction notifications from Revolut
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { env } from '@/lib/env'

interface WebhookEvent {
  event: string
  timestamp: string
  data: {
    id: string
    state?: string
    old_state?: string
    reason_code?: string
    reference?: string
    amount?: number
    currency?: string
    completed_at?: string
    [key: string]: unknown
  }
}

/**
 * Verify webhook signature from Revolut
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()

    // Verify webhook signature if secret is configured
    const signature = request.headers.get('revolut-signature')
    const webhookSecret = env.REVOLUT_WEBHOOK_SECRET

    if (webhookSecret && signature) {
      if (!verifySignature(rawBody, signature, webhookSecret)) {
        console.error('Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Parse the webhook payload
    const event: WebhookEvent = JSON.parse(rawBody)

    console.log('Received Revolut webhook:', event.event, event.data?.id)

    const adminClient = await createAdminClient()

    // Handle different event types
    switch (event.event) {
      case 'TransactionCreated':
      case 'TransactionStateChanged':
        await handleTransactionEvent(adminClient, event)
        break

      case 'PaymentCreated':
      case 'PaymentStateChanged':
        await handlePaymentEvent(adminClient, event)
        break

      default:
        console.log('Unhandled webhook event type:', event.event)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle transaction-related events
 */
async function handleTransactionEvent(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  event: WebhookEvent
) {
  const { id, state } = event.data

  if (!id) return

  // Update transaction status in database
  const { error } = await supabase
    .from('revolut_transactions')
    .update({
      state: state || 'unknown',
      updated_at: new Date().toISOString(),
    })
    .eq('revolut_transaction_id', id)

  if (error) {
    console.error('Failed to update transaction:', error)
  } else {
    console.log(`Transaction ${id} updated to state: ${state}`)
  }
}

/**
 * Handle payment-related events
 */
async function handlePaymentEvent(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  event: WebhookEvent
) {
  const { id, state, reason_code, completed_at } = event.data

  if (!id) return

  // Update payment status in database
  const updateData: Record<string, unknown> = {
    status: state || 'unknown',
    updated_at: new Date().toISOString(),
  }

  if (reason_code) {
    updateData.reason_code = reason_code
  }

  if (completed_at) {
    updateData.completed_at = completed_at
  }

  // Try to find by revolut_payment_id first
  let { error } = await supabase
    .from('revolut_payments')
    .update(updateData)
    .eq('revolut_payment_id', id)

  // If not found, try by request_id
  if (error) {
    const { error: error2 } = await supabase
      .from('revolut_payments')
      .update(updateData)
      .eq('request_id', id)

    error = error2
  }

  if (error) {
    console.error('Failed to update payment:', error)
  } else {
    console.log(`Payment ${id} updated to state: ${state}`)

    // If payment completed, we might want to trigger additional actions
    if (state === 'completed') {
      await handlePaymentCompleted(supabase, id)
    } else if (state === 'failed' || state === 'cancelled') {
      await handlePaymentFailed(supabase, id, reason_code)
    }
  }
}

/**
 * Handle completed payment - e.g., mark related invoice as paid
 */
async function handlePaymentCompleted(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  paymentId: string
) {
  // Get the payment details
  const { data: payment } = await supabase
    .from('revolut_payments')
    .select('id, reference, company_id, document_id')
    .or(`revolut_payment_id.eq.${paymentId},request_id.eq.${paymentId}`)
    .single()

  if (!payment) return

  // If payment is linked to a document (invoice), mark it as paid
  if (payment.document_id) {
    await supabase
      .from('documents')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment.document_id)
      .eq('company_id', payment.company_id)

    console.log(`Document ${payment.document_id} marked as paid`)
  }

  // Create an audit log entry
  await supabase
    .from('audit_log')
    .insert({
      company_id: payment.company_id,
      action: 'payment.completed',
      entity_type: 'revolut_payment',
      entity_id: payment.id,
      details: { revolut_payment_id: paymentId },
    })
}

/**
 * Handle failed payment - log and potentially notify
 */
async function handlePaymentFailed(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  paymentId: string,
  reasonCode?: string
) {
  // Get the payment details
  const { data: payment } = await supabase
    .from('revolut_payments')
    .select('id, company_id, created_by')
    .or(`revolut_payment_id.eq.${paymentId},request_id.eq.${paymentId}`)
    .single()

  if (!payment) return

  // Create an audit log entry
  await supabase
    .from('audit_log')
    .insert({
      company_id: payment.company_id,
      action: 'payment.failed',
      entity_type: 'revolut_payment',
      entity_id: payment.id,
      details: {
        revolut_payment_id: paymentId,
        reason_code: reasonCode,
      },
    })

  // TODO: Send notification to payment creator
  console.log(`Payment ${paymentId} failed with reason: ${reasonCode}`)
}

// Also support GET for webhook verification (Revolut may ping this)
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Revolut webhook endpoint' })
}
