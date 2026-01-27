import { createClient } from '@/lib/supabase/server'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  SubmitExpenseButton,
  ApproveExpenseButton,
  RejectExpenseButton,
  DeleteExpenseButton,
  ViewReceiptButton,
  UploadReceiptButton,
} from './expense-actions'

interface CompanyMembership {
  company_id: string
  role: string
}

interface ExpenseWithRelations {
  id: string
  date: string
  amount: number
  category: string
  status: string
  description: string | null
  merchant: string | null
  receipt_file_id: string | null
  user_id: string
  profile: { id: string; email: string; first_name: string | null; last_name: string | null } | null
  project: { id: string; name: string; code: string | null } | null
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'approved':
      return {
        background: 'rgba(34, 197, 94, 0.12)',
        border: '1px solid rgba(34, 197, 94, 0.35)',
        color: '#22c55e',
      }
    case 'submitted':
      return {
        background: 'rgba(245, 158, 11, 0.12)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        color: '#f59e0b',
      }
    case 'draft':
      return {
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: 'rgba(255, 255, 255, 0.5)',
      }
    case 'rejected':
      return {
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        color: '#ef4444',
      }
    case 'reimbursed':
      return {
        background: 'rgba(59, 130, 246, 0.12)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        color: '#3b82f6',
      }
    default:
      return {
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: 'rgba(255, 255, 255, 0.5)',
      }
  }
}

export default async function ExpensesPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Get user's company membership
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership) {
    return (
      <div className="py-12 text-center">
        <p className="text-[rgba(232,236,255,0.6)]">No company access.</p>
      </div>
    )
  }

  const { company_id, role } = membership
  const isAdmin = role === 'superadmin'
  const isAccountant = role === 'accountant'

  // Fetch expenses based on role
  // Use explicit foreign key hint for profile join since there are multiple FKs to profiles
  let expensesQuery = supabase
    .from('expenses')
    .select(
      `
      *,
      profile:profiles!expenses_user_id_fkey(id, email, first_name, last_name),
      project:projects(id, name, code)
    `
    )
    .eq('company_id', company_id)
    .order('date', { ascending: false })
    .limit(50)

  // Employees only see their own expenses
  if (!isAdmin && !isAccountant) {
    expensesQuery = expensesQuery.eq('user_id', user.id)
  }

  const { data: expensesData } = await expensesQuery
  const expenses = (expensesData || []) as ExpenseWithRelations[]

  // Calculate totals
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const pendingAmount = expenses
    .filter((e) => e.status === 'submitted')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const approvedAmount = expenses
    .filter((e) => e.status === 'approved')
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const canCreateExpense = !isAccountant

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
            {isAdmin
              ? 'Review and approve expenses'
              : isAccountant
                ? 'View all expenses'
                : 'Submit and track your expenses'}
          </p>
        </div>
        {canCreateExpense && (
          <Link
            href="/expenses/new"
            className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: '#1f5bff' }}
          >
            <Plus className="h-4 w-4" />
            New Expense
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <div className="text-2xl font-bold text-white">{formatCurrency(totalAmount)}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Total Expenses</p>
        </div>
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <div className="text-2xl font-bold text-[#f59e0b]">{formatCurrency(pendingAmount)}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Pending Approval</p>
        </div>
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <div className="text-2xl font-bold text-[#22c55e]">{formatCurrency(approvedAmount)}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Approved</p>
        </div>
      </div>

      {/* Expenses List */}
      <div className="overflow-hidden rounded-[18px]" style={cardStyle}>
        <div className="border-b p-5" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">All Expenses</h2>
        </div>
        <div className="p-5">
          {!expenses || expenses.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[rgba(232,236,255,0.6)]">
              No expenses yet.
              {canCreateExpense && ' Click "New Expense" to add your first expense.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="border-b text-left text-[11px] font-semibold uppercase tracking-wide"
                    style={{
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      color: 'rgba(232, 236, 255, 0.5)',
                    }}
                  >
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Description</th>
                    {(isAdmin || isAccountant) && <th className="pb-3">Employee</th>}
                    <th className="pb-3">Project</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Receipt</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b text-[13px] last:border-0"
                      style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
                    >
                      <td className="py-3 text-[rgba(232,236,255,0.6)]">
                        {formatDate(expense.date)}
                      </td>
                      <td className="py-3">
                        <span
                          className="rounded px-2 py-0.5 text-[10px] font-medium uppercase"
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: 'rgba(232, 236, 255, 0.7)',
                          }}
                        >
                          {expense.category}
                        </span>
                      </td>
                      <td className="py-3">
                        <div>
                          <p className="font-medium text-white">{expense.merchant || '-'}</p>
                          {expense.description && (
                            <p className="max-w-xs truncate text-[11px] text-[rgba(232,236,255,0.5)]">
                              {expense.description}
                            </p>
                          )}
                        </div>
                      </td>
                      {(isAdmin || isAccountant) && (
                        <td className="py-3 text-[rgba(232,236,255,0.7)]">
                          {expense.profile?.first_name || expense.profile?.email}
                        </td>
                      )}
                      <td className="py-3 text-[rgba(232,236,255,0.6)]">
                        {expense.project?.name || '-'}
                      </td>
                      <td className="py-3 text-right font-medium text-white">
                        {formatCurrency(Number(expense.amount))}
                      </td>
                      <td className="py-3">
                        <span
                          className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                          style={getStatusStyle(expense.status)}
                        >
                          {expense.status}
                        </span>
                      </td>
                      <td className="py-3">
                        {expense.receipt_file_id ? (
                          <ViewReceiptButton expenseId={expense.id} />
                        ) : expense.status === 'draft' && expense.user_id === user.id ? (
                          <UploadReceiptButton expenseId={expense.id} />
                        ) : (
                          <span className="text-[rgba(255,255,255,0.2)]">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          {expense.status === 'draft' && expense.user_id === user.id && (
                            <>
                              <SubmitExpenseButton expenseId={expense.id} />
                              <DeleteExpenseButton expenseId={expense.id} />
                            </>
                          )}
                          {expense.status === 'submitted' && isAdmin && (
                            <>
                              <ApproveExpenseButton expenseId={expense.id} />
                              <RejectExpenseButton expenseId={expense.id} />
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
        </div>
      </div>
    </div>
  )
}
