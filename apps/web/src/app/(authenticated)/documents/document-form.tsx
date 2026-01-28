'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui'
import { createDocument, type CreateDocumentLineInput } from '@/app/actions/documents'
import { taxRateOptions } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { DocumentType, TaxRate } from '@/types'

interface DocumentFormProps {
  documentType: DocumentType
  customers: { value: string; label: string }[]
  defaultCustomerId?: string
}

interface LineItem {
  id: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  tax_rate: TaxRate
}

const defaultLine: Omit<LineItem, 'id'> = {
  description: '',
  quantity: 1,
  unit: 'hours',
  unit_price: 0,
  tax_rate: 'standard_20',
}

const unitOptions = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'flat', label: 'Flat Rate' },
  { value: 'km', label: 'Kilometers' },
]

export function DocumentForm({ documentType, customers, defaultCustomerId }: DocumentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [customerId, setCustomerId] = useState(defaultCustomerId || '')
  const [paymentTerms, setPaymentTerms] = useState('14')
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([
    { ...defaultLine, id: crypto.randomUUID() },
  ])

  const addLine = () => {
    setLines([...lines, { ...defaultLine, id: crypto.randomUUID() }])
  }

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((line) => line.id !== id))
    }
  }

  const updateLine = (id: string, field: keyof LineItem, value: string | number) => {
    setLines(
      lines.map((line) =>
        line.id === id ? { ...line, [field]: value } : line
      )
    )
  }

  // Calculate totals
  const taxRates: Record<TaxRate, number> = {
    standard_20: 0.20,
    reduced_10: 0.10,
    zero: 0,
    reverse_charge: 0,
  }

  const calculateLineTotal = (line: LineItem) => {
    const subtotal = line.quantity * line.unit_price
    const tax = subtotal * taxRates[line.tax_rate]
    return { subtotal, tax, total: subtotal + tax }
  }

  const totals = lines.reduce(
    (acc, line) => {
      const lineCalc = calculateLineTotal(line)
      return {
        subtotal: acc.subtotal + lineCalc.subtotal,
        tax: acc.tax + lineCalc.tax,
        total: acc.total + lineCalc.total,
      }
    },
    { subtotal: 0, tax: 0, total: 0 }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerId) {
      alert('Please select a customer')
      return
    }

    if (lines.some((line) => !line.description.trim())) {
      alert('All line items must have a description')
      return
    }

    startTransition(async () => {
      const lineInputs: CreateDocumentLineInput[] = lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
      }))

      const result = await createDocument({
        customer_id: customerId,
        document_type: documentType,
        payment_terms_days: parseInt(paymentTerms, 10),
        notes: notes || null,
        internal_notes: internalNotes || null,
        lines: lineInputs,
      })

      if (result.success && result.data) {
        router.push(`/documents/${result.data.id}`)
      } else {
        alert(result.error || 'Failed to create document')
      }
    })
  }

  const documentTypeLabel = documentType === 'invoice' ? 'Invoice' : 'Credit Note'

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer & Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer_id">Customer *</Label>
                <Select
                  id="customer_id"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  options={[{ value: '', label: 'Select a customer...' }, ...customers]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms (days)</Label>
                <Input
                  id="payment_terms"
                  type="number"
                  min="0"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-4 w-4" />
                Add Line
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lines.map((line, index) => (
              <div
                key={line.id}
                className="rounded-lg border border-border p-4 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`desc-${line.id}`}>Description *</Label>
                    <Input
                      id={`desc-${line.id}`}
                      value={line.description}
                      onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                      placeholder="e.g., Software Development Services"
                      required
                    />
                  </div>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(line.id)}
                      className="text-danger hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-5">
                  <div className="space-y-2">
                    <Label htmlFor={`qty-${line.id}`}>Quantity</Label>
                    <Input
                      id={`qty-${line.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`unit-${line.id}`}>Unit</Label>
                    <Select
                      id={`unit-${line.id}`}
                      value={line.unit}
                      onChange={(e) => updateLine(line.id, 'unit', e.target.value)}
                      options={unitOptions}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`price-${line.id}`}>Unit Price</Label>
                    <Input
                      id={`price-${line.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.unit_price}
                      onChange={(e) => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`tax-${line.id}`}>Tax Rate</Label>
                    <Select
                      id={`tax-${line.id}`}
                      value={line.tax_rate}
                      onChange={(e) => updateLine(line.id, 'tax_rate', e.target.value as TaxRate)}
                      options={taxRateOptions}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Line Total</Label>
                    <div className="flex h-9 items-center rounded-md bg-surface-hover px-3 text-sm font-medium text-text-primary">
                      {formatCurrency(calculateLineTotal(line).total)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Customer Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notes visible to the customer..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal_notes">Internal Notes</Label>
              <Textarea
                id="internal_notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes (not shown on document)..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Subtotal</span>
                  <span className="text-text-primary">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Tax</span>
                  <span className="text-text-primary">{formatCurrency(totals.tax)}</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between font-medium">
                  <span className="text-text-primary">Total</span>
                  <span className="text-lg text-primary">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : `Create ${documentTypeLabel}`}
          </Button>
        </div>
      </div>
    </form>
  )
}
