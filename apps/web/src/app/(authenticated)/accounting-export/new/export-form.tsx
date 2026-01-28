'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, FileText, Receipt, TrendingUp } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from '@/components/ui'
import { createAccountingExport, getExportPeriodStats } from '@/app/actions/accounting-export'
import { formatCurrency } from '@/lib/utils'

export function ExportForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Get first and last day of previous month as default
  const today = new Date()
  const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)

  const [name, setName] = useState(
    `Export ${firstDayLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
  )
  const [description, setDescription] = useState('')
  const [periodStart, setPeriodStart] = useState(firstDayLastMonth.toISOString().split('T')[0])
  const [periodEnd, setPeriodEnd] = useState(lastDayLastMonth.toISOString().split('T')[0])
  const [stats, setStats] = useState({
    invoiceCount: 0,
    creditNoteCount: 0,
    expenseCount: 0,
    totalRevenue: 0,
    totalExpenses: 0,
  })
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  // Fetch stats when period changes
  useEffect(() => {
    if (periodStart && periodEnd && periodStart <= periodEnd) {
      setIsLoadingStats(true)
      getExportPeriodStats(periodStart, periodEnd)
        .then((data) => {
          setStats(data)
        })
        .finally(() => {
          setIsLoadingStats(false)
        })
    }
  }, [periodStart, periodEnd])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      alert('Please enter a name for the export')
      return
    }

    if (!periodStart || !periodEnd) {
      alert('Please select a period')
      return
    }

    if (periodStart > periodEnd) {
      alert('Start date must be before end date')
      return
    }

    startTransition(async () => {
      const result = await createAccountingExport({
        name: name.trim(),
        description: description || null,
        period_start: periodStart,
        period_end: periodEnd,
      })

      if (result.success) {
        router.push('/accounting-export')
      } else {
        alert(result.error || 'Failed to create export')
      }
    })
  }

  // Quick period selectors
  const setQuarterPeriod = (quarter: number, year: number) => {
    const startMonth = (quarter - 1) * 3
    const start = new Date(year, startMonth, 1)
    const end = new Date(year, startMonth + 3, 0)
    setPeriodStart(start.toISOString().split('T')[0])
    setPeriodEnd(end.toISOString().split('T')[0])
    setName(`Export Q${quarter} ${year}`)
  }

  const setYearPeriod = (year: number) => {
    setPeriodStart(`${year}-01-01`)
    setPeriodEnd(`${year}-12-31`)
    setName(`Export ${year}`)
  }

  const currentYear = today.getFullYear()
  const currentQuarter = Math.floor(today.getMonth() / 3) + 1

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Export Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Export Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q4 2024 Export"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Notes about this export..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick selectors */}
            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
                    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
                    setPeriodStart(lastMonth.toISOString().split('T')[0])
                    setPeriodEnd(lastDay.toISOString().split('T')[0])
                    setName(`Export ${lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
                  }}
                >
                  Last Month
                </Button>
                {currentQuarter > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuarterPeriod(currentQuarter - 1, currentYear)}
                  >
                    Q{currentQuarter - 1} {currentYear}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuarterPeriod(4, currentYear - 1)}
                >
                  Q4 {currentYear - 1}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setYearPeriod(currentYear - 1)}
                >
                  Full Year {currentYear - 1}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="period_start">Start Date *</Label>
                <Input
                  id="period_start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period_end">End Date *</Label>
                <Input
                  id="period_end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Export Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="py-8 text-center text-text-muted">Loading...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-text-primary">{stats.invoiceCount}</p>
                      <p className="text-sm text-text-secondary">Invoices</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                      <FileSpreadsheet className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-text-primary">{stats.creditNoteCount}</p>
                      <p className="text-sm text-text-secondary">Credit Notes</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10">
                      <Receipt className="h-5 w-5 text-danger" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-text-primary">{stats.expenseCount}</p>
                      <p className="text-sm text-text-secondary">Expenses</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${stats.totalRevenue - stats.totalExpenses >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(stats.totalRevenue - stats.totalExpenses)}
                      </p>
                      <p className="text-sm text-text-secondary">Net Total</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total Revenue:</span>
                <span className="text-success font-medium">{formatCurrency(stats.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-text-secondary">Total Expenses:</span>
                <span className="text-danger font-medium">{formatCurrency(stats.totalExpenses)}</span>
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
            {isPending ? 'Creating...' : 'Create Export'}
          </Button>
        </div>
      </div>
    </form>
  )
}
