import Link from 'next/link'
import { Plus, FileText, FileMinus, Clock } from 'lucide-react'
import { Button, Card, CardContent, Badge, Pagination } from '@/components/ui'
import { getDocuments, type DocumentsFilter } from '@/app/actions/documents'
import { DocumentActions } from './document-actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { DocumentStatus, DocumentType } from '@/types'

interface DocumentsPageProps {
  searchParams: Promise<{
    page?: string
    type?: DocumentType
    status?: DocumentStatus
    customer?: string
  }>
}

const statusStyles: Record<DocumentStatus, { variant: 'default' | 'success' | 'warning' | 'danger'; label: string }> = {
  draft: { variant: 'default', label: 'Draft' },
  issued: { variant: 'warning', label: 'Issued' },
  paid: { variant: 'success', label: 'Paid' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)

  const filter: DocumentsFilter = {
    page,
    limit: 20,
    documentType: params.type,
    status: params.status,
    customerId: params.customer,
  }

  const { data: documents, total, totalPages } = await getDocuments(filter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Documents</h1>
          <p className="mt-1 text-text-secondary">
            {total} {total === 1 ? 'document' : 'documents'} total
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/documents/new-from-entries">
            <Button>
              <Clock className="mr-2 h-4 w-4" />
              Invoice from Time
            </Button>
          </Link>
          <Link href="/documents/new?type=invoice">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Manual Invoice
            </Button>
          </Link>
          <Link href="/documents/new?type=credit_note">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Credit Note
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex gap-2">
              <Link
                href="/documents"
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  !params.type && !params.status
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                All
              </Link>
              <Link
                href="/documents?type=invoice"
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  params.type === 'invoice'
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                Invoices
              </Link>
              <Link
                href="/documents?type=credit_note"
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  params.type === 'credit_note'
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                Credit Notes
              </Link>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex gap-2">
              <Link
                href={params.type ? `/documents?type=${params.type}&status=draft` : '/documents?status=draft'}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  params.status === 'draft'
                    ? 'bg-surface-hover ring-1 ring-border text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                Draft
              </Link>
              <Link
                href={params.type ? `/documents?type=${params.type}&status=issued` : '/documents?status=issued'}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  params.status === 'issued'
                    ? 'bg-warning/10 text-warning ring-1 ring-warning/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                Unpaid
              </Link>
              <Link
                href={params.type ? `/documents?type=${params.type}&status=paid` : '/documents?status=paid'}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  params.status === 'paid'
                    ? 'bg-success/10 text-success ring-1 ring-success/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                Paid
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents list */}
      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-text-muted" />
            <h3 className="mt-4 text-lg font-medium text-text-primary">No documents yet</h3>
            <p className="mt-2 text-text-secondary">
              Create your first invoice or credit note to get started.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/documents/new?type=invoice">
                <Button>Create Invoice</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Number
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const statusConfig = statusStyles[doc.status]
                  const isOverdue =
                    doc.status === 'issued' &&
                    doc.due_date &&
                    new Date(doc.due_date) < new Date()

                  return (
                    <tr
                      key={doc.id}
                      className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {doc.document_type === 'invoice' ? (
                            <FileText className="h-4 w-4 text-primary" />
                          ) : (
                            <FileMinus className="h-4 w-4 text-danger" />
                          )}
                          <span className="text-sm text-text-primary capitalize">
                            {doc.document_type.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {doc.document_number || 'Draft'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-primary">
                          {doc.customer?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {doc.issue_date ? formatDate(doc.issue_date) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm ${
                            isOverdue ? 'text-danger font-medium' : 'text-text-secondary'
                          }`}
                        >
                          {doc.due_date ? formatDate(doc.due_date) : '-'}
                          {isOverdue && ' (Overdue)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-text-primary">
                          {formatCurrency(doc.total, doc.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <DocumentActions document={doc} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          baseUrl={`/documents${params.type ? `?type=${params.type}` : ''}${params.status ? `${params.type ? '&' : '?'}status=${params.status}` : ''}`}
        />
      )}
    </div>
  )
}
