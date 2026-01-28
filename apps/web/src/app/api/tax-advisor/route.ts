/**
 * AI Tax Advisor API Route
 * Provides tax advice based on Austrian law using Claude AI
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

// Austrian tax context for the AI
const AUSTRIAN_TAX_SYSTEM_PROMPT = `You are an expert Austrian tax advisor (Steuerberater) assistant for BOTFORCE Unity, a business management application. You provide helpful tax advice based on Austrian tax law (österreichisches Steuerrecht).

Your expertise includes:
- Austrian VAT (Umsatzsteuer/USt): Standard rate 20%, reduced rates 10% and 13%, exempt transactions
- Income tax for businesses (Einkommensteuer/Körperschaftsteuer)
- Reverse charge mechanism for B2B EU transactions (innergemeinschaftliche Lieferungen)
- Austrian tax deadlines (UVA monthly/quarterly, Jahreserklärung)
- Deductible business expenses (Betriebsausgaben)
- Austrian specific regulations (WKO, Finanzamt requirements)
- Small business exemption (Kleinunternehmerregelung) - threshold €35,000/year

Important guidelines:
1. Always provide advice based on Austrian law
2. Mention relevant tax codes (§) when applicable
3. Include important deadlines when relevant
4. Flag potential risks or audit concerns
5. Recommend consulting a certified Steuerberater for complex matters
6. Use German tax terms with English explanations when helpful
7. Be proactive about suggesting tax optimization opportunities

IMPORTANT: You are an AI assistant and your advice is informational only. Users should consult with a certified Steuerberater (tax advisor) for official advice and tax filings.`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  message?: string
  messages?: ChatMessage[]
  type?: 'chat' | 'insights'
}

interface FinancialSummary {
  revenue: {
    total: number
    thisMonth: number
    thisQuarter: number
    byVatRate: Record<string, number>
  }
  expenses: {
    total: number
    thisMonth: number
    byCategory: Record<string, number>
  }
  openInvoices: {
    count: number
    total: number
    overdue: number
  }
  vatDue: number
  reverseChargeTotal: number
}

async function getFinancialSummary(companyId: string): Promise<FinancialSummary> {
  const adminClient = await createAdminClient()

  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()
  const currentQuarter = Math.floor(currentMonth / 3)

  // Get start of month and quarter
  const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]
  const quarterStart = new Date(currentYear, currentQuarter * 3, 1).toISOString().split('T')[0]
  const yearStart = new Date(currentYear, 0, 1).toISOString().split('T')[0]

  // Get invoices for revenue analysis
  const { data: invoices } = await adminClient
    .from('documents')
    .select('total, subtotal, tax_amount, tax_breakdown, issue_date, status')
    .eq('company_id', companyId)
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', yearStart)

  // Get expenses
  const { data: expenses } = await adminClient
    .from('expenses')
    .select('amount, category, date, status')
    .eq('company_id', companyId)
    .in('status', ['approved', 'paid'])
    .gte('date', yearStart)

  // Get customers with reverse charge
  const { data: reverseChargeCustomers } = await adminClient
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .eq('reverse_charge', true)

  const reverseChargeIds = (reverseChargeCustomers || []).map(c => c.id)

  // Get reverse charge invoices
  const { data: reverseChargeInvoices } = await adminClient
    .from('documents')
    .select('total')
    .eq('company_id', companyId)
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])
    .in('customer_id', reverseChargeIds.length > 0 ? reverseChargeIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('issue_date', yearStart)

  // Get open invoices
  const { data: openInvoices } = await adminClient
    .from('documents')
    .select('total, due_date')
    .eq('company_id', companyId)
    .eq('document_type', 'invoice')
    .eq('status', 'issued')

  // Calculate summaries
  const today = currentDate.toISOString().split('T')[0]

  const revenue = {
    total: 0,
    thisMonth: 0,
    thisQuarter: 0,
    byVatRate: {} as Record<string, number>,
  }

  let totalVat = 0

  ;(invoices || []).forEach(inv => {
    revenue.total += inv.total || 0
    totalVat += inv.tax_amount || 0

    if (inv.issue_date >= monthStart) {
      revenue.thisMonth += inv.total || 0
    }
    if (inv.issue_date >= quarterStart) {
      revenue.thisQuarter += inv.total || 0
    }

    // Break down by VAT rate
    if (inv.tax_breakdown) {
      Object.entries(inv.tax_breakdown as Record<string, number>).forEach(([rate, amount]) => {
        revenue.byVatRate[rate] = (revenue.byVatRate[rate] || 0) + (amount as number)
      })
    }
  })

  const expenseSummary = {
    total: 0,
    thisMonth: 0,
    byCategory: {} as Record<string, number>,
  }

  ;(expenses || []).forEach(exp => {
    expenseSummary.total += exp.amount || 0
    if (exp.date >= monthStart) {
      expenseSummary.thisMonth += exp.amount || 0
    }
    const cat = exp.category || 'other'
    expenseSummary.byCategory[cat] = (expenseSummary.byCategory[cat] || 0) + (exp.amount || 0)
  })

  const openInvoiceSummary = {
    count: (openInvoices || []).length,
    total: (openInvoices || []).reduce((sum, inv) => sum + (inv.total || 0), 0),
    overdue: (openInvoices || []).filter(inv => inv.due_date && inv.due_date < today).length,
  }

  const reverseChargeTotal = (reverseChargeInvoices || []).reduce((sum, inv) => sum + (inv.total || 0), 0)

  return {
    revenue,
    expenses: expenseSummary,
    openInvoices: openInvoiceSummary,
    vatDue: totalVat,
    reverseChargeTotal,
  }
}

function formatFinancialContext(summary: FinancialSummary): string {
  const formatEur = (n: number) => `€${n.toLocaleString('de-AT', { minimumFractionDigits: 2 })}`

  return `
Current Financial Status:
- Total Revenue (YTD): ${formatEur(summary.revenue.total)}
- Revenue This Month: ${formatEur(summary.revenue.thisMonth)}
- Revenue This Quarter: ${formatEur(summary.revenue.thisQuarter)}
- VAT Collected (YTD): ${formatEur(summary.vatDue)}
- Reverse Charge Revenue: ${formatEur(summary.reverseChargeTotal)}
- Total Expenses (YTD): ${formatEur(summary.expenses.total)}
- Expenses This Month: ${formatEur(summary.expenses.thisMonth)}
- Open Invoices: ${summary.openInvoices.count} (${formatEur(summary.openInvoices.total)})
- Overdue Invoices: ${summary.openInvoices.overdue}

VAT by Rate:
${Object.entries(summary.revenue.byVatRate).map(([rate, amount]) => `- ${rate}: ${formatEur(amount)}`).join('\n') || '- No VAT data available'}

Expenses by Category:
${Object.entries(summary.expenses.byCategory).map(([cat, amount]) => `- ${cat}: ${formatEur(amount)}`).join('\n') || '- No expense data available'}
`
}

export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI Tax Advisor is not configured' },
        { status: 503 }
      )
    }

    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get company membership
    const adminClient = await createAdminClient()
    const { data: membership } = await adminClient
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No active company membership' }, { status: 403 })
    }

    // Only superadmin and accountant can use tax advisor
    if (!['superadmin', 'accountant'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse request
    const body: RequestBody = await request.json()

    // Get financial summary for context
    const financialSummary = await getFinancialSummary(membership.company_id)
    const financialContext = formatFinancialContext(financialSummary)

    // Build messages for Claude
    const systemMessage = `${AUSTRIAN_TAX_SYSTEM_PROMPT}

${financialContext}

Today's date: ${new Date().toLocaleDateString('de-AT')}`

    let userMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (body.type === 'insights') {
      // Generate proactive insights
      userMessages = [{
        role: 'user',
        content: `Based on the current financial data, provide 3-5 actionable tax insights and recommendations. Focus on:
1. Any upcoming deadlines I should be aware of
2. Potential tax optimization opportunities
3. Compliance concerns or risks
4. Recommendations based on the current financial situation

Format your response as a list of concise insights, each with a brief explanation. Be specific and actionable.`
      }]
    } else if (body.messages) {
      userMessages = body.messages
    } else if (body.message) {
      userMessages = [{ role: 'user', content: body.message }]
    } else {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    // Call Claude API
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemMessage,
        messages: userMessages,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Claude API error:', error)
      return NextResponse.json(
        { error: 'AI service temporarily unavailable' },
        { status: 502 }
      )
    }

    const data = await response.json()
    const assistantMessage = data.content?.[0]?.text || 'Unable to generate response'

    return NextResponse.json({
      message: assistantMessage,
      disclaimer: 'This is AI-generated advice for informational purposes only. Please consult a certified Steuerberater for official tax advice.',
    })

  } catch (error) {
    console.error('Tax advisor error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
