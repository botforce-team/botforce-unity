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
import {
  createRecurringInvoice,
  updateRecurringInvoice,
  type CreateRecurringLineInput,
} from '@/app/actions/recurring-invoices'
import { taxRateOptions } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { RecurringInvoiceTemplate, RecurringFrequency, TaxRate } from '@/types'

interface RecurringFormProps {
  template?: RecurringInvoiceTemplate & { lines?: any[] }
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
  { value: 'months', label: 'Months' },
]

const frequencyOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const dayOfWeekOptions = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
]

export function RecurringForm({ template, customers, defaultCustomerId }: RecurringFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!template

  const [customerId, setCustomerId] = useState(template?.customer_id || defaultCustomerId || '')
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [frequency, setFrequency] = useState<RecurringFrequency>(template?.frequency || 'monthly')
  const [dayOfMonth, setDayOfMonth] = useState(template?.day_of_month?.toString() || '1')
  const [dayOfWeek, setDayOfWeek] = useState(template?.day_of_week?.toString() || '1')
  const [paymentTerms, setPaymentTerms] = useState(template?.payment_terms_days?.toString() || '14')
  const [notes, setNotes] = useState(template?.notes || '')
  const [nextIssueDate, setNextIssueDate] = useState(
    template?.next_issue_date || new Date().toISOString().split('T')[0]
  )
  const [isActive, setIsActive] = useState(template?.is_active ?? true)
  const [lines, setLines] = useState<LineItem[]>(
    template?.lines?.map((l: any) => ({
      id: crypto.randomUUID(),
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unit_price: l.unit_price,
      tax_rate: l.tax_rate,
    })) || [{ ...defaultLine, id: crypto.randomUUID() }]
  )

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

    if (!name.trim()) {
      alert('Please enter a template name')
      return
    }

    if (lines.some((line) => !line.description.trim())) {
      alert('All line items must have a description')
      return
    }

    startTransition(async () => {
      const lineInputs: CreateRecurringLineInput[] = lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
      }))

      const input = {
        customer_id: customerId,
        name: name.trim(),
        description: description || null,
        frequency,
        day_of_month: ['monthly', 'quarterly', 'yearly'].includes(frequency)
          ? parseInt(dayOfMonth, 10)
          : null,
        day_of_week: ['weekly', 'biweekly'].includes(frequency)
          ? parseInt(dayOfWeek, 10)
          : null,
        payment_terms_days: parseInt(paymentTerms, 10),
        notes: notes || null,
        is_active: isActive,
        next_issue_date: nextIssueDate || null,
        lines: lineInputs,
      }

      const result = isEditing
        ? await updateRecurringInvoice(template.id, input)
        : await createRecurringInvoice(input)

      if (result.success) {
        router.push('/documents/recurring')
      } else {
        alert(result.error || 'Failed to save template')
      }
    })
  }

  const showDayOfMonth = ['monthly', 'quarterly', 'yearly'].includes(frequency)
  const showDayOfWeek = ['weekly', 'biweekly'].includes(frequency)

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Monthly Retainer"
                  required
                />
              </div>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description of this recurring invoice..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency *</Label>
                <Select
                  id="frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                  options={frequencyOptions}
                />
              </div>
              {showDayOfMonth && (
                <div className="space-y-2">
                  <Label htmlFor="day_of_month">Day of Month</Label>
                  <Input
                    id="day_of_month"
                    type="number"
                    min="1"
                    max="28"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                  />
                </div>
              )}
              {showDayOfWeek && (
                <div className="space-y-2">
                  <Label htmlFor="day_of_week">Day of Week</Label>
                  <Select
                    id="day_of_week"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    options={dayOfWeekOptions}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="next_issue_date">Next Issue Date</Label>
                <Input
                  id="next_issue_date"
                  type="date"
                  value={nextIssueDate}
                  onChange={(e) => setNextIssueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="flex items-center gap-2 pt-7">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active (will generate invoices automatically)
                </Label>
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
            {lines.map((line) => (
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
                      placeholder="e.g., Monthly Development Retainer"
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
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="notes">Invoice Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notes to include on generated invoices..."
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
                  <span className="text-text-primary">Total per Invoice</span>
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
            {isPending
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
              ? 'Save Changes'
              : 'Create Template'}
          </Button>
        </div>
      </div>
    </form>
  )
}
