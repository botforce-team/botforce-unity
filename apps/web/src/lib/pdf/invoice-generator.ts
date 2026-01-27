'use server'

import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF
    lastAutoTable: {
      finalY: number
    }
  }
}

interface AutoTableOptions {
  startY?: number
  head?: string[][]
  body?: (string | number)[][]
  theme?: 'striped' | 'grid' | 'plain'
  headStyles?: Record<string, unknown>
  bodyStyles?: Record<string, unknown>
  columnStyles?: Record<number, Record<string, unknown>>
  margin?: { left?: number; right?: number }
  tableWidth?: 'auto' | 'wrap' | number
}

export interface InvoiceData {
  // Document details
  documentNumber: string
  documentType: 'invoice' | 'credit_note'
  issueDate: string
  dueDate: string
  status: string

  // Company (seller) details
  company: {
    name: string
    legalName?: string
    vatNumber?: string
    registrationNumber?: string
    addressLine1?: string
    addressLine2?: string
    postalCode?: string
    city?: string
    country?: string
    email?: string
    phone?: string
    website?: string
  }

  // Customer (buyer) details
  customer: {
    name: string
    legalName?: string
    vatNumber?: string
    addressLine1?: string
    addressLine2?: string
    postalCode?: string
    city?: string
    country?: string
    email?: string
  }

  // Line items
  lines: Array<{
    lineNumber: number
    description: string
    quantity: number
    unit: string
    unitPrice: number
    taxRate: string
    subtotal: number
    taxAmount: number
    total: number
  }>

  // Totals
  subtotal: number
  taxAmount: number
  total: number
  currency: string

  // Tax breakdown
  taxBreakdown: Record<string, { base: number; tax: number }>

  // Notes
  notes?: string
  paymentNotes?: string

  // Reverse charge (EU B2B)
  reverseCharge?: boolean
}

