import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileText, FileMinus, Pencil, ArrowLeft, Send, CreditCard, Printer } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Breadcrumbs } from '@/components/ui'
import { getDocument } from '@/app/actions/documents'
import { formatCurrency, formatDate } from '@/lib/utils'
import { DocumentStatusActions } from './actions'
import type { DocumentStatus } from '@/types'

export const metadata: Metadata = {
  title: 'Document Details | BOTFORCE Unity',
}

interface DocumentPageProps {
  params: Promise<{ id: string }>
}

const statusStyles: Record<DocumentStatus, { variant: 'default' | 'success' | 'warning' | 'danger'; label: string }> = {
  draft: { variant: 'default', label: 'Draft' },
  issued: { variant: 'warning', label: 'Issued' },
  paid: { variant: 'success', label: 'Paid' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
}

const taxRateLabels: Record<string, string> = {
  standard_20: '20%',
  reduced_10: '10%',
  zero: '0%',
  reverse_charge: 'RC',
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params
  const document = await getDocument(id)

  if (!document) {
    notFound()
  }

  const statusConfig = statusStyles[document.status]
  const isOverdue =
    document.status === 'issued' &&
    document.due_date &&
    new Date(document.due_date) < new Date()

  const documentTypeLabel = document.document_type === 'invoice' ? 'Invoice' : 'Credit Note'

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Documents', href: '/documents' },
          { label: document.document_number || 'Draft' },
        ]}
      />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            {document.document_type === 'invoice' ? (
              <FileText className="h-8 w-8 text-primary" />
            ) : (
              <FileMinus className="h-8 w-8 text-danger" />
            )}
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">
                {document.document_number || `Draft ${documentTypeLabel}`}
              </h1>
              <p className="mt-0.5 text-text-secondary">
                {document.customer?.name}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusConfig.variant} className="px-3 py-1">
            {statusConfig.label}
          </Badge>
          {['issued', 'paid'].includes(document.status) && (
            <a
              href={`/api/documents/${document.id}/pdf?print=true`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                <Printer className="mr-2 h-4 w-4" />
                Print / PDF
              </Button>
            </a>
          )}
          {document.status === 'draft' && (
            <Link href={`/documents/${document.id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          )}
          <DocumentStatusActions document={document} />
        </div>
      </div>

      {isOverdue && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm font-medium text-danger">
            This invoice is overdue. Due date was {formatDate(document.due_date!)}.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document info */}
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-text-secondary">Type</dt>
                  <dd className="text-text-primary capitalize">{documentTypeLabel}</dd>
                </div>
                <div>
                  <dt className="text-sm text-text-secondary">Number</dt>
                  <dd className="text-text-primary">{document.document_number || 'Not issued'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-text-secondary">Issue Date</dt>
                  <dd className="text-text-primary">
                    {document.issue_date ? formatDate(document.issue_date) : 'Not issued'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-text-secondary">Due Date</dt>
                  <dd className={isOverdue ? 'text-danger font-medium' : 'text-text-primary'}>
                    {document.due_date ? formatDate(document.due_date) : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-text-secondary">Payment Terms</dt>
                  <dd className="text-text-primary">{document.payment_terms_days} days</dd>
                </div>
                {document.paid_date && (
                  <div>
                    <dt className="text-sm text-text-secondary">Paid Date</dt>
                    <dd className="text-success">{formatDate(document.paid_date)}</dd>
                  </div>
                )}
                {document.payment_reference && (
                  <div>
                    <dt className="text-sm text-text-secondary">Payment Reference</dt>
                    <dd className="text-text-primary">{document.payment_reference}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
                        Unit
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">
                        Tax
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.lines?.map((line) => (
                      <tr key={line.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-sm text-text-primary">{line.description}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-text-primary">
                          {line.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{line.unit}</td>
                        <td className="px-4 py-3 text-right text-sm text-text-primary">
                          {formatCurrency(line.unit_price, document.currency)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-text-secondary">
                          {taxRateLabels[line.tax_rate]}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-text-primary">
                          {formatCurrency(line.total, document.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {(document.notes || document.internal_notes) && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {document.notes && (
                  <div>
                    <dt className="text-sm font-medium text-text-secondary mb-1">Customer Notes</dt>
                    <dd className="text-sm text-text-primary whitespace-pre-wrap">{document.notes}</dd>
                  </div>
                )}
                {document.internal_notes && (
                  <div>
                    <dt className="text-sm font-medium text-text-secondary mb-1">Internal Notes</dt>
                    <dd className="text-sm text-text-muted whitespace-pre-wrap">{document.internal_notes}</dd>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Subtotal</span>
                <span className="text-text-primary">{formatCurrency(document.subtotal, document.currency)}</span>
              </div>
              {document.tax_breakdown && Object.entries(document.tax_breakdown).map(([rate, amount]) => (
                <div key={rate} className="flex justify-between text-sm">
                  <span className="text-text-secondary">VAT {taxRateLabels[rate]}</span>
                  <span className="text-text-primary">{formatCurrency(amount as number, document.currency)}</span>
                </div>
              ))}
              <hr className="border-border" />
              <div className="flex justify-between font-medium">
                <span className="text-text-primary">Total</span>
                <span className="text-lg text-primary">{formatCurrency(document.total, document.currency)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Customer info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              {document.customer_snapshot ? (
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-text-primary">{document.customer_snapshot.name}</p>
                  {document.customer_snapshot.legal_name && (
                    <p className="text-text-secondary">{document.customer_snapshot.legal_name}</p>
                  )}
                  {document.customer_snapshot.address_line1 && (
                    <p className="text-text-secondary">{document.customer_snapshot.address_line1}</p>
                  )}
                  {document.customer_snapshot.address_line2 && (
                    <p className="text-text-secondary">{document.customer_snapshot.address_line2}</p>
                  )}
                  {(document.customer_snapshot.postal_code || document.customer_snapshot.city) && (
                    <p className="text-text-secondary">
                      {document.customer_snapshot.postal_code} {document.customer_snapshot.city}
                    </p>
                  )}
                  {document.customer_snapshot.country && (
                    <p className="text-text-secondary">{document.customer_snapshot.country}</p>
                  )}
                  {document.customer_snapshot.vat_number && (
                    <p className="text-text-muted mt-2">VAT: {document.customer_snapshot.vat_number}</p>
                  )}
                  {document.customer_snapshot.reverse_charge && (
                    <Badge variant="warning" className="mt-2">Reverse Charge</Badge>
                  )}
                </div>
              ) : (
                <Link
                  href={`/customers/${document.customer_id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {document.customer?.name}
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
