'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from '@/components/ui'
import { createExpense, updateExpense, type CreateExpenseInput } from '@/app/actions/expenses'
import { expenseCategories, taxRateOptions } from '@/lib/constants'
import type { Expense, TaxRate, ExpenseCategory } from '@/types'

interface ExpenseFormProps {
  expense?: Expense
  projects: { value: string; label: string }[]
  defaultProjectId?: string
}

export function ExpenseForm({ expense, projects, defaultProjectId }: ExpenseFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!expense

  const today = new Date().toISOString().split('T')[0]

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const input: CreateExpenseInput = {
        project_id: (formData.get('project_id') as string) || null,
        date: formData.get('date') as string,
        amount: parseFloat(formData.get('amount') as string) || 0,
        currency: formData.get('currency') as string || 'EUR',
        tax_rate: formData.get('tax_rate') as TaxRate,
        category: formData.get('category') as ExpenseCategory,
        description: (formData.get('description') as string) || null,
        merchant: (formData.get('merchant') as string) || null,
        is_reimbursable: formData.get('is_reimbursable') === 'on',
      }

      const result = isEditing
        ? await updateExpense(expense.id, input)
        : await createExpense(input)

      if (result.success) {
        router.push('/expenses')
      } else {
        alert(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Expense Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={expense?.date || today}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  id="category"
                  name="category"
                  required
                  defaultValue={expense?.category || 'other'}
                  options={expenseCategories}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={expense?.amount || ''}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  id="currency"
                  name="currency"
                  defaultValue={expense?.currency || 'EUR'}
                  options={[
                    { value: 'EUR', label: 'EUR' },
                    { value: 'CHF', label: 'CHF' },
                    { value: 'USD', label: 'USD' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_rate">Tax Rate *</Label>
                <Select
                  id="tax_rate"
                  name="tax_rate"
                  required
                  defaultValue={expense?.tax_rate || 'standard_20'}
                  options={taxRateOptions}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant / Vendor</Label>
              <Input
                id="merchant"
                name="merchant"
                defaultValue={expense?.merchant || ''}
                placeholder="e.g., Amazon, Shell, ÖBB"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={expense?.description || ''}
                placeholder="What was this expense for?"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project & Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project_id">Project (optional)</Label>
              <Select
                id="project_id"
                name="project_id"
                defaultValue={expense?.project_id || defaultProjectId || ''}
                options={[{ value: '', label: 'No project' }, ...projects]}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_reimbursable"
                name="is_reimbursable"
                defaultChecked={expense?.is_reimbursable ?? true}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="is_reimbursable" className="cursor-pointer">
                Reimbursable expense
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
              ? 'Save Changes'
              : 'Add Expense'}
          </Button>
        </div>
      </div>
    </form>
  )
}
