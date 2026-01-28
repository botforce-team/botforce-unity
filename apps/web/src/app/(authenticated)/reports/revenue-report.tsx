'use client'

import { useState, useTransition, useEffect } from 'react'
import { Download, TrendingUp, CreditCard, AlertCircle } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Input, Label } from '@/components/ui'
import { getRevenueReport, exportReportCSV, type RevenueReportEntry, type RevenueReportFilters } from '@/app/actions/reports'
import { formatCurrency } from '@/lib/utils'

interface RevenueReportViewProps {
  customers: { value: string; label: string }[]
  defaultFrom: string
  defaultTo: string
  defaultCustomer?: string
}

export function RevenueReportView({
  customers,
  defaultFrom,
  defaultTo,
  defaultCustomer,
}: RevenueReportViewProps) {
  const [isPending, startTransition] = useTransition()
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [customerId, setCustomerId] = useState(defaultCustomer || '')

  const [data, setData] = useState<RevenueReportEntry[]>([])
  const [totals, setTotals] = useState({
    invoiced_amount: 0,
    paid_amount: 0,
    outstanding_amount: 0,
    invoice_count: 0,
  })

  const loadReport = () => {
    startTransition(async () => {
      const filters: RevenueReportFilters = {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        customerId: customerId || undefined,
      }
      const result = await getRevenueReport(filters)
      if (!result.error) {
        setData(result.data)
        setTotals(result.totals)
      }
    })
  }

  useEffect(() => {
    loadReport()
  }, [])

  const handleExport = () => {
    startTransition(async () => {
      const filters: RevenueReportFilters = {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        customerId: customerId || undefined,
      }
      const { csv, error } = await exportReportCSV('revenue', filters)
      if (error) {
        alert(error)
        return
      }

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `revenue-report-${dateFrom}-${dateTo}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    })
  }

  const formatMonth = (month: string) => {
    const date = new Date(month + '-01')
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
  }

  const collectionRate = totals.invoiced_amount > 0
    ? ((totals.paid_amount / totals.invoiced_amount) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Select
                id="customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                options={[{ value: '', label: 'All Customers' }, ...customers]}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={loadReport} disabled={isPending}>
                {isPending ? 'Loading...' : 'Generate'}
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={isPending}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary-muted p-3">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Total Invoiced</p>
                <p className="text-2xl font-semibold">{formatCurrency(totals.invoiced_amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-success-muted p-3">
                <CreditCard className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Collected</p>
                <p className="text-2xl font-semibold text-success">{formatCurrency(totals.paid_amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-warning-muted p-3">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Outstanding</p>
                <p className="text-2xl font-semibold text-warning">{formatCurrency(totals.outstanding_amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-text-secondary">Collection Rate</p>
              <p className="text-2xl font-semibold">{collectionRate}%</p>
              <p className="text-xs text-text-muted">{totals.invoice_count} invoices</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Month</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <div className="py-12 text-center text-text-muted">
              No data for the selected filters
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Month</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Invoices</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Invoiced</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Collected</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Outstanding</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => {
                    const rate = row.invoiced_amount > 0
                      ? ((row.paid_amount / row.invoiced_amount) * 100).toFixed(0)
                      : '0'
                    return (
                      <tr key={row.month} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium text-text-primary">{formatMonth(row.month)}</td>
                        <td className="px-4 py-3 text-right text-text-secondary">
                          {row.invoice_count} ({row.paid_count} paid)
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.invoiced_amount)}</td>
                        <td className="px-4 py-3 text-right text-success">{formatCurrency(row.paid_amount)}</td>
                        <td className="px-4 py-3 text-right text-warning">{formatCurrency(row.outstanding_amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={rate === '100' ? 'text-success' : rate === '0' ? 'text-danger' : 'text-text-secondary'}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-surface">
                  <tr>
                    <td className="px-4 py-3 font-semibold">Total</td>
                    <td className="px-4 py-3 text-right font-semibold">{totals.invoice_count}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(totals.invoiced_amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-success">{formatCurrency(totals.paid_amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-warning">{formatCurrency(totals.outstanding_amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{collectionRate}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
