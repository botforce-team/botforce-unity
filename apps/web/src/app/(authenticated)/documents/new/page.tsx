import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui'
import { DocumentForm } from '../document-form'
import { getCustomersForDocumentSelect } from '@/app/actions/documents'
import type { DocumentType } from '@/types'

export const metadata: Metadata = {
  title: 'New Document | BOTFORCE Unity',
}

interface NewDocumentPageProps {
  searchParams: Promise<{ type?: string; customer?: string }>
}

export default async function NewDocumentPage({ searchParams }: NewDocumentPageProps) {
  const params = await searchParams
  const documentType = (params.type as DocumentType) || 'invoice'

  // Validate document type
  if (!['invoice', 'credit_note'].includes(documentType)) {
    redirect('/documents/new?type=invoice')
  }

  const customers = await getCustomersForDocumentSelect()

  const documentTypeLabel = documentType === 'invoice' ? 'Invoice' : 'Credit Note'

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Documents', href: '/documents' },
          { label: `New ${documentTypeLabel}` },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Create {documentTypeLabel}</h1>
        <p className="mt-1 text-text-secondary">
          {documentType === 'invoice'
            ? 'Create a new invoice for a customer'
            : 'Create a credit note to adjust a previous invoice'}
        </p>
      </div>

      <div className="max-w-4xl">
        <DocumentForm
          documentType={documentType}
          customers={customers}
          defaultCustomerId={params.customer}
        />
      </div>
    </div>
  )
}
