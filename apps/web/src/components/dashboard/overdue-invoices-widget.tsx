'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui'

interface OverdueInvoice {
  id: string
  document_number: string
  total: number
  due_date: string
  customer: { name: string } | null
}

interface OverdueInvoicesWidgetProps {
  invoices: OverdueInvoice[]
}

export function OverdueInvoicesWidget({ invoices }: OverdueInvoicesWidgetProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount)

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit' }).format(new Date(date))

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate)
    const today = new Date()
    const diffTime = today.getTime() - due.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (invoices.length === 0) {
    return null
  }

  const totalOverdue = invoices.reduce((sum, inv) => sum + inv.total, 0)

  return (
    <Card className="border-danger/30">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <CardTitle>Overdue Invoices</CardTitle>
        </div>
        <Badge variant="danger">{invoices.length}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-secondary mb-4">
          Total overdue: <span className="font-semibold text-danger">{formatCurrency(totalOverdue)}</span>
        </p>
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const daysOverdue = getDaysOverdue(invoice.due_date)
            return (
              <Link
                key={invoice.id}
                href={`/documents/${invoice.id}`}
                className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-surface-hover transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{invoice.document_number}</p>
                  <p className="text-xs text-text-muted">
                    {invoice.customer?.name || 'Unknown customer'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm text-danger">{formatCurrency(invoice.total)}</p>
                  <p className="text-xs text-danger">
                    {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
        <Link href="/documents?status=issued" className="mt-4 block">
          <Button variant="outline" size="sm" className="w-full">
            View All Outstanding
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
