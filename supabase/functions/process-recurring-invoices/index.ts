// Supabase Edge Function: Process Recurring Invoices
// This function should be called via a cron job (e.g., daily at 6 AM)
// Setup: supabase functions deploy process-recurring-invoices
// Cron: curl -X POST https://<project>.supabase.co/functions/v1/process-recurring-invoices -H "Authorization: Bearer <anon-key>"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecurringTemplate {
  id: string
  company_id: string
  customer_id: string
  name: string
  frequency: string
  day_of_month: number | null
  payment_terms_days: number
  notes: string | null
  next_issue_date: string
  is_active: boolean
}

interface RecurringLine {
  id: string
  template_id: string
  company_id: string
  line_number: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  tax_rate: string
  project_id: string | null
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const today = new Date().toISOString().split('T')[0]

    // Find all active templates due for processing
    const { data: templates, error: templatesError } = await supabase
      .from('recurring_invoice_templates')
      .select('*')
      .eq('is_active', true)
      .lte('next_issue_date', today)

    if (templatesError) {
      throw new Error(`Error fetching templates: ${templatesError.message}`)
    }

    const results: { templateId: string; documentId: string | null; status: string; error?: string }[] = []

    for (const template of (templates as RecurringTemplate[]) || []) {
      try {
        // Get template lines
        const { data: lines, error: linesError } = await supabase
          .from('recurring_invoice_lines')
          .select('*')
          .eq('template_id', template.id)
          .order('line_number')

        if (linesError) {
          throw new Error(`Error fetching lines: ${linesError.message}`)
        }

        // Create draft invoice
        const { data: document, error: docError } = await supabase
          .from('documents')
          .insert({
            company_id: template.company_id,
            customer_id: template.customer_id,
            document_type: 'invoice',
            status: 'draft',
            payment_terms_days: template.payment_terms_days,
            notes: template.notes,
            recurring_template_id: template.id,
          })
          .select()
          .single()

        if (docError || !document) {
          throw new Error(`Error creating invoice: ${docError?.message}`)
        }

        // Create document lines
        const docLines = (lines as RecurringLine[]).map((line) => ({
          company_id: template.company_id,
          document_id: document.id,
          line_number: line.line_number,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unit_price: line.unit_price,
          tax_rate: line.tax_rate,
          project_id: line.project_id,
        }))

        const { error: docLinesError } = await supabase
          .from('document_lines')
          .insert(docLines)

        if (docLinesError) {
          // Clean up document
          await supabase.from('documents').delete().eq('id', document.id)
          throw new Error(`Error creating document lines: ${docLinesError.message}`)
        }

        // Calculate next issue date
        const nextDate = new Date(template.next_issue_date)
        switch (template.frequency) {
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7)
            break
          case 'biweekly':
            nextDate.setDate(nextDate.getDate() + 14)
            break
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1)
            if (template.day_of_month) {
              const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
              nextDate.setDate(Math.min(template.day_of_month, lastDay))
            }
            break
          case 'quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3)
            if (template.day_of_month) {
              const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
              nextDate.setDate(Math.min(template.day_of_month, lastDay))
            }
            break
          case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + 1)
            if (template.day_of_month) {
              const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
              nextDate.setDate(Math.min(template.day_of_month, lastDay))
            }
            break
        }

        // Update template
        await supabase
          .from('recurring_invoice_templates')
          .update({
            next_issue_date: nextDate.toISOString().split('T')[0],
            last_issued_at: new Date().toISOString(),
          })
          .eq('id', template.id)

        results.push({
          templateId: template.id,
          documentId: document.id,
          status: 'created',
        })
      } catch (err) {
        results.push({
          templateId: template.id,
          documentId: null,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        successful: results.filter(r => r.status === 'created').length,
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
