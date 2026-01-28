import Link from 'next/link'
import { Plus, FileSpreadsheet, Download, Trash2, Calendar, CheckCircle } from 'lucide-react'
import { Button, Card, CardContent, Badge } from '@/components/ui'
import { getAccountingExports } from '@/app/actions/accounting-export'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ExportActions } from './export-actions'
import type { ExportStatus } from '@/types'

const statusStyles: Record<ExportStatus, { variant: 'default' | 'success' | 'warning' | 'danger'; label: string }> = {
  pending: { variant: 'default', label: 'Pending' },
  processing: { variant: 'warning', label: 'Processing' },
  completed: { variant: 'success', label: 'Completed' },
  failed: { variant: 'danger', label: 'Failed' },
}

export default async function AccountingExportPage() {
  const { data: exports, total } = await getAccountingExports()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Accounting Export</h1>
          <p className="mt-1 text-text-secondary">
            Export invoices and expenses for your accountant
          </p>
        </div>
        <Link href="/accounting-export/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Export
          </Button>
        </Link>
      </div>

      {exports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-text-muted" />
            <h3 className="mt-4 text-lg font-medium text-text-primary">No exports yet</h3>
            <p className="mt-2 text-text-secondary">
              Create an export to generate accounting data for a specific period.
            </p>
            <div className="mt-6">
              <Link href="/accounting-export/new">
                <Button>Create Export</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {exports.map((exp) => {
            const statusConfig = statusStyles[exp.status]
            return (
              <Card key={exp.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <FileSpreadsheet className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-text-primary">{exp.name}</h3>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(exp.period_start)} - {formatDate(exp.period_end)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-text-secondary">Documents</div>
                        <div className="font-medium text-text-primary">
                          {exp.invoice_count} invoices, {exp.credit_note_count} CN, {exp.expense_count} expenses
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-text-secondary">Net Revenue</div>
                        <div className="font-medium text-success">
                          {formatCurrency(exp.total_revenue - exp.total_expenses)}
                        </div>
                      </div>
                      <ExportActions export={exp} />
                    </div>
                  </div>

                  {exp.description && (
                    <p className="mt-3 text-sm text-text-muted pl-16">{exp.description}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
