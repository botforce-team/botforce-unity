import { Metadata } from 'next'
import { Breadcrumbs } from '@/components/ui'
import { RecurringForm } from '../recurring-form'
import { getCustomersForRecurringSelect } from '@/app/actions/recurring-invoices'

export const metadata: Metadata = {
  title: 'New Recurring Invoice | BOTFORCE Unity',
}

interface NewRecurringPageProps {
  searchParams: Promise<{ customer?: string }>
}

export default async function NewRecurringPage({ searchParams }: NewRecurringPageProps) {
  const params = await searchParams
  const customers = await getCustomersForRecurringSelect()

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Documents', href: '/documents' },
          { label: 'Recurring', href: '/documents/recurring' },
          { label: 'New Template' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Create Recurring Invoice</h1>
        <p className="mt-1 text-text-secondary">
          Set up a template to automatically generate invoices on a schedule
        </p>
      </div>

      <div className="max-w-4xl">
        <RecurringForm
          customers={customers}
          defaultCustomerId={params.customer}
        />
      </div>
    </div>
  )
}
