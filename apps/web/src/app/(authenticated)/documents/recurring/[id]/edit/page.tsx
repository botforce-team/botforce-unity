import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui'
import { RecurringForm } from '../../recurring-form'
import { getRecurringInvoice, getCustomersForRecurringSelect } from '@/app/actions/recurring-invoices'

export const metadata: Metadata = {
  title: 'Edit Recurring Invoice | BOTFORCE Unity',
}

interface EditRecurringPageProps {
  params: Promise<{ id: string }>
}

export default async function EditRecurringPage({ params }: EditRecurringPageProps) {
  const { id } = await params
  const [template, customers] = await Promise.all([
    getRecurringInvoice(id),
    getCustomersForRecurringSelect(),
  ])

  if (!template) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Documents', href: '/documents' },
          { label: 'Recurring', href: '/documents/recurring' },
          { label: 'Edit Template' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Edit Recurring Invoice</h1>
        <p className="mt-1 text-text-secondary">
          Update the template settings and line items
        </p>
      </div>

      <div className="max-w-4xl">
        <RecurringForm
          template={template}
          customers={customers}
        />
      </div>
    </div>
  )
}
