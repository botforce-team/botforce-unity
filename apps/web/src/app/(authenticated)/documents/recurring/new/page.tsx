'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { createRecurringTemplate } from '@/app/actions/recurring-invoices'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface LineItem {
  description: string
  quantity: number
  unit: string
  unit_price: number
  tax_rate: 'standard_20' | 'reduced_10' | 'zero'
  project_id?: string
}

interface Customer {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
  code: string | null
  hourly_rate: number | null
  customer_id: string | null
}

type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export default function NewRecurringInvoicePage() {
  const router = useRouter()
  const supabase = createClient()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentTerms, setPaymentTerms] = useState(14)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([
    { description: '', quantity: 1, unit: 'hours', unit_price: 0, tax_rate: 'standard_20' },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const [customersRes, projectsRes] = await Promise.all([
        supabase.from('customers').select('id, name').order('name'),
        supabase
          .from('projects')
          .select('id, name, code, hourly_rate, customer_id')
          .eq('is_active', true)
          .order('name'),
      ])
      setCustomers((customersRes.data || []) as Customer[])
      setProjects((projectsRes.data || []) as Project[])
    }
    loadData()
  }, [supabase])

  function addLine() {
    setLines([
      ...lines,
      { description: '', quantity: 1, unit: 'hours', unit_price: 0, tax_rate: 'standard_20' },
    ])
  }

  function removeLine(index: number) {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index))
    }
  }

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  function getLineTotal(line: LineItem) {
    return line.quantity * line.unit_price
  }

  function getTaxRate(rate: string) {
    if (rate === 'standard_20') return 0.2
    if (rate === 'reduced_10') return 0.1
    return 0
  }

  const subtotal = lines.reduce((sum, line) => sum + getLineTotal(line), 0)
  const taxTotal = lines.reduce(
    (sum, line) => sum + getLineTotal(line) * getTaxRate(line.tax_rate),
    0
  )
  const total = subtotal + taxTotal

  const customerProjects = projects.filter((p) => p.customer_id === customerId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.set(
      'data',
      JSON.stringify({
        customer_id: customerId,
        name,
        description: description || undefined,
        frequency,
        day_of_month: ['monthly', 'quarterly', 'yearly'].includes(frequency)
          ? dayOfMonth
          : undefined,
        day_of_week: ['weekly', 'biweekly'].includes(frequency) ? dayOfWeek : undefined,
        payment_terms_days: paymentTerms,
        notes: notes || undefined,
        start_date: startDate,
        lines: lines.filter((l) => l.description && l.unit_price > 0),
      })
    )

    const result = await createRecurringTemplate(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/documents/recurring')
    }
  }

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/documents/recurring"
          className="mb-4 inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Recurring Invoices
        </Link>
        <h1 className="text-2xl font-bold text-white">New Recurring Invoice Template</h1>
        <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
          Set up automatic invoice generation on a schedule
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Info */}
        <div
          className="space-y-5 rounded-[18px] p-6"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
            Template Information
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                Template Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Monthly Retainer - Acme Corp"
                className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                Customer *
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] focus:outline-none"
                style={inputStyle}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Internal description for this template"
              className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Schedule */}
        <div
          className="space-y-5 rounded-[18px] p-6"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
            Schedule
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                Frequency *
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] focus:outline-none"
                style={inputStyle}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {['weekly', 'biweekly'].includes(frequency) && (
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                  Day of Week
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                  className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] focus:outline-none"
                  style={inputStyle}
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>
            )}

            {['monthly', 'quarterly', 'yearly'].includes(frequency) && (
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                  Day of Month
                </label>
                <select
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                  className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] focus:outline-none"
                  style={inputStyle}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
                Payment Terms (days)
              </label>
              <input
                type="number"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(parseInt(e.target.value) || 14)}
                min="1"
                className="w-full rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div
          className="rounded-[18px] p-6"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[rgba(232,236,255,0.68)]">
            Line Items
          </h3>

          <div className="space-y-4">
            {lines.map((line, index) => (
              <div
                key={index}
                className="space-y-3 rounded-[12px] p-4"
                style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      required
                      className="w-full rounded-[10px] px-3 py-2 text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="p-2 text-[rgba(239,68,68,0.8)] hover:text-[#ef4444]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] text-[rgba(232,236,255,0.5)]">
                      Qty
                    </label>
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(index, 'quantity', parseFloat(e.target.value) || 0)
                      }
                      min="0.25"
                      step="0.25"
                      className="w-full rounded-[8px] px-2 py-1.5 text-[13px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-[rgba(232,236,255,0.5)]">
                      Unit
                    </label>
                    <select
                      value={line.unit}
                      onChange={(e) => updateLine(index, 'unit', e.target.value)}
                      className="w-full rounded-[8px] px-2 py-1.5 text-[13px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    >
                      <option value="hours">hours</option>
                      <option value="pcs">pcs</option>
                      <option value="flat">flat</option>
                      <option value="month">month</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-[rgba(232,236,255,0.5)]">
                      Unit Price
                    </label>
                    <input
                      type="number"
                      value={line.unit_price}
                      onChange={(e) =>
                        updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)
                      }
                      min="0"
                      step="0.01"
                      className="w-full rounded-[8px] px-2 py-1.5 text-[13px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-[rgba(232,236,255,0.5)]">
                      Tax
                    </label>
                    <select
                      value={line.tax_rate}
                      onChange={(e) =>
                        updateLine(
                          index,
                          'tax_rate',
                          e.target.value as 'standard_20' | 'reduced_10' | 'zero'
                        )
                      }
                      className="w-full rounded-[8px] px-2 py-1.5 text-[13px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    >
                      <option value="standard_20">20%</option>
                      <option value="reduced_10">10%</option>
                      <option value="zero">0%</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-[rgba(232,236,255,0.5)]">
                      Total
                    </label>
                    <div className="px-2 py-1.5 text-[13px] font-medium text-white">
                      {formatCurrency(getLineTotal(line))}
                    </div>
                  </div>
                </div>

                {customerId && customerProjects.length > 0 && (
                  <div>
                    <label className="mb-1 block text-[10px] text-[rgba(232,236,255,0.5)]">
                      Project (optional)
                    </label>
                    <select
                      value={line.project_id || ''}
                      onChange={(e) => updateLine(index, 'project_id', e.target.value)}
                      className="w-full rounded-[8px] px-2 py-1.5 text-[13px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    >
                      <option value="">No project</option>
                      {customerProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.code && `(${p.code})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="mt-4 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] text-[rgba(255,255,255,0.7)] hover:text-white"
            style={{ background: 'rgba(255, 255, 255, 0.06)' }}
          >
            <Plus className="h-4 w-4" />
            Add Line
          </button>
        </div>

        {/* Totals */}
        <div
          className="rounded-[18px] p-6"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="ml-auto max-w-xs space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-[rgba(232,236,255,0.6)]">Subtotal</span>
              <span className="text-white">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[rgba(232,236,255,0.6)]">Tax</span>
              <span className="text-white">{formatCurrency(taxTotal)}</span>
            </div>
            <div
              className="flex justify-between pt-2 text-[16px] font-semibold"
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}
            >
              <span className="text-white">Total per Invoice</span>
              <span className="text-white">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div
          className="rounded-[18px] p-6"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
            Invoice Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes to include on generated invoices..."
            className="w-full resize-none rounded-[12px] px-3 py-2.5 text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
            style={inputStyle}
          />
        </div>

        {error && (
          <div
            className="rounded-[10px] p-3 text-[13px]"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !customerId || !name || lines.every((l) => !l.description)}
            className="rounded-[12px] px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#1f5bff' }}
          >
            {loading ? 'Creating...' : 'Create Template'}
          </button>
          <Link
            href="/documents/recurring"
            className="rounded-[12px] px-5 py-2.5 text-[13px] font-medium text-[rgba(255,255,255,0.8)]"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
