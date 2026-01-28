import { Metadata } from 'next'
import { Breadcrumbs } from '@/components/ui'
import { ExportForm } from './export-form'

export const metadata: Metadata = {
  title: 'New Accounting Export | BOTFORCE Unity',
}

export default function NewExportPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Accounting Export', href: '/accounting-export' },
          { label: 'New Export' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Create Accounting Export</h1>
        <p className="mt-1 text-text-secondary">
          Generate a CSV export of invoices and expenses for a specific period
        </p>
      </div>

      <div className="max-w-2xl">
        <ExportForm />
      </div>
    </div>
  )
}
