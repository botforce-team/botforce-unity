'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Receipt, FileText, Check } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Textarea,
  Label,
  Input,
} from '@/components/ui'
import {
  createInvoiceFromEntries,
  getUnbilledTimeEntries,
  getUnbilledExpenses,
  type UnbilledTimeEntry,
  type UnbilledExpense,
} from '@/app/actions/invoicing'
import { formatCurrency, formatDate, formatHours } from '@/lib/utils'

interface InvoiceFromEntriesFormProps {
  customers: { value: string; label: string }[]
  defaultCustomerId?: string
  initialTimeEntries: UnbilledTimeEntry[]
  initialExpenses: UnbilledExpense[]
}

export function InvoiceFromEntriesForm({
  customers,
  defaultCustomerId,
  initialTimeEntries,
  initialExpenses,
}: InvoiceFromEntriesFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)

  const [customerId, setCustomerId] = useState(defaultCustomerId || '')
  const [timeEntries, setTimeEntries] = useState<UnbilledTimeEntry[]>(initialTimeEntries)
  const [expenses, setExpenses] = useState<UnbilledExpense[]>(initialExpenses)
  const [selectedTimeEntries, setSelectedTimeEntries] = useState<Set<string>>(new Set())
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set())
  const [groupBy, setGroupBy] = useState<'project' | 'entry' | 'summary'>('project')
  const [paymentTerms, setPaymentTerms] = useState('14')
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  // Load entries when customer changes
  useEffect(() => {
    if (customerId) {
      setIsLoadingEntries(true)
      Promise.all([
        getUnbilledTimeEntries(customerId),
        getUnbilledExpenses(customerId),
      ])
        .then(([te, exp]) => {
          setTimeEntries(te)
          setExpenses(exp)
          // Clear selections when customer changes
          setSelectedTimeEntries(new Set())
          setSelectedExpenses(new Set())
        })
        .finally(() => {
          setIsLoadingEntries(false)
        })
    } else {
      setTimeEntries(initialTimeEntries)
      setExpenses(initialExpenses)
    }
  }, [customerId])

  // Calculate totals
  const selectedTimeEntriesData = timeEntries.filter((e) => selectedTimeEntries.has(e.id))
  const selectedExpensesData = expenses.filter((e) => selectedExpenses.has(e.id))

  const totalHours = selectedTimeEntriesData.reduce((sum, e) => sum + e.hours, 0)
  const totalTimeValue = selectedTimeEntriesData.reduce(
    (sum, e) => sum + e.hours * (e.hourly_rate || 0),
    0
  )
  const totalExpenseValue = selectedExpensesData.reduce((sum, e) => sum + e.amount, 0)
  const totalExpenseTax = selectedExpensesData.reduce((sum, e) => sum + e.tax_amount, 0)

  // Estimate invoice total (time entries get 20% VAT by default)
  const estimatedTimeTax = totalTimeValue * 0.2
  const estimatedTotal = totalTimeValue + estimatedTimeTax + totalExpenseValue + totalExpenseTax

  const toggleTimeEntry = (id: string) => {
    const newSet = new Set(selectedTimeEntries)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedTimeEntries(newSet)
  }

  const toggleExpense = (id: string) => {
    const newSet = new Set(selectedExpenses)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedExpenses(newSet)
  }

  const selectAllTimeEntries = () => {
    if (selectedTimeEntries.size === timeEntries.length) {
      setSelectedTimeEntries(new Set())
    } else {
      setSelectedTimeEntries(new Set(timeEntries.map((e) => e.id)))
    }
  }

  const selectAllExpenses = () => {
    if (selectedExpenses.size === expenses.length) {
      setSelectedExpenses(new Set())
    } else {
      setSelectedExpenses(new Set(expenses.map((e) => e.id)))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerId) {
      alert('Please select a customer')
      return
    }

    if (selectedTimeEntries.size === 0 && selectedExpenses.size === 0) {
      alert('Please select at least one time entry or expense')
      return
    }

    startTransition(async () => {
      const result = await createInvoiceFromEntries({
        customer_id: customerId,
        time_entry_ids: Array.from(selectedTimeEntries),
        expense_ids: Array.from(selectedExpenses),
        payment_terms_days: parseInt(paymentTerms, 10),
        notes: notes || null,
        internal_notes: internalNotes || null,
        group_by: groupBy,
      })

      if (result.success && result.data) {
        router.push(`/documents/${result.data.id}`)
      } else {
        alert(result.error || 'Failed to create invoice')
      }
    })
  }

  // Group time entries by project for display
  const timeEntriesByProject = timeEntries.reduce(
    (acc, entry) => {
      const key = entry.project_id
      if (!acc[key]) {
        acc[key] = {
          projectName: entry.project_name,
          projectCode: entry.project_code,
          entries: [],
        }
      }
      acc[key].entries.push(entry)
      return acc
    },
    {} as Record<string, { projectName: string; projectCode: string; entries: UnbilledTimeEntry[] }>
  )

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* Customer Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer_id">Select Customer *</Label>
              <Select
                id="customer_id"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                options={[{ value: '', label: 'Select a customer...' }, ...customers]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Time Entries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Entries ({selectedTimeEntries.size} / {timeEntries.length} selected)
              </CardTitle>
              {timeEntries.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={selectAllTimeEntries}>
                  {selectedTimeEntries.size === timeEntries.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEntries ? (
              <p className="text-text-muted py-4 text-center">Loading...</p>
            ) : timeEntries.length === 0 ? (
              <p className="text-text-muted py-4 text-center">
                {customerId
                  ? 'No unbilled time entries for this customer'
                  : 'Select a customer to see unbilled time entries'}
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(timeEntriesByProject).map(([projectId, { projectName, projectCode, entries }]) => (
                  <div key={projectId} className="border border-border rounded-lg p-4">
                    <h4 className="font-medium text-text-primary mb-3">
                      {projectName} ({projectCode})
                    </h4>
                    <div className="space-y-2">
                      {entries.map((entry) => {
                        const isSelected = selectedTimeEntries.has(entry.id)
                        const value = entry.hours * (entry.hourly_rate || 0)
                        return (
                          <label
                            key={entry.id}
                            className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary/10 ring-1 ring-primary'
                                : 'bg-surface-hover hover:bg-surface'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleTimeEntry(entry.id)}
                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                              />
                              <div>
                                <p className="text-sm text-text-primary">
                                  {formatDate(entry.date)} - {formatHours(entry.hours)}h
                                </p>
                                <p className="text-xs text-text-muted">
                                  {entry.description || 'No description'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-text-primary">
                                {formatCurrency(value)}
                              </p>
                              <p className="text-xs text-text-muted">
                                {formatCurrency(entry.hourly_rate || 0)}/h
                              </p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Expenses ({selectedExpenses.size} / {expenses.length} selected)
              </CardTitle>
              {expenses.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={selectAllExpenses}>
                  {selectedExpenses.size === expenses.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEntries ? (
              <p className="text-text-muted py-4 text-center">Loading...</p>
            ) : expenses.length === 0 ? (
              <p className="text-text-muted py-4 text-center">
                {customerId
                  ? 'No unbilled expenses for this customer'
                  : 'Select a customer to see unbilled expenses'}
              </p>
            ) : (
              <div className="space-y-2">
                {expenses.map((expense) => {
                  const isSelected = selectedExpenses.has(expense.id)
                  return (
                    <label
                      key={expense.id}
                      className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary/10 ring-1 ring-primary'
                          : 'bg-surface-hover hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleExpense(expense.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <div>
                          <p className="text-sm text-text-primary">
                            {expense.merchant || expense.category} - {formatDate(expense.date)}
                          </p>
                          <p className="text-xs text-text-muted">
                            {expense.description || expense.category}
                            {expense.project_name && ` • ${expense.project_name}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-text-primary">
                          {formatCurrency(expense.amount + expense.tax_amount)}
                        </p>
                        <p className="text-xs text-text-muted">
                          incl. {formatCurrency(expense.tax_amount)} tax
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Options */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="group_by">Group Time Entries</Label>
                <Select
                  id="group_by"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as any)}
                  options={[
                    { value: 'project', label: 'By Project (with hours breakdown)' },
                    { value: 'summary', label: 'Summary only (one line per project)' },
                    { value: 'entry', label: 'Individual entries' },
                  ]}
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
            <div className="space-y-2">
              <Label htmlFor="notes">Customer Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes visible on the invoice..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal_notes">Internal Notes</Label>
              <Textarea
                id="internal_notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes (not shown on invoice)..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Time Entries ({selectedTimeEntries.size})</span>
                <span className="text-text-primary">{formatHours(totalHours)}h = {formatCurrency(totalTimeValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Expenses ({selectedExpenses.size})</span>
                <span className="text-text-primary">{formatCurrency(totalExpenseValue)}</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Subtotal</span>
                <span className="text-text-primary">{formatCurrency(totalTimeValue + totalExpenseValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Estimated Tax</span>
                <span className="text-text-primary">{formatCurrency(estimatedTimeTax + totalExpenseTax)}</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between font-medium">
                <span className="text-text-primary">Estimated Total</span>
                <span className="text-lg text-primary">{formatCurrency(estimatedTotal)}</span>
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
          <Button
            type="submit"
            disabled={isPending || (selectedTimeEntries.size === 0 && selectedExpenses.size === 0)}
          >
            {isPending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </div>
    </form>
  )
}
