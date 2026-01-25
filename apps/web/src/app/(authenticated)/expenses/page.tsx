import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Receipt, Upload } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'

export default async function ExpensesPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get user's company membership
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No company access.</p>
      </div>
    )
  }

  const { company_id, role } = membership
  const isAdmin = role === 'superadmin'
  const isAccountant = role === 'accountant'

  // Fetch expenses based on role
  let expensesQuery = supabase
    .from('expenses')
    .select(`
      *,
      profile:profiles(id, email, first_name, last_name),
      project:projects(id, name, code)
    `)
    .eq('company_id', company_id)
    .order('date', { ascending: false })
    .limit(50)

  // Employees only see their own expenses
  if (!isAdmin && !isAccountant) {
    expensesQuery = expensesQuery.eq('user_id', user.id)
  }

  const { data: expenses } = await expensesQuery

  // Calculate totals
  const totalAmount = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
  const pendingAmount = expenses
    ?.filter(e => e.status === 'submitted')
    .reduce((sum, e) => sum + Number(e.amount), 0) || 0
  const approvedAmount = expenses
    ?.filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + Number(e.amount), 0) || 0

  const canCreateExpense = !isAccountant

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="mt-1 text-sm text-gray-600">
            {isAdmin ? 'Review and approve expenses' :
             isAccountant ? 'View all expenses' :
             'Submit and track your expenses'}
          </p>
        </div>
        {canCreateExpense && (
          <Link href="/expenses/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Expense
            </Button>
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
            <p className="text-sm text-muted-foreground">Total Expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(pendingAmount)}
            </div>
            <p className="text-sm text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(approvedAmount)}
            </div>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses List */}
      <Card>
        <CardHeader>
          <CardTitle>All Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {!expenses || expenses.length === 0 ? (
            <p className="text-center text-gray-600 py-8">
              No expenses yet.
              {canCreateExpense && ' Click "New Expense" to add your first expense.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">Description</th>
                    {(isAdmin || isAccountant) && (
                      <th className="pb-3 font-medium">Employee</th>
                    )}
                    <th className="pb-3 font-medium">Project</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Receipt</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="text-sm">
                      <td className="py-3">{formatDate(expense.date)}</td>
                      <td className="py-3">
                        <Badge variant="outline">{expense.category}</Badge>
                      </td>
                      <td className="py-3">
                        <div>
                          <p className="font-medium">{expense.merchant || '-'}</p>
                          {expense.description && (
                            <p className="text-xs text-gray-500 truncate max-w-xs">
                              {expense.description}
                            </p>
                          )}
                        </div>
                      </td>
                      {(isAdmin || isAccountant) && (
                        <td className="py-3">
                          {expense.profile?.first_name || expense.profile?.email}
                        </td>
                      )}
                      <td className="py-3">
                        {expense.project?.name || '-'}
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(Number(expense.amount))}
                      </td>
                      <td className="py-3">
                        <Badge className={getStatusColor(expense.status)}>
                          {expense.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {expense.receipt_file_id ? (
                          <Receipt className="h-4 w-4 text-green-600" />
                        ) : (
                          <Upload className="h-4 w-4 text-gray-300" />
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          {expense.status === 'draft' && !isAdmin && !isAccountant && (
                            <Link href={`/expenses/${expense.id}/edit`}>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                            </Link>
                          )}
                          {expense.status === 'submitted' && isAdmin && (
                            <>
                              <Button variant="outline" size="sm" className="text-green-600">
                                Approve
                              </Button>
                              <Button variant="outline" size="sm" className="text-red-600">
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
