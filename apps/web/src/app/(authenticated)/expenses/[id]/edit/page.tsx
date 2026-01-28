import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui'
import { ExpenseForm } from '../../expense-form'
import { getExpense } from '@/app/actions/expenses'
import { getProjectsForSelect } from '@/app/actions/time-entries'

export const metadata: Metadata = {
  title: 'Edit Expense | BOTFORCE Unity',
}

interface EditExpensePageProps {
  params: Promise<{ id: string }>
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const { id } = await params
  const [expense, projects] = await Promise.all([
    getExpense(id),
    getProjectsForSelect(),
  ])

  if (!expense) {
    notFound()
  }

  // Check if expense can be edited
  if (!['draft', 'rejected'].includes(expense.status)) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Expenses', href: '/expenses' },
            { label: 'Cannot Edit' },
          ]}
        />
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <h2 className="text-lg font-medium text-text-primary">Cannot Edit Expense</h2>
          <p className="mt-2 text-text-secondary">
            This expense has been submitted and cannot be edited. Only draft or rejected expenses can be modified.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Expenses', href: '/expenses' },
          { label: 'Edit Expense' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Edit Expense</h1>
        <p className="mt-1 text-text-secondary">
          Update expense details
        </p>
      </div>

      <div className="max-w-2xl">
        <ExpenseForm expense={expense} projects={projects} />
      </div>
    </div>
  )
}
