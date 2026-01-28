import { Metadata } from 'next'
import { Breadcrumbs } from '@/components/ui'
import { ExpenseForm } from '../expense-form'
import { getProjectsForSelect } from '@/app/actions/time-entries'

export const metadata: Metadata = {
  title: 'Add Expense | BOTFORCE Unity',
}

interface NewExpensePageProps {
  searchParams: Promise<{ project?: string }>
}

export default async function NewExpensePage({ searchParams }: NewExpensePageProps) {
  const params = await searchParams
  const projects = await getProjectsForSelect()

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Expenses', href: '/expenses' },
          { label: 'Add Expense' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Add Expense</h1>
        <p className="mt-1 text-text-secondary">
          Record a new expense for tracking and reimbursement
        </p>
      </div>

      <div className="max-w-2xl">
        <ExpenseForm projects={projects} defaultProjectId={params.project} />
      </div>
    </div>
  )
}
