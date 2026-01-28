'use client'

import { useState, useTransition, useEffect } from 'react'
import { Download, Clock } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Input, Label } from '@/components/ui'
import { getTimeReport, exportReportCSV, type TimeReportEntry, type TimeReportFilters } from '@/app/actions/reports'
import { formatCurrency, formatHours } from '@/lib/utils'

interface TimeReportViewProps {
  projects: { value: string; label: string }[]
  customers: { value: string; label: string }[]
  defaultFrom: string
  defaultTo: string
  defaultProject?: string
  defaultCustomer?: string
}

export function TimeReportView({
  projects,
  customers,
  defaultFrom,
  defaultTo,
  defaultProject,
  defaultCustomer,
}: TimeReportViewProps) {
  const [isPending, startTransition] = useTransition()
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [projectId, setProjectId] = useState(defaultProject || '')
  const [customerId, setCustomerId] = useState(defaultCustomer || '')

  const [data, setData] = useState<TimeReportEntry[]>([])
  const [totals, setTotals] = useState({
    total_hours: 0,
    billable_hours: 0,
    non_billable_hours: 0,
    billable_amount: 0,
  })

  const loadReport = () => {
    startTransition(async () => {
      const filters: TimeReportFilters = {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        projectId: projectId || undefined,
        customerId: customerId || undefined,
      }
      const result = await getTimeReport(filters)
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
      const filters: TimeReportFilters = {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        projectId: projectId || undefined,
        customerId: customerId || undefined,
      }
      const { csv, error } = await exportReportCSV('time', filters)
      if (error) {
        alert(error)
        return
      }

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `time-report-${dateFrom}-${dateTo}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
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
              <Label htmlFor="project">Project</Label>
              <Select
                id="project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                options={[{ value: '', label: 'All Projects' }, ...projects]}
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
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Total Hours</p>
                <p className="text-2xl font-semibold">{formatHours(totals.total_hours)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-text-secondary">Billable Hours</p>
              <p className="text-2xl font-semibold text-success">{formatHours(totals.billable_hours)}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-text-secondary">Non-Billable Hours</p>
              <p className="text-2xl font-semibold text-text-muted">{formatHours(totals.non_billable_hours)}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-text-secondary">Billable Amount</p>
              <p className="text-2xl font-semibold text-primary">{formatCurrency(totals.billable_amount)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Time by Project & Team Member</CardTitle>
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Project</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Team Member</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Total</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Billable</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Non-Billable</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-medium text-text-primary">{row.project_name}</span>
                        <span className="ml-2 text-text-muted text-sm">{row.project_code}</span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{row.customer_name}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.user_name}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatHours(row.total_hours)}h</td>
                      <td className="px-4 py-3 text-right text-success">{formatHours(row.billable_hours)}h</td>
                      <td className="px-4 py-3 text-right text-text-muted">{formatHours(row.non_billable_hours)}h</td>
                      <td className="px-4 py-3 text-right font-medium text-primary">{formatCurrency(row.billable_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-surface">
                  <tr>
                    <td className="px-4 py-3 font-semibold" colSpan={3}>Total</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatHours(totals.total_hours)}h</td>
                    <td className="px-4 py-3 text-right font-semibold text-success">{formatHours(totals.billable_hours)}h</td>
                    <td className="px-4 py-3 text-right font-semibold text-text-muted">{formatHours(totals.non_billable_hours)}h</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{formatCurrency(totals.billable_amount)}</td>
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
