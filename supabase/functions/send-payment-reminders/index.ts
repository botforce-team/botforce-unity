// Supabase Edge Function: Send Payment Reminders
// This function should be called via a cron job (e.g., daily at 9 AM)
// Setup: supabase functions deploy send-payment-reminders
// Cron: curl -X POST https://<project>.supabase.co/functions/v1/send-payment-reminders -H "Authorization: Bearer <anon-key>"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OverdueInvoice {
  id: string
  document_number: string
  total: number
  currency: string
  due_date: string
  company_id: string
  customer: {
    name: string
    email: string
  }
  company: {
    name: string
    email: string
  }
}

function getPaymentReminderHtml(params: {
  customerName: string
  documentNumber: string
  total: number
  currency: string
  dueDate: string
  daysOverdue: number
  companyName: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder - ${params.documentNumber}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${params.companyName}</h1>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <h2 style="color: #dc3545; margin-top: 0;">Payment Reminder</h2>

    <p>Dear ${params.customerName},</p>

    <p>This is a friendly reminder that invoice <strong>${params.documentNumber}</strong> is now <strong>${params.daysOverdue} days overdue</strong>.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Invoice Number:</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${params.documentNumber}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Amount Due:</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 18px; color: #dc3545;"><strong>${params.currency} ${params.total.toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px;"><strong>Original Due Date:</strong></td>
        <td style="padding: 10px;">${params.dueDate}</td>
      </tr>
    </table>

    <p>Please arrange payment at your earliest convenience. If you have already made the payment, please disregard this reminder.</p>

    <p style="margin-bottom: 0;">Best regards,<br><strong>${params.companyName}</strong></p>
  </div>

  <div style="background: #333; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="color: #999; margin: 0; font-size: 12px;">This email was sent automatically by BOTFORCE Unity</p>
  </div>
</body>
</html>
`
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body for configuration
    let reminderDays = [7, 14, 30] // Default: remind at 7, 14, and 30 days overdue
    try {
      const body = await req.json()
      if (body.reminderDays && Array.isArray(body.reminderDays)) {
        reminderDays = body.reminderDays
      }
    } catch {
      // Use defaults if no body
    }

    const today = new Date()

    // Find all issued (unpaid) invoices that are overdue
    const { data: invoices, error: invoicesError } = await supabase
      .from('documents')
      .select(`
        id,
        document_number,
        total,
        currency,
        due_date,
        company_id,
        customer:customers(name, email),
        company:companies(name, email)
      `)
      .eq('document_type', 'invoice')
      .eq('status', 'issued')
      .lt('due_date', today.toISOString().split('T')[0])

    if (invoicesError) {
      throw new Error(`Error fetching invoices: ${invoicesError.message}`)
    }

    const results: { invoiceId: string; daysOverdue: number; status: string; error?: string }[] = []

    // Check if we have email service
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          error: 'RESEND_API_KEY not configured',
          invoicesFound: (invoices || []).length,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const resend = new Resend(resendApiKey)

    for (const invoice of (invoices as OverdueInvoice[]) || []) {
      const dueDate = new Date(invoice.due_date)
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

      // Only send reminders on specific days
      if (!reminderDays.includes(daysOverdue)) {
        continue
      }

      const customerEmail = invoice.customer?.email
      if (!customerEmail) {
        results.push({
          invoiceId: invoice.id,
          daysOverdue,
          status: 'skipped',
          error: 'No customer email',
        })
        continue
      }

      try {
        const html = getPaymentReminderHtml({
          customerName: invoice.customer.name,
          documentNumber: invoice.document_number,
          total: Number(invoice.total),
          currency: invoice.currency,
          dueDate: new Date(invoice.due_date).toLocaleDateString('de-AT'),
          daysOverdue,
          companyName: invoice.company?.name || 'BOTFORCE',
        })

        await resend.emails.send({
          from: invoice.company?.email || 'noreply@botforce.at',
          to: customerEmail,
          subject: `Payment Reminder: Invoice ${invoice.document_number} - ${daysOverdue} days overdue`,
          html,
        })

        results.push({
          invoiceId: invoice.id,
          daysOverdue,
          status: 'sent',
        })
      } catch (err) {
        results.push({
          invoiceId: invoice.id,
          daysOverdue,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        sent: results.filter(r => r.status === 'sent').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed: results.filter(r => r.status === 'error').length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
