import type { Document, Customer } from '@/types'

interface CompanyInfo {
  name: string
  email?: string
  phone?: string
  website?: string
  address?: string
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency,
  }).format(amount)
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function invoiceEmailTemplate(
  document: Document,
  customer: Customer,
  company: CompanyInfo,
  pdfUrl?: string
): { subject: string; html: string; text: string } {
  const isInvoice = document.document_type === 'invoice'
  const docType = isInvoice ? 'Invoice' : 'Credit Note'

  const subject = `${docType} ${document.document_number} from ${company.name}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .company-name {
      font-size: 24px;
      font-weight: 600;
      color: #2563eb;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
    }
    .document-info {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .document-info h2 {
      margin: 0 0 15px 0;
      font-size: 16px;
      color: #666;
    }
    .amount {
      font-size: 28px;
      font-weight: 700;
      color: ${isInvoice ? '#2563eb' : '#dc2626'};
    }
    .details {
      margin-top: 15px;
      font-size: 14px;
      color: #666;
    }
    .details p {
      margin: 5px 0;
    }
    .cta-button {
      display: inline-block;
      background: #2563eb;
      color: white !important;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 500;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #666;
    }
    .payment-info {
      background: #fef3c7;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .payment-info h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">${company.name}</div>
  </div>

  <div class="greeting">
    Dear ${customer.name},
  </div>

  <p>
    Please find attached ${isInvoice ? 'your invoice' : 'your credit note'} from ${company.name}.
  </p>

  <div class="document-info">
    <h2>${docType} Details</h2>
    <div class="amount">${formatCurrency(document.total, document.currency)}</div>
    <div class="details">
      <p><strong>${docType} Number:</strong> ${document.document_number}</p>
      <p><strong>Issue Date:</strong> ${formatDate(document.issue_date!)}</p>
      ${document.due_date ? `<p><strong>Due Date:</strong> ${formatDate(document.due_date)}</p>` : ''}
    </div>
  </div>

  ${isInvoice && document.due_date ? `
  <div class="payment-info">
    <h3>Payment Information</h3>
    <p>Please ensure payment is made by <strong>${formatDate(document.due_date)}</strong>.</p>
    <p>Payment terms: ${document.payment_terms_days} days</p>
  </div>
  ` : ''}

  ${pdfUrl ? `
  <a href="${pdfUrl}" class="cta-button">View ${docType}</a>
  ` : ''}

  <p>
    If you have any questions about this ${docType.toLowerCase()}, please don't hesitate to contact us.
  </p>

  <p>
    Thank you for your business!
  </p>

  <div class="footer">
    <p><strong>${company.name}</strong></p>
    ${company.email ? `<p>Email: ${company.email}</p>` : ''}
    ${company.phone ? `<p>Phone: ${company.phone}</p>` : ''}
    ${company.website ? `<p>Website: ${company.website}</p>` : ''}
    ${company.address ? `<p>${company.address}</p>` : ''}
  </div>
</body>
</html>
  `.trim()

  const text = `
${docType} ${document.document_number} from ${company.name}

Dear ${customer.name},

Please find attached ${isInvoice ? 'your invoice' : 'your credit note'} from ${company.name}.

${docType} Details:
- ${docType} Number: ${document.document_number}
- Amount: ${formatCurrency(document.total, document.currency)}
- Issue Date: ${formatDate(document.issue_date!)}
${document.due_date ? `- Due Date: ${formatDate(document.due_date)}` : ''}

${isInvoice && document.due_date ? `
Payment Information:
Please ensure payment is made by ${formatDate(document.due_date)}.
Payment terms: ${document.payment_terms_days} days
` : ''}

If you have any questions about this ${docType.toLowerCase()}, please don't hesitate to contact us.

Thank you for your business!

${company.name}
${company.email || ''}
${company.phone || ''}
  `.trim()

  return { subject, html, text }
}

export function paymentReminderTemplate(
  document: Document,
  customer: Customer,
  company: CompanyInfo,
  daysOverdue: number,
  pdfUrl?: string
): { subject: string; html: string; text: string } {
  const isOverdue = daysOverdue > 0
  const subject = isOverdue
    ? `Payment Reminder: Invoice ${document.document_number} is ${daysOverdue} days overdue`
    : `Payment Reminder: Invoice ${document.document_number} due soon`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid ${isOverdue ? '#dc2626' : '#f59e0b'};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .company-name {
      font-size: 24px;
      font-weight: 600;
      color: #2563eb;
    }
    .alert-banner {
      background: ${isOverdue ? '#fef2f2' : '#fffbeb'};
      border: 1px solid ${isOverdue ? '#fecaca' : '#fde68a'};
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      color: ${isOverdue ? '#991b1b' : '#92400e'};
    }
    .document-info {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .amount {
      font-size: 28px;
      font-weight: 700;
      color: ${isOverdue ? '#dc2626' : '#f59e0b'};
    }
    .cta-button {
      display: inline-block;
      background: #2563eb;
      color: white !important;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 500;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">${company.name}</div>
  </div>

  <p>Dear ${customer.name},</p>

  <div class="alert-banner">
    ${isOverdue
      ? `<strong>Payment Overdue:</strong> Invoice ${document.document_number} is ${daysOverdue} days past the due date.`
      : `<strong>Payment Reminder:</strong> Invoice ${document.document_number} is due on ${formatDate(document.due_date!)}.`
    }
  </div>

  <div class="document-info">
    <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #666;">Invoice Details</h2>
    <div class="amount">${formatCurrency(document.total, document.currency)}</div>
    <div style="margin-top: 15px; font-size: 14px; color: #666;">
      <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${document.document_number}</p>
      <p style="margin: 5px 0;"><strong>Issue Date:</strong> ${formatDate(document.issue_date!)}</p>
      <p style="margin: 5px 0;"><strong>Due Date:</strong> ${formatDate(document.due_date!)}</p>
    </div>
  </div>

  ${pdfUrl ? `<a href="${pdfUrl}" class="cta-button">View Invoice</a>` : ''}

  <p>
    If you have already made this payment, please disregard this reminder.
    If you have any questions or need to discuss payment arrangements, please contact us.
  </p>

  <p>Thank you for your prompt attention to this matter.</p>

  <div class="footer">
    <p><strong>${company.name}</strong></p>
    ${company.email ? `<p>Email: ${company.email}</p>` : ''}
    ${company.phone ? `<p>Phone: ${company.phone}</p>` : ''}
  </div>
</body>
</html>
  `.trim()

  const text = `
Payment Reminder: Invoice ${document.document_number}

Dear ${customer.name},

${isOverdue
  ? `This is a reminder that Invoice ${document.document_number} is ${daysOverdue} days past the due date.`
  : `This is a friendly reminder that Invoice ${document.document_number} is due on ${formatDate(document.due_date!)}.`
}

Invoice Details:
- Invoice Number: ${document.document_number}
- Amount: ${formatCurrency(document.total, document.currency)}
- Issue Date: ${formatDate(document.issue_date!)}
- Due Date: ${formatDate(document.due_date!)}

If you have already made this payment, please disregard this reminder.
If you have any questions, please contact us.

Thank you for your prompt attention to this matter.

${company.name}
${company.email || ''}
  `.trim()

  return { subject, html, text }
}
