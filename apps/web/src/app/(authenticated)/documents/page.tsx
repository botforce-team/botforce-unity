import { createClient } from '@/lib/supabase/server'
import { Plus, FileText, Download } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils'

function getStatusStyle(status: string) {
  switch (status) {
    case 'paid':
      return {
        background: 'rgba(34, 197, 94, 0.12)',
        border: '1px solid rgba(34, 197, 94, 0.35)',
        color: '#22c55e',
      }
    case 'issued':
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
    case 'cancelled':
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

export default async function DocumentsPage() {
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

  // Both admin and accountant can view documents
  if (!isAdmin && !isAccountant) {
    return (
      <div className="text-center py-12">
        <p className="text-[rgba(232,236,255,0.6)]">You don't have access to documents.</p>
      </div>
    )
  }

  // Fetch documents
  const { data: documents } = await supabase
    .from('documents')
    .select(`
      *,
      customer:customers(id, name)
    `)
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Group by type
  const invoices = documents?.filter(d => d.document_type === 'invoice') || []
  const creditNotes = documents?.filter(d => d.document_type === 'credit_note') || []

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
            Manage invoices and credit notes
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/documents/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white"
            style={{ background: '#1f5bff' }}
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="text-2xl font-bold text-white">{invoices.length}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Total Invoices</p>
        </div>
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="text-2xl font-bold text-[rgba(255,255,255,0.7)]">
            {invoices.filter(d => d.status === 'draft').length}
          </div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Draft</p>
        </div>
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="text-2xl font-bold text-[#f59e0b]">
            {invoices.filter(d => d.status === 'issued').length}
          </div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Unpaid</p>
        </div>
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="text-2xl font-bold text-[#22c55e]">
            {formatCurrency(
              invoices
                .filter(d => d.status === 'paid')
                .reduce((sum, d) => sum + Number(d.total), 0)
            )}
          </div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Paid Total</p>
        </div>
      </div>

      {/* Documents List */}
      <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">Invoices</h2>
        </div>
        <div className="p-5">
          {invoices.length === 0 ? (
            <p className="text-center text-[rgba(232,236,255,0.6)] py-8 text-[13px]">
              No invoices yet.
              {isAdmin && ' Click "New Invoice" to create your first invoice.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: 'rgba(255, 255, 255, 0.08)', color: 'rgba(232, 236, 255, 0.5)' }}>
                    <th className="pb-3">Number</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Due Date</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((doc, index) => (
                    <tr
                      key={doc.id}
                      className="text-[13px] border-b last:border-0"
                      style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
                    >
                      <td className="py-3">
                        <span className="font-medium text-white">
                          {doc.document_number || 'Draft'}
                        </span>
                      </td>
                      <td className="py-3 text-[rgba(232,236,255,0.8)]">{doc.customer?.name}</td>
                      <td className="py-3 text-[rgba(232,236,255,0.6)]">
                        {doc.issue_date ? formatDate(doc.issue_date) : '-'}
                      </td>
                      <td className="py-3 text-[rgba(232,236,255,0.6)]">
                        {doc.due_date ? formatDate(doc.due_date) : '-'}
                      </td>
                      <td className="py-3 text-right font-medium text-white">
                        {formatCurrency(Number(doc.total))}
                      </td>
                      <td className="py-3">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                          style={getStatusStyle(doc.status)}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="p-2 rounded-[8px] text-[rgba(232,236,255,0.6)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                          {doc.pdf_url && (
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

      {creditNotes.length > 0 && (
        <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
          <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <h2 className="text-[15px] font-semibold text-white">Credit Notes</h2>
          </div>
          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: 'rgba(255, 255, 255, 0.08)', color: 'rgba(232, 236, 255, 0.5)' }}>
                    <th className="pb-3">Number</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {creditNotes.map((doc) => (
                    <tr
                      key={doc.id}
                      className="text-[13px] border-b last:border-0"
                      style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
                    >
                      <td className="py-3">
                        <span className="font-medium text-white">
                          {doc.document_number || 'Draft'}
                        </span>
                      </td>
                      <td className="py-3 text-[rgba(232,236,255,0.8)]">{doc.customer?.name}</td>
                      <td className="py-3 text-[rgba(232,236,255,0.6)]">
                        {doc.issue_date ? formatDate(doc.issue_date) : '-'}
                      </td>
                      <td className="py-3 text-right font-medium text-[#ef4444]">
                        -{formatCurrency(Number(doc.total))}
                      </td>
                      <td className="py-3">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                          style={getStatusStyle(doc.status)}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="p-2 rounded-[8px] text-[rgba(232,236,255,0.6)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
