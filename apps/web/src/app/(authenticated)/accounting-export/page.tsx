import { createClient } from '@/lib/supabase/server'
import { Plus, Download, Lock, FileText } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils'

interface AccountingExport {
  id: string
  name: string
  period_start: string
  period_end: string
  created_at: string
  invoice_count: number
  expense_count: number
  total_revenue: number
  status: string
  is_locked: boolean
  zip_file_id: string | null
  created_by_profile?: {
    email: string
    first_name: string | null
    last_name: string | null
  } | null
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'completed':
      return {
        background: 'rgba(34, 197, 94, 0.12)',
        border: '1px solid rgba(34, 197, 94, 0.35)',
        color: '#22c55e',
      }
    case 'processing':
      return {
        background: 'rgba(59, 130, 246, 0.12)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        color: '#3b82f6',
      }
    case 'failed':
      return {
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        color: '#ef4444',
      }
    default:
      return {
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: 'rgba(255, 255, 255, 0.5)',
      }
  }
}

export default async function AccountingExportPage() {
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
        <p className="text-[rgba(232,236,255,0.6)]">No company access.</p>
      </div>
    )
  }

  const { company_id, role } = membership
  const isAdmin = role === 'superadmin'
  const isAccountant = role === 'accountant'

  // Only admin and accountant can access
  if (!isAdmin && !isAccountant) {
    return (
      <div className="text-center py-12">
        <p className="text-[rgba(232,236,255,0.6)]">You don't have access to accounting exports.</p>
      </div>
    )
  }

  // Fetch exports
  const { data: exportsData } = await supabase
    .from('accounting_exports')
    .select(`
      *,
      created_by_profile:profiles!accounting_exports_created_by_fkey(email, first_name, last_name)
    `)
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })
    .limit(20)

  const exports = (exportsData || []) as AccountingExport[]

  // Get counts for the current month to show what would be exported
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const endOfMonth = new Date(startOfMonth)
  endOfMonth.setMonth(endOfMonth.getMonth() + 1)
  endOfMonth.setDate(0)

  const { count: invoiceCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])
    .gte('issue_date', startOfMonth.toISOString().split('T')[0])
    .lte('issue_date', endOfMonth.toISOString().split('T')[0])

  const { count: expenseCount } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)
    .eq('status', 'approved')
    .gte('date', startOfMonth.toISOString().split('T')[0])
    .lte('date', endOfMonth.toISOString().split('T')[0])

  const monthName = startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounting Export</h1>
          <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
            Generate monthly export packages for your accountant
          </p>
        </div>
        <Link
          href="/accounting-export/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white"
          style={{ background: '#1f5bff' }}
        >
          <Plus className="h-4 w-4" />
          Create Export
        </Link>
      </div>

      {/* Current Month Preview */}
      <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">Current Month: {monthName}</h2>
          <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
            Documents ready for export
          </p>
        </div>
        <div className="p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div
              className="p-4 rounded-[12px]"
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div className="text-2xl font-bold text-white">{invoiceCount || 0}</div>
              <p className="text-[12px] text-[rgba(232,236,255,0.5)]">Invoices</p>
            </div>
            <div
              className="p-4 rounded-[12px]"
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div className="text-2xl font-bold text-white">{expenseCount || 0}</div>
              <p className="text-[12px] text-[rgba(232,236,255,0.5)]">Approved Expenses</p>
            </div>
            <div
              className="p-4 rounded-[12px] flex items-center justify-center"
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <Link
                href={`/accounting-export/new?month=${startOfMonth.toISOString().split('T')[0]}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium text-[rgba(232,236,255,0.8)]"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <FileText className="h-4 w-4" />
                Preview Export
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Export History */}
      <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">Export History</h2>
          <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
            Previously generated export packages
          </p>
        </div>
        <div className="p-5">
          {!exports || exports.length === 0 ? (
            <p className="text-center text-[rgba(232,236,255,0.6)] py-8 text-[13px]">
              No exports yet. Create your first export to generate a package for your accountant.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: 'rgba(255, 255, 255, 0.08)', color: 'rgba(232, 236, 255, 0.5)' }}>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Period</th>
                    <th className="pb-3">Created</th>
                    <th className="pb-3">Invoices</th>
                    <th className="pb-3">Expenses</th>
                    <th className="pb-3 text-right">Revenue</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {exports.map((exp) => (
                    <tr
                      key={exp.id}
                      className="text-[13px] border-b last:border-0"
                      style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{exp.name}</span>
                          {exp.is_locked && (
                            <Lock className="h-3 w-3 text-[rgba(232,236,255,0.4)]" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-[rgba(232,236,255,0.6)]">
                        {formatDate(exp.period_start)} - {formatDate(exp.period_end)}
                      </td>
                      <td className="py-3">
                        <div>
                          <span className="text-[rgba(232,236,255,0.7)]">{formatDate(exp.created_at)}</span>
                          <p className="text-[11px] text-[rgba(232,236,255,0.4)]">
                            by {exp.created_by_profile?.first_name || exp.created_by_profile?.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 text-[rgba(232,236,255,0.7)]">{exp.invoice_count}</td>
                      <td className="py-3 text-[rgba(232,236,255,0.7)]">{exp.expense_count}</td>
                      <td className="py-3 text-right font-medium text-white">
                        {formatCurrency(Number(exp.total_revenue))}
                      </td>
                      <td className="py-3">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                          style={getStatusStyle(exp.status)}
                        >
                          {exp.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/accounting-export/${exp.id}`}
                            className="px-3 py-1 rounded-[8px] text-[12px] font-medium text-[rgba(232,236,255,0.7)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                          >
                            View
                          </Link>
                          {exp.zip_file_id && (
                            <button className="p-2 rounded-[8px] text-[rgba(232,236,255,0.6)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors">
                              <Download className="h-4 w-4" />
                            </button>
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
