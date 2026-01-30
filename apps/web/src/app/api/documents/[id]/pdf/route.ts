import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notFoundResponse, badRequestResponse, errorResponse } from '@/lib/api-utils'
import { logError } from '@/lib/errors'

const taxRateLabels: Record<string, string> = {
  standard_20: '20%',
  reduced_10: '10%',
  zero: '0%',
  reverse_charge: 'RC',
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params

    // Validate UUID format
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return badRequestResponse('Invalid document ID')
    }

    const supabase = await createClient()

    // Fetch document with customer and lines
    const { data: document, error } = await supabase
      .from('documents')
      .select('*, customer:customers(*), lines:document_lines(*)')
      .eq('id', id)
      .single()

    if (error || !document) {
      return notFoundResponse('Document')
    }

    // Only allow issued or paid documents to be printed
    if (!['issued', 'paid'].includes(document.status)) {
      return badRequestResponse('Document must be issued before viewing/printing')
    }

  const company = document.company_snapshot || {}
  const customer = document.customer_snapshot || document.customer || {}
  const lines = document.lines || []
  const isInvoice = document.document_type === 'invoice'
  const docTypeLabel = isInvoice ? 'Invoice' : 'Credit Note'
  const logoUrl = company.logo_url || null

  // Generate HTML
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTypeLabel} ${document.document_number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
      padding: 40px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .company-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      line-height: 1.3;
    }
    .company-logo {
      max-height: 50px;
      max-width: 180px;
      object-fit: contain;
      margin-bottom: 6px;
    }
    .company-info p {
      color: #666;
      margin: 0;
      font-size: 11px;
    }
    .document-info {
      text-align: right;
    }
    .document-type {
      font-size: 28px;
      font-weight: 700;
      color: ${isInvoice ? '#2563eb' : '#dc2626'};
      margin-bottom: 8px;
    }
    .document-number {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 16px;
    }
    .document-meta {
      font-size: 11px;
      color: #666;
    }
    .document-meta strong {
      color: #1a1a1a;
    }
    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 24px;
      padding: 12px 16px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .address-block h3 {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666;
      margin-bottom: 4px;
    }
    .address-block p {
      margin: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .address-block .name {
      font-weight: 600;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th {
      background: #f3f4f6;
      padding: 6px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e5e7eb;
    }
    th.right {
      text-align: right;
    }
    td {
      padding: 5px 8px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
      font-size: 11px;
    }
    td.right {
      text-align: right;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .description {
      font-weight: 500;
    }
    .totals {
      margin-left: auto;
      width: 280px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 11px;
    }
    .totals-row.total {
      border-bottom: none;
      padding-top: 8px;
      font-size: 14px;
      font-weight: 700;
    }
    .totals-row.total .amount {
      color: ${isInvoice ? '#2563eb' : '#dc2626'};
    }
    .payment-info {
      margin-top: 20px;
      padding: 12px 16px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .payment-info h3 {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .payment-info p {
      margin: 0;
      font-size: 11px;
      line-height: 1.5;
    }
    .notes {
      margin-top: 16px;
      padding: 10px 14px;
      background: #fef3c7;
      border-radius: 6px;
      font-size: 10px;
    }
    .notes h4 {
      font-weight: 600;
      margin-bottom: 4px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 9px;
      color: #666;
    }
    .reverse-charge {
      margin-top: 20px;
      padding: 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      font-size: 11px;
      color: #991b1b;
    }
    @media print {
      body {
        padding: 20px;
      }
      .container {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        ${logoUrl ? `<img src="${logoUrl}" alt="${company.name || 'Company'}" class="company-logo" />` : `<p style="font-weight: 600; font-size: 14px; color: #1a1a1a;">${company.name || 'Company Name'}</p>`}
        ${company.address_line1 ? `<p>${company.address_line1}</p>` : ''}
        ${company.postal_code || company.city ? `<p>${company.postal_code || ''} ${company.city || ''}</p>` : ''}
        ${company.vat_number ? `<p>VAT: ${company.vat_number}</p>` : ''}
      </div>
      <div class="document-info">
        <div class="document-type">${docTypeLabel}</div>
        <div class="document-number">${document.document_number}</div>
        <div class="document-meta">
          <p><strong>Issue Date:</strong> ${formatDate(document.issue_date)}</p>
          ${document.due_date ? `<p><strong>Due Date:</strong> ${formatDate(document.due_date)}</p>` : ''}
          ${document.paid_date ? `<p><strong>Paid:</strong> ${formatDate(document.paid_date)}</p>` : ''}
        </div>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <h3>Bill To</h3>
        <p class="name">${customer.name || 'Customer Name'}</p>
        ${customer.legal_name && customer.legal_name !== customer.name ? `<p>${customer.legal_name}</p>` : ''}
        ${customer.address_line1 ? `<p>${customer.address_line1}</p>` : ''}
        ${customer.address_line2 ? `<p>${customer.address_line2}</p>` : ''}
        ${customer.postal_code || customer.city ? `<p>${customer.postal_code || ''} ${customer.city || ''}</p>` : ''}
        ${customer.country ? `<p>${customer.country}</p>` : ''}
        ${customer.vat_number ? `<p>VAT: ${customer.vat_number}</p>` : ''}
      </div>
      <div class="address-block" style="text-align: right;">
        <h3>From</h3>
        ${company.email ? `<p>${company.email}</p>` : ''}
        ${company.phone ? `<p>${company.phone}</p>` : ''}
        ${company.website ? `<p>${company.website}</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50%">Description</th>
          <th class="right">Qty</th>
          <th>Unit</th>
          <th class="right">Price</th>
          <th class="right">Tax</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map((line: any) => `
          <tr>
            <td class="description">${line.description}</td>
            <td class="right">${line.quantity}</td>
            <td>${line.unit}</td>
            <td class="right">${formatCurrency(line.unit_price, document.currency)}</td>
            <td class="right">${taxRateLabels[line.tax_rate] || line.tax_rate}</td>
            <td class="right">${formatCurrency(line.total, document.currency)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${formatCurrency(document.subtotal, document.currency)}</span>
      </div>
      ${document.tax_breakdown ? Object.entries(document.tax_breakdown).map(([rate, amount]: [string, any]) => `
        <div class="totals-row">
          <span>VAT ${taxRateLabels[rate] || rate}</span>
          <span>${formatCurrency(amount, document.currency)}</span>
        </div>
      `).join('') : `
        <div class="totals-row">
          <span>Tax</span>
          <span>${formatCurrency(document.tax_amount, document.currency)}</span>
        </div>
      `}
      <div class="totals-row total">
        <span>Total</span>
        <span class="amount">${formatCurrency(document.total, document.currency)}</span>
      </div>
    </div>

    ${customer.reverse_charge ? `
      <div class="reverse-charge">
        <strong>Reverse Charge:</strong> VAT to be accounted for by the recipient as per Article 196 of Council Directive 2006/112/EC.
      </div>
    ` : ''}

    ${document.notes ? `
      <div class="notes">
        <h4>Notes</h4>
        <p>${document.notes}</p>
      </div>
    ` : ''}

    <div class="payment-info">
      <h3>Payment Information</h3>
      <p><strong>Payment Terms:</strong> ${document.payment_terms_days} days</p>
      ${document.due_date ? `<p><strong>Please pay by:</strong> ${formatDate(document.due_date)}</p>` : ''}
      ${document.payment_reference ? `<p><strong>Reference:</strong> ${document.payment_reference}</p>` : ''}
    </div>

    <div class="footer">
      ${company.bank_name || company.bank_iban ? `
        <div style="margin-bottom: 8px;">
          ${company.bank_name ? `<span><strong>Bank:</strong> ${company.bank_name}</span>` : ''}
          ${company.bank_iban ? `<span style="margin-left: 16px;"><strong>IBAN:</strong> ${company.bank_iban}</span>` : ''}
          ${company.bank_bic ? `<span style="margin-left: 16px;"><strong>BIC:</strong> ${company.bank_bic}</span>` : ''}
        </div>
      ` : ''}
      ${company.registration_number ? `<p>Company Registration: ${company.registration_number}</p>` : ''}
    </div>
  </div>

  <script>
    // Auto-print if opened for printing
    if (window.location.search.includes('print=true')) {
      window.onload = function() {
        window.print();
      }
    }
  </script>
</body>
</html>
  `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    logError(error, { route: 'api/documents/[id]/pdf' })
    return errorResponse('Failed to generate document', 500, 'PDF_GENERATION_ERROR')
  }
}
