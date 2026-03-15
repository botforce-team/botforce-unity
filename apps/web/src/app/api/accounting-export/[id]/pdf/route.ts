import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notFoundResponse, errorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

function formatPeriod(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = await createAdminClient()

    // Get export record
    const { data: exportData, error: exportError } = await supabase
      .from('accounting_exports')
      .select('*')
      .eq('id', id)
      .single()

    if (exportError || !exportData) {
      return notFoundResponse('Export')
    }

    // Get company details
    const { data: company } = await adminClient
      .from('companies')
      .select('*')
      .eq('id', exportData.company_id)
      .single()

    if (!company) {
      return errorResponse('Company not found', 404)
    }

    // Get invoices for the period
    const { data: invoices } = await supabase
      .from('documents')
      .select('*, customer:customers(name, vat_number)')
      .eq('document_type', 'invoice')
      .in('status', ['issued', 'paid'])
      .gte('issue_date', exportData.period_start)
      .lte('issue_date', exportData.period_end)
      .order('issue_date')

    // Get credit notes
    const { data: creditNotes } = await supabase
      .from('documents')
      .select('*, customer:customers(name, vat_number)')
      .eq('document_type', 'credit_note')
      .in('status', ['issued', 'paid'])
      .gte('issue_date', exportData.period_start)
      .lte('issue_date', exportData.period_end)
      .order('issue_date')

    // Get expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('status', 'approved')
      .gte('date', exportData.period_start)
      .lte('date', exportData.period_end)
      .order('date')

    // Get Revolut transactions for the period
    const { data: bankTransactions } = await supabase
      .from('revolut_transactions')
      .select('*')
      .gte('transaction_date', exportData.period_start)
      .lte('transaction_date', exportData.period_end)
      .eq('state', 'completed')
      .order('transaction_date')

    // Calculate totals
    const totalInvoices = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0
    const totalCreditNotes = creditNotes?.reduce((sum, cn) => sum + (cn.total || 0), 0) || 0
    const totalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0
    const totalTaxInvoices = invoices?.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0) || 0
    const totalTaxExpenses = expenses?.reduce((sum, exp) => sum + (exp.tax_amount || 0), 0) || 0
    const netRevenue = totalInvoices - totalCreditNotes
    const bankIncome = bankTransactions?.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0) || 0
    const bankOutflow = bankTransactions?.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0

    const logoUrl = company.logo_url || null
    const period = formatPeriod(exportData.period_start, exportData.period_end)

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${exportData.name}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9pt; color: #333; line-height: 1.4; background: #e5e7eb; }
  .page { width: 210mm; min-height: 297mm; margin: 20px auto; padding: 15mm; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  @media print {
    body { background: white; }
    .page { width: auto; min-height: auto; margin: 0; padding: 15mm; box-shadow: none; }
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #1a1a1a; }
  .company-info { font-size: 8pt; color: #666; }
  .company-info p { margin: 1px 0; }
  .company-name { font-size: 12pt; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
  .company-logo { max-height: 50px; max-width: 180px; }
  .report-title { text-align: right; }
  .report-title h1 { font-size: 16pt; font-weight: 700; color: #1a1a1a; }
  .report-title .period { font-size: 10pt; color: #666; margin-top: 2px; }
  .report-title .date { font-size: 8pt; color: #999; margin-top: 4px; }

  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
  .summary-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; }
  .summary-card .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
  .summary-card .value { font-size: 13pt; font-weight: 700; margin-top: 2px; }
  .positive { color: #16a34a; }
  .negative { color: #dc2626; }

  h2 { font-size: 11pt; font-weight: 600; color: #1a1a1a; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e0e0e0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; color: #888; text-align: left; padding: 4px 6px; border-bottom: 1px solid #e0e0e0; }
  td { font-size: 8pt; padding: 3px 6px; border-bottom: 1px solid #f0f0f0; }
  .right { text-align: right; }
  .total-row { font-weight: 600; border-top: 1px solid #ccc; }
  .total-row td { padding-top: 6px; }

  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 7pt; color: #999; display: flex; justify-content: space-between; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" alt="${company.name}" class="company-logo" />` : `<div class="company-name">${company.name || ''}</div>`}
      <div class="company-info">
        ${company.address_line1 ? `<p>${company.address_line1}</p>` : ''}
        ${company.zip_code || company.city ? `<p>${company.zip_code || ''} ${company.city || ''}, ${company.country || 'Austria'}</p>` : ''}
        ${company.vat_number ? `<p>UID: ${company.vat_number}</p>` : ''}
        ${company.tax_number ? `<p>StNr: ${company.tax_number}</p>` : ''}
        ${company.email ? `<p>${company.email}</p>` : ''}
      </div>
    </div>
    <div class="report-title">
      <h1>Accounting Report</h1>
      <div class="period">${period}</div>
      <div class="date">Generated: ${formatDate(new Date().toISOString())}</div>
    </div>
  </div>

  <!-- Summary -->
  <div class="summary">
    <div class="summary-card">
      <div class="label">Revenue (Invoices)</div>
      <div class="value positive">${formatCurrency(totalInvoices)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Credit Notes</div>
      <div class="value negative">-${formatCurrency(totalCreditNotes)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Expenses</div>
      <div class="value negative">-${formatCurrency(totalExpenses)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Net Result</div>
      <div class="value ${netRevenue - totalExpenses >= 0 ? 'positive' : 'negative'}">${formatCurrency(netRevenue - totalExpenses)}</div>
    </div>
  </div>

  <!-- Tax Summary -->
  <h2>VAT Summary</h2>
  <table>
    <tr><th>Item</th><th class="right">Net</th><th class="right">VAT</th><th class="right">Gross</th></tr>
    <tr><td>Invoices (Output VAT)</td><td class="right">${formatCurrency(totalInvoices - totalTaxInvoices)}</td><td class="right">${formatCurrency(totalTaxInvoices)}</td><td class="right">${formatCurrency(totalInvoices)}</td></tr>
    ${totalCreditNotes > 0 ? `<tr><td>Credit Notes</td><td class="right">-${formatCurrency(totalCreditNotes - (creditNotes?.reduce((s, c) => s + (c.tax_amount || 0), 0) || 0))}</td><td class="right">-${formatCurrency(creditNotes?.reduce((s, c) => s + (c.tax_amount || 0), 0) || 0)}</td><td class="right">-${formatCurrency(totalCreditNotes)}</td></tr>` : ''}
    <tr><td>Expenses (Input VAT / Vorsteuer)</td><td class="right">${formatCurrency(totalExpenses)}</td><td class="right">${formatCurrency(totalTaxExpenses)}</td><td class="right">${formatCurrency(totalExpenses + totalTaxExpenses)}</td></tr>
    <tr class="total-row"><td>VAT Payable</td><td></td><td class="right">${formatCurrency(totalTaxInvoices - totalTaxExpenses)}</td><td></td></tr>
  </table>

  <!-- Invoices -->
  <h2>Invoices (${invoices?.length || 0})</h2>
  ${(invoices && invoices.length > 0) ? `
  <table>
    <tr><th>Date</th><th>Number</th><th>Customer</th><th>Status</th><th class="right">Net</th><th class="right">VAT</th><th class="right">Total</th></tr>
    ${invoices.map((inv: any) => `
    <tr>
      <td>${formatDate(inv.issue_date)}</td>
      <td>${inv.document_number || '-'}</td>
      <td>${inv.customer?.name || '-'}</td>
      <td>${inv.status}</td>
      <td class="right">${formatCurrency(inv.subtotal || 0)}</td>
      <td class="right">${formatCurrency(inv.tax_amount || 0)}</td>
      <td class="right">${formatCurrency(inv.total || 0)}</td>
    </tr>`).join('')}
    <tr class="total-row"><td colspan="4">Total Invoices</td><td class="right">${formatCurrency(invoices.reduce((s: number, i: any) => s + (i.subtotal || 0), 0))}</td><td class="right">${formatCurrency(totalTaxInvoices)}</td><td class="right">${formatCurrency(totalInvoices)}</td></tr>
  </table>` : '<p style="color: #999; font-size: 8pt;">No invoices in this period.</p>'}

  <!-- Credit Notes -->
  ${(creditNotes && creditNotes.length > 0) ? `
  <h2>Credit Notes (${creditNotes.length})</h2>
  <table>
    <tr><th>Date</th><th>Number</th><th>Customer</th><th class="right">Total</th></tr>
    ${creditNotes.map((cn: any) => `
    <tr>
      <td>${formatDate(cn.issue_date)}</td>
      <td>${cn.document_number || '-'}</td>
      <td>${cn.customer?.name || '-'}</td>
      <td class="right">-${formatCurrency(cn.total || 0)}</td>
    </tr>`).join('')}
  </table>` : ''}

  <!-- Expenses -->
  <h2>Expenses (${expenses?.length || 0})</h2>
  ${(expenses && expenses.length > 0) ? `
  <table>
    <tr><th>Date</th><th>Merchant</th><th>Category</th><th class="right">Amount</th><th class="right">VAT</th></tr>
    ${expenses.map((exp: any) => `
    <tr>
      <td>${formatDate(exp.date)}</td>
      <td>${exp.merchant || '-'}</td>
      <td>${exp.category || '-'}</td>
      <td class="right">${formatCurrency(exp.amount || 0)}</td>
      <td class="right">${formatCurrency(exp.tax_amount || 0)}</td>
    </tr>`).join('')}
    <tr class="total-row"><td colspan="3">Total Expenses</td><td class="right">${formatCurrency(totalExpenses)}</td><td class="right">${formatCurrency(totalTaxExpenses)}</td></tr>
  </table>` : '<p style="color: #999; font-size: 8pt;">No expenses in this period.</p>'}

  <!-- Footer -->
  <div class="footer">
    <span>${company.name || ''} – ${exportData.name}</span>
    <span>${period}</span>
  </div>
</div><!-- end page 1 -->

  <!-- Bank Transactions -->
  ${(bankTransactions && bankTransactions.length > 0) ? `
<div class="page">
  <div class="header">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" alt="${company.name}" class="company-logo" />` : `<div class="company-name">${company.name || ''}</div>`}
    </div>
    <div class="report-title">
      <h1>Bank Transactions</h1>
      <div class="period">${period}</div>
    </div>
  </div>

  <div class="summary" style="grid-template-columns: repeat(3, 1fr);">
    <div class="summary-card">
      <div class="label">Income</div>
      <div class="value positive">${formatCurrency(bankIncome)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Outflow</div>
      <div class="value negative">-${formatCurrency(bankOutflow)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Net Bank Flow</div>
      <div class="value ${bankIncome - bankOutflow >= 0 ? 'positive' : 'negative'}">${formatCurrency(bankIncome - bankOutflow)}</div>
    </div>
  </div>

  <h2>Transactions (${bankTransactions.length})</h2>
  <table>
    <tr><th>Date</th><th>Counterparty</th><th>Type</th><th>Reference</th><th class="right">Amount</th></tr>
    ${bankTransactions.map((tx: any) => `
    <tr>
      <td>${formatDate(tx.transaction_date)}</td>
      <td>${tx.counterparty_name || tx.merchant_name || tx.description || '-'}</td>
      <td>${tx.type || '-'}</td>
      <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tx.reference || '-'}</td>
      <td class="right ${tx.amount >= 0 ? 'positive' : 'negative'}">${tx.amount >= 0 ? '+' : ''}${formatCurrency(tx.amount, tx.currency || 'EUR')}</td>
    </tr>`).join('')}
    <tr class="total-row">
      <td colspan="4">Net Total</td>
      <td class="right ${bankIncome - bankOutflow >= 0 ? 'positive' : 'negative'}">${formatCurrency(bankIncome - bankOutflow)}</td>
    </tr>
  </table>

  <div class="footer">
    <span>${company.name || ''} – ${exportData.name} – Bank Transactions</span>
    <span>${period}</span>
  </div>
</div><!-- end bank page -->` : ''}
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error generating accounting PDF:', error)
    return errorResponse('Failed to generate report', 500)
  }
}
