import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateInvoicePDF, type InvoiceData } from './invoice-generator'

// Mock jsPDF
vi.mock('jspdf', () => {
  const mockDoc = {
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    autoTable: vi.fn(),
    lastAutoTable: { finalY: 150 },
    splitTextToSize: vi.fn((text: string) => [text]),
    output: vi.fn(() => new ArrayBuffer(100)),
  }

  return {
    default: vi.fn(() => mockDoc),
  }
})

vi.mock('jspdf-autotable', () => ({}))

const createMockInvoiceData = (overrides: Partial<InvoiceData> = {}): InvoiceData => ({
  documentNumber: 'INV-2026-00001',
  documentType: 'invoice',
  issueDate: '2026-01-15',
  dueDate: '2026-02-15',
  status: 'issued',
  company: {
    name: 'BOTFORCE GmbH',
    legalName: 'BOTFORCE GmbH',
    vatNumber: 'ATU12345678',
    registrationNumber: 'FN 123456a',
    addressLine1: 'Hauptstrasse 1',
    postalCode: '1010',
    city: 'Vienna',
    country: 'Austria',
    email: 'office@botforce.at',
  },
  customer: {
    name: 'Acme Corp',
    legalName: 'Acme Corporation GmbH',
    vatNumber: 'ATU87654321',
    addressLine1: 'Testgasse 42',
    postalCode: '1020',
    city: 'Vienna',
    country: 'Austria',
    email: 'billing@acme.at',
  },
  lines: [
    {
      lineNumber: 1,
      description: 'Software Development Services',
      quantity: 40,
      unit: 'hours',
      unitPrice: 120,
      taxRate: 'standard_20',
      subtotal: 4800,
      taxAmount: 960,
      total: 5760,
    },
  ],
  subtotal: 4800,
  taxAmount: 960,
  total: 5760,
  currency: 'EUR',
  taxBreakdown: {
    standard_20: { base: 4800, tax: 960 },
  },
  ...overrides,
})

describe('generateInvoicePDF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates a PDF buffer', async () => {
    const data = createMockInvoiceData()
    const result = await generateInvoicePDF(data)

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles invoice document type', async () => {
    const data = createMockInvoiceData({ documentType: 'invoice' })
    const result = await generateInvoicePDF(data)

    expect(result).toBeInstanceOf(Buffer)
  })

  it('handles credit note document type', async () => {
    const data = createMockInvoiceData({ documentType: 'credit_note' })
    const result = await generateInvoicePDF(data)

    expect(result).toBeInstanceOf(Buffer)
  })

  it('handles multiple line items', async () => {
    const data = createMockInvoiceData({
      lines: [
        {
          lineNumber: 1,
          description: 'Development',
          quantity: 20,
          unit: 'hours',
          unitPrice: 100,
          taxRate: 'standard_20',
          subtotal: 2000,
          taxAmount: 400,
          total: 2400,
        },
        {
          lineNumber: 2,
          description: 'Consulting',
          quantity: 10,
          unit: 'hours',
          unitPrice: 150,
          taxRate: 'standard_20',
          subtotal: 1500,
          taxAmount: 300,
          total: 1800,
        },
        {
          lineNumber: 3,
          description: 'Support',
          quantity: 5,
          unit: 'hours',
          unitPrice: 80,
          taxRate: 'reduced_10',
          subtotal: 400,
          taxAmount: 40,
          total: 440,
        },
      ],
    })

    const result = await generateInvoicePDF(data)
    expect(result).toBeInstanceOf(Buffer)
  })

  it('handles different tax rates', async () => {
    const data = createMockInvoiceData({
      taxBreakdown: {
        standard_20: { base: 1000, tax: 200 },
        reduced_10: { base: 500, tax: 50 },
        zero: { base: 200, tax: 0 },
      },
    })

    const result = await generateInvoicePDF(data)
    expect(result).toBeInstanceOf(Buffer)
  })

  it('handles notes and payment notes', async () => {
    const data = createMockInvoiceData({
      notes: 'Thank you for your business!',
      paymentNotes: 'Please transfer to IBAN: AT12 3456 7890 1234 5678',
    })

    const result = await generateInvoicePDF(data)
    expect(result).toBeInstanceOf(Buffer)
  })

  it('handles minimal company data', async () => {
    const data = createMockInvoiceData({
      company: {
        name: 'Simple Company',
      },
    })

    const result = await generateInvoicePDF(data)
    expect(result).toBeInstanceOf(Buffer)
  })

  it('handles minimal customer data', async () => {
    const data = createMockInvoiceData({
      customer: {
        name: 'Simple Customer',
      },
    })

    const result = await generateInvoicePDF(data)
    expect(result).toBeInstanceOf(Buffer)
  })

  it('handles different currencies', async () => {
    const data = createMockInvoiceData({
      currency: 'USD',
    })

    const result = await generateInvoicePDF(data)
    expect(result).toBeInstanceOf(Buffer)
  })

  it('handles empty tax breakdown', async () => {
    const data = createMockInvoiceData({
      taxBreakdown: {},
    })

    const result = await generateInvoicePDF(data)
    expect(result).toBeInstanceOf(Buffer)
  })
})
