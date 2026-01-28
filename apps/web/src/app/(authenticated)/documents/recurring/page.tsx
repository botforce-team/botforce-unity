import Link from 'next/link'
import { Plus, RefreshCw, Calendar, Pause, Play } from 'lucide-react'
import { Button, Card, CardContent, Badge } from '@/components/ui'
import { getRecurringInvoices } from '@/app/actions/recurring-invoices'
import { RecurringActions } from './actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { RecurringFrequency } from '@/types'

const frequencyLabels: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

export default async function RecurringInvoicesPage() {
  const { data: templates, total } = await getRecurringInvoices()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Recurring Invoices</h1>
          <p className="mt-1 text-text-secondary">
            {total} recurring {total === 1 ? 'template' : 'templates'}
          </p>
        </div>
        <Link href="/documents/recurring/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="mx-auto h-12 w-12 text-text-muted" />
            <h3 className="mt-4 text-lg font-medium text-text-primary">No recurring invoices</h3>
            <p className="mt-2 text-text-secondary">
              Create a template to automatically generate invoices on a schedule.
            </p>
            <div className="mt-6">
              <Link href="/documents/recurring/new">
                <Button>Create Template</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="relative">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Link
                      href={`/documents/recurring/${template.id}`}
                      className="text-lg font-medium text-text-primary hover:text-primary"
                    >
                      {template.name}
                    </Link>
                    <p className="text-sm text-text-secondary mt-0.5">
                      {template.customer?.name}
                    </p>
                  </div>
                  <Badge variant={template.is_active ? 'success' : 'default'}>
                    {template.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <RefreshCw className="h-4 w-4" />
                    <span>{frequencyLabels[template.frequency]}</span>
                  </div>
                  {template.next_issue_date && (
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Calendar className="h-4 w-4" />
                      <span>Next: {formatDate(template.next_issue_date)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-border mt-3">
                    <span className="font-medium text-text-primary">
                      {formatCurrency(template.total)}
                    </span>
                    <span className="text-text-muted"> per {template.frequency.replace('ly', '')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <Link
                    href={`/documents/recurring/${template.id}/edit`}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit
                  </Link>
                  <RecurringActions template={template} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