function formatTaxRate(taxRate: string): string {
  switch (taxRate) {
    case 'standard_20':
      return '20%'
    case 'reduced_10':
      return '10%'
    case 'zero':
      return '0%'
    default:
      return taxRate
  }
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20

  // Colors
  const primaryColor: [number, number, number] = [102, 126, 234] // #667eea
  const textColor: [number, number, number] = [51, 51, 51]
  const grayColor: [number, number, number] = [128, 128, 128]

  // Header - Company info (left) and Document type (right)
  doc.setFontSize(24)
  doc.setTextColor(...primaryColor)
  doc.text(data.company.name, margin, 25)

  // Document type badge
  const docTypeLabel = data.documentType === 'invoice' ? 'INVOICE' : 'CREDIT NOTE'
  doc.setFontSize(14)
  doc.setTextColor(...textColor)
  doc.text(docTypeLabel, pageWidth - margin, 25, { align: 'right' })

  // Document number
  doc.setFontSize(12)
  doc.setTextColor(...grayColor)
  doc.text(data.documentNumber, pageWidth - margin, 33, { align: 'right' })

  // Company details (left side)
  let yPos = 40
  doc.setFontSize(9)
  doc.setTextColor(...grayColor)

  if (data.company.addressLine1) {
    doc.text(data.company.addressLine1, margin, yPos)
    yPos += 5
  }
  if (data.company.addressLine2) {
    doc.text(data.company.addressLine2, margin, yPos)
    yPos += 5
  }
  if (data.company.postalCode || data.company.city) {
    doc.text(`${data.company.postalCode || ''} ${data.company.city || ''}`.trim(), margin, yPos)
    yPos += 5
  }
  if (data.company.country) {
    doc.text(data.company.country, margin, yPos)
    yPos += 5
  }
  if (data.company.vatNumber) {
    doc.text(`VAT: ${data.company.vatNumber}`, margin, yPos)
    yPos += 5
  }
  if (data.company.registrationNumber) {
    doc.text(`Reg: ${data.company.registrationNumber}`, margin, yPos)
    yPos += 5
  }

  // Horizontal line
  yPos += 5
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)

  // Bill To and Invoice Details side by side
  yPos += 15

  // Bill To (left)
  doc.setFontSize(10)
  doc.setTextColor(...primaryColor)
  doc.text('BILL TO', margin, yPos)

  // Invoice Details (right)
  doc.text('DETAILS', pageWidth - margin - 60, yPos)

  yPos += 7
  doc.setFontSize(10)
  doc.setTextColor(...textColor)
  doc.setFont('helvetica', 'bold')
  doc.text(data.customer.name, margin, yPos)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...grayColor)

  // Customer details
  let custY = yPos + 5
  if (data.customer.addressLine1) {
    doc.text(data.customer.addressLine1, margin, custY)
    custY += 4
  }
  if (data.customer.postalCode || data.customer.city) {
    doc.text(`${data.customer.postalCode || ''} ${data.customer.city || ''}`.trim(), margin, custY)
    custY += 4
  }
  if (data.customer.country) {
    doc.text(data.customer.country, margin, custY)
    custY += 4
  }
  if (data.customer.vatNumber) {
    doc.text(`VAT: ${data.customer.vatNumber}`, margin, custY)
    custY += 4
  }

  // Invoice details (right)
  const detailsX = pageWidth - margin - 60
  let detailY = yPos
  doc.setFontSize(9)
  doc.setTextColor(...grayColor)

  doc.text('Issue Date:', detailsX, detailY)
  doc.setTextColor(...textColor)
  doc.text(format(new Date(data.issueDate), 'dd.MM.yyyy'), detailsX + 35, detailY)
  detailY += 5

  doc.setTextColor(...grayColor)
  doc.text('Due Date:', detailsX, detailY)
  doc.setTextColor(...textColor)
  doc.text(format(new Date(data.dueDate), 'dd.MM.yyyy'), detailsX + 35, detailY)
  detailY += 5

  doc.setTextColor(...grayColor)
  doc.text('Status:', detailsX, detailY)
  doc.setTextColor(...textColor)
  doc.text(data.status.toUpperCase(), detailsX + 35, detailY)

  // Line items table
  yPos = Math.max(custY, detailY) + 15

  const tableHeaders = [['#', 'Description', 'Qty', 'Unit', 'Unit Price', 'Tax', 'Amount']]
  const tableBody = data.lines.map((line) => [
    line.lineNumber.toString(),
    line.description,
    line.quantity.toString(),
    line.unit,
    formatCurrency(line.unitPrice, data.currency),
    formatTaxRate(line.taxRate),
    formatCurrency(line.total, data.currency),
  ])

  doc.autoTable({
    startY: yPos,
    head: tableHeaders,
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor,
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'right' },
      3: { cellWidth: 20 },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 15, halign: 'right' },
      6: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })

  // Totals section
  yPos = doc.lastAutoTable.finalY + 10
  const totalsX = pageWidth - margin - 70

  // Tax breakdown
  if (data.taxBreakdown && Object.keys(data.taxBreakdown).length > 0) {
    doc.setFontSize(9)
    doc.setTextColor(...grayColor)
    doc.text('Tax Breakdown:', margin, yPos)
    yPos += 5

    for (const [rate, amounts] of Object.entries(data.taxBreakdown)) {
      const rateLabel = formatTaxRate(rate)
      doc.text(
        `${rateLabel}: Base ${formatCurrency(amounts.base, data.currency)} | Tax ${formatCurrency(amounts.tax, data.currency)}`,
        margin + 5,
        yPos
      )
      yPos += 4
    }
    yPos += 5
  }

  // Subtotal
  doc.setFontSize(10)
  doc.setTextColor(...grayColor)
  doc.text('Subtotal:', totalsX, yPos)
  doc.setTextColor(...textColor)
  doc.text(formatCurrency(data.subtotal, data.currency), pageWidth - margin, yPos, {
    align: 'right',
  })
  yPos += 6

  // Tax
  doc.setTextColor(...grayColor)
  doc.text('Tax:', totalsX, yPos)
  doc.setTextColor(...textColor)
  doc.text(formatCurrency(data.taxAmount, data.currency), pageWidth - margin, yPos, {
    align: 'right',
  })
  yPos += 6

  // Total
  doc.setDrawColor(...primaryColor)
  doc.line(totalsX, yPos, pageWidth - margin, yPos)
  yPos += 5
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...primaryColor)
  doc.text('Total:', totalsX, yPos)
  doc.text(formatCurrency(data.total, data.currency), pageWidth - margin, yPos, { align: 'right' })

  // Reverse charge notice (EU B2B)
  if (data.reverseCharge) {
    yPos += 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(180, 83, 9) // Warning orange color
    doc.text('REVERSE CHARGE', margin, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...textColor)
    const reverseChargeNotice =
      'VAT reverse charge: The recipient of the service is liable for VAT. ' +
      'Steuerschuldnerschaft des Leistungsempfängers gem. Art. 196 Richtlinie 2006/112/EG.'
    const splitNotice = doc.splitTextToSize(reverseChargeNotice, pageWidth - 2 * margin)
    doc.text(splitNotice, margin, yPos)
    yPos += splitNotice.length * 4
  }

  // Notes section
  yPos += 15
  if (data.notes || data.paymentNotes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...grayColor)

    if (data.notes) {
      doc.text('Notes:', margin, yPos)
      yPos += 5
      doc.setTextColor(...textColor)
      const splitNotes = doc.splitTextToSize(data.notes, pageWidth - 2 * margin)
      doc.text(splitNotes, margin, yPos)
      yPos += splitNotes.length * 4 + 5
    }

    if (data.paymentNotes) {
      doc.setTextColor(...grayColor)
      doc.text('Payment Information:', margin, yPos)
      yPos += 5
      doc.setTextColor(...textColor)
      const splitPayment = doc.splitTextToSize(data.paymentNotes, pageWidth - 2 * margin)
      doc.text(splitPayment, margin, yPos)
    }
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(...grayColor)
  doc.text(
    `Generated by BOTFORCE Unity on ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  )

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
