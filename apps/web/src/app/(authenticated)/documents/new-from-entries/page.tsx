import { Metadata } from 'next'
import { Breadcrumbs } from '@/components/ui'
import { InvoiceFromEntriesForm } from './form'
import { getCustomersForDocumentSelect } from '@/app/actions/documents'
import { getUnbilledTimeEntries, getUnbilledExpenses } from '@/app/actions/invoicing'

export const metadata: Metadata = {
  title: 'Create Invoice from Time & Expenses | BOTFORCE Unity',
}

interface PageProps {
  searchParams: Promise<{ customer?: string }>
}

export default async function NewInvoiceFromEntriesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const [customers, timeEntries, expenses] = await Promise.all([
    getCustomersForDocumentSelect(),
    getUnbilledTimeEntries(params.customer),
    getUnbilledExpenses(params.customer),
  ])

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Documents', href: '/documents' },
          { label: 'Invoice from Time & Expenses' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Create Invoice from Time & Expenses</h1>
        <p className="mt-1 text-text-secondary">
          Select approved time entries and expenses to generate an invoice
        </p>
      </div>

      <InvoiceFromEntriesForm
        customers={customers}
        defaultCustomerId={params.customer}
        initialTimeEntries={timeEntries}
        initialExpenses={expenses}
      />
    </div>
  )
}
