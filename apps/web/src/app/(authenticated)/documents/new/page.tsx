'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Receipt, Car, Clock } from 'lucide-react'
import { createDocument } from '@/app/actions/documents'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface LineItem {
  description: string
  quantity: number
  unit: string
  unit_price: number
  tax_rate: 'standard_20' | 'reduced_10' | 'zero'
  project_id?: string
  expense_id?: string
}

interface Expense {
  id: string
  date: string
  amount: number
  category: string
  description: string | null
  merchant: string | null
  project_id: string | null
}

export default function NewInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [customers, setCustomers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set())
  const [customerId, setCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentTerms, setPaymentTerms] = useState(14)
  const [lines, setLines] = useState<LineItem[]>([
    { description: '', quantity: 1, unit: 'hours', unit_price: 0, tax_rate: 'standard_20' }
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const [customersRes, projectsRes, expensesRes] = await Promise.all([
        supabase.from('customers').select('id, name, reverse_charge').order('name'),
        supabase.from('projects').select('id, name, code, hourly_rate, customer_id').eq('is_active', true).order('name'),
        // Load approved expenses that haven't been exported yet
        supabase.from('expenses')
          .select('id, date, amount, category, description, merchant, project_id')
          .eq('status', 'approved')
          .is('exported_at', null)
          .order('date', { ascending: false }),
      ])
      setCustomers(customersRes.data || [])
      setProjects(projectsRes.data || [])
      setExpenses(expensesRes.data || [])

      // Pre-select customer if passed in URL
      const preCustomerId = searchParams.get('customer')
      if (preCustomerId) {
        setCustomerId(preCustomerId)
      }

      // Pre-select project if passed in URL
      const projectId = searchParams.get('project')
      if (projectId && projectsRes.data) {
        const project = projectsRes.data.find((p: any) => p.id === projectId)
        if (project) {
          setLines([{
            description: `Services for ${project.name}`,
            quantity: 1,
            unit: 'hours',
            unit_price: project.hourly_rate || 0,
            tax_rate: 'standard_20',
            project_id: projectId,
          }])
          // Also set customer from project
          if (project.customer_id) {
            setCustomerId(project.customer_id)
          }
        }
      }
    }
    loadData()
  }, [supabase, searchParams])

  function addLine() {
    setLines([...lines, { description: '', quantity: 1, unit: 'hours', unit_price: 0, tax_rate: 'standard_20' }])
  }

  function removeLine(index: number) {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index))
    }
  }

  function updateLine(index: number, field: keyof LineItem, value: any) {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  function getLineTotal(line: LineItem) {
    return line.quantity * line.unit_price
  }

  function getTaxRate(rate: string) {
    if (rate === 'standard_20') return 0.20
    if (rate === 'reduced_10') return 0.10
    return 0
  }

  // Filter expenses based on selected customer's projects
  const selectedCustomer = customers.find(c => c.id === customerId)
  const customerProjects = projects.filter(p => p.customer_id === customerId)
  const customerProjectIds = new Set(customerProjects.map(p => p.id))
  const availableExpenses = expenses.filter(e =>
    !e.project_id || customerProjectIds.has(e.project_id)
  )

  function toggleExpense(expenseId: string) {
    const newSet = new Set(selectedExpenses)
    if (newSet.has(expenseId)) {
      newSet.delete(expenseId)
    } else {
      newSet.add(expenseId)
    }
    setSelectedExpenses(newSet)
  }

  function getCategoryIcon(category: string) {
    switch (category) {
      case 'mileage': return Car
      case 'travel_time': return Clock
      default: return Receipt
    }
  }

  function getCategoryLabel(category: string) {
    switch (category) {
      case 'mileage': return 'Kilometergeld'
      case 'travel_time': return 'Reisezeit'
      case 'reimbursement': return 'Auslagenersatz'
      default: return category
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + getLineTotal(line), 0)
  const expensesSubtotal = Array.from(selectedExpenses).reduce((sum, expId) => {
    const exp = expenses.find(e => e.id === expId)
    return sum + (exp?.amount || 0)
  }, 0)

  // For reverse charge customers, tax is 0
  const isReverseCharge = selectedCustomer?.reverse_charge === true
  const taxTotal = isReverseCharge ? 0 : lines.reduce((sum, line) => sum + getLineTotal(line) * getTaxRate(line.tax_rate), 0)
  const total = subtotal + expensesSubtotal + taxTotal

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.set('data', JSON.stringify({
      customer_id: customerId,
      document_type: 'invoice',
      notes: notes || undefined,
      payment_terms_days: paymentTerms,
      lines: lines.filter(l => l.description && l.unit_price > 0),
      expense_ids: Array.from(selectedExpenses),
    }))

    const result = await createDocument(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(`/documents/${result.data?.id}`)
    }
  }

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Documents
        </Link>
        <h1 className="text-2xl font-bold text-white">New Invoice</h1>
        <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
          Create a new invoice for a customer
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Settings */}
        <div
          className="p-6 rounded-[18px] space-y-5"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Customer *
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
                style={inputStyle}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Payment Terms (days)
              </label>
              <input
                type="number"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(parseInt(e.target.value) || 14)}
                min="1"
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div
          className="p-6 rounded-[18px]"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h3 className="text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wider mb-4">
            Line Items
          </h3>

          <div className="space-y-4">
            {lines.map((line, index) => (
              <div
                key={index}
                className="p-4 rounded-[12px] space-y-3"
                style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-[10px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
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
                    <label className="block text-[10px] text-[rgba(232,236,255,0.5)] mb-1">Qty</label>
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0.25"
                      step="0.25"
                      className="w-full px-2 py-1.5 rounded-[8px] text-[13px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[rgba(232,236,255,0.5)] mb-1">Unit</label>
                    <select
                      value={line.unit}
                      onChange={(e) => updateLine(index, 'unit', e.target.value)}
                      className="w-full px-2 py-1.5 rounded-[8px] text-[13px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    >
                      <option value="hours">hours</option>
                      <option value="pcs">pcs</option>
                      <option value="flat">flat</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[rgba(232,236,255,0.5)] mb-1">Unit Price</label>
                    <input
                      type="number"
                      value={line.unit_price}
                      onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-1.5 rounded-[8px] text-[13px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[rgba(232,236,255,0.5)] mb-1">Tax</label>
                    <select
                      value={line.tax_rate}
                      onChange={(e) => updateLine(index, 'tax_rate', e.target.value as any)}
                      className="w-full px-2 py-1.5 rounded-[8px] text-[13px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    >
                      <option value="standard_20">20%</option>
                      <option value="reduced_10">10%</option>
                      <option value="zero">0%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[rgba(232,236,255,0.5)] mb-1">Total</label>
                    <div className="px-2 py-1.5 text-[13px] font-medium text-white">
                      {formatCurrency(getLineTotal(line))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="mt-4 flex items-center gap-2 px-3 py-2 rounded-[10px] text-[13px] text-[rgba(255,255,255,0.7)] hover:text-white"
            style={{ background: 'rgba(255, 255, 255, 0.06)' }}
          >
            <Plus className="h-4 w-4" />
            Add Line
          </button>
        </div>

        {/* Expenses */}
        {customerId && availableExpenses.length > 0 && (
          <div
            className="p-6 rounded-[18px]"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <h3 className="text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wider mb-4">
              Approved Expenses
            </h3>
            <p className="text-[12px] text-[rgba(232,236,255,0.5)] mb-4">
              Select approved expenses to include in this invoice
            </p>

            <div className="space-y-2">
              {availableExpenses.map((expense) => {
                const isSelected = selectedExpenses.has(expense.id)
                const Icon = getCategoryIcon(expense.category)
                const project = projects.find(p => p.id === expense.project_id)

                return (
                  <button
                    key={expense.id}
                    type="button"
                    onClick={() => toggleExpense(expense.id)}
                    className={`w-full p-3 rounded-[12px] text-left transition-all ${
                      isSelected ? 'ring-2 ring-[#22c55e]' : ''
                    }`}
                    style={{
                      background: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                      border: isSelected ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${isSelected ? 'text-[#22c55e]' : 'text-[rgba(232,236,255,0.5)]'}`} />
                        <div>
                          <p className="text-[13px] font-medium text-white">
                            {getCategoryLabel(expense.category)}
                            {expense.merchant && ` - ${expense.merchant}`}
                          </p>
                          <p className="text-[11px] text-[rgba(232,236,255,0.5)]">
                            {new Date(expense.date).toLocaleDateString('de-AT')}
                            {project && ` • ${project.name}`}
                            {expense.description && ` • ${expense.description}`}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[14px] font-semibold ${isSelected ? 'text-[#22c55e]' : 'text-white'}`}>
                        {formatCurrency(expense.amount)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedExpenses.size > 0 && (
              <div className="mt-4 pt-3 border-t flex justify-between items-center" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                <span className="text-[13px] text-[rgba(232,236,255,0.6)]">
                  {selectedExpenses.size} expense{selectedExpenses.size !== 1 ? 's' : ''} selected
                </span>
                <span className="text-[14px] font-semibold text-[#22c55e]">
                  {formatCurrency(expensesSubtotal)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Reverse Charge Notice */}
        {isReverseCharge && (
          <div
            className="p-4 rounded-[12px]"
            style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
          >
            <p className="text-[13px] text-[#f59e0b]">
              <strong>Reverse Charge:</strong> This customer is marked for reverse charge (Steuerschuldnerschaft des Leistungsempfängers).
              VAT will not be charged on this invoice.
            </p>
          </div>
        )}

        {/* Totals */}
        <div
          className="p-6 rounded-[18px]"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="max-w-xs ml-auto space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-[rgba(232,236,255,0.6)]">Services Subtotal</span>
              <span className="text-white">{formatCurrency(subtotal)}</span>
            </div>
            {expensesSubtotal > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-[rgba(232,236,255,0.6)]">Expenses</span>
                <span className="text-white">{formatCurrency(expensesSubtotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px]">
              <span className="text-[rgba(232,236,255,0.6)]">
                {isReverseCharge ? 'Tax (Reverse Charge)' : 'Tax'}
              </span>
              <span className="text-white">{formatCurrency(taxTotal)}</span>
            </div>
            <div className="flex justify-between text-[16px] font-semibold pt-2" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <span className="text-white">Total</span>
              <span className="text-white">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div
          className="p-6 rounded-[18px]"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Additional notes for the invoice..."
            className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none resize-none"
            style={inputStyle}
          />
        </div>

        {error && (
          <div
            className="text-[13px] p-3 rounded-[10px]"
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
            disabled={loading || !customerId || lines.every(l => !l.description)}
            className="px-5 py-2.5 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#1f5bff' }}
          >
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
          <Link
            href="/documents"
            className="px-5 py-2.5 rounded-[12px] text-[13px] font-medium text-[rgba(255,255,255,0.8)]"
            style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)' }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
