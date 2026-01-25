import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { DocumentActions } from './actions'

export default async function DocumentDetailPage({
  params,
}: {
  params: { id: string }
}) {
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
    return notFound()
  }

  const isAdmin = membership.role === 'superadmin'

  // Fetch document with customer and lines
  const { data: document } = await supabase
    .from('documents')
    .select(`
      *,
      customer:customers(id, name, email, vat_number, address_line1, city, postal_code, country)
    `)
    .eq('id', params.id)
    .eq('company_id', membership.company_id)
    .single()

  if (!document) {
    return notFound()
  }

  // Fetch document lines
  const { data: lines } = await supabase
    .from('document_lines')
    .select('*')
    .eq('document_id', params.id)
    .order('line_number')

  // Fetch company for header
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', membership.company_id)
    .single()

  const statusStyles: Record<string, { bg: string; border: string; color: string }> = {
    draft: { bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.12)', color: 'rgba(255, 255, 255, 0.6)' },
    issued: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', color: '#f59e0b' },
    paid: { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.35)', color: '#22c55e' },
    cancelled: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', color: '#ef4444' },
  }

  const style = statusStyles[document.status] || statusStyles.draft

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Documents
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {document.document_type === 'invoice' ? 'Invoice' : 'Credit Note'}{' '}
              {document.document_number || '(Draft)'}
            </h1>
            <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
              {document.customer?.name}
            </p>
          </div>
          <span
            className="px-3 py-1 rounded-full text-[12px] font-medium uppercase"
            style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
              color: style.color,
            }}
          >
            {document.status}
          </span>
        </div>
      </div>

      {/* Invoice Preview */}
      <div
        className="p-8 rounded-[18px]"
        style={{
          background: 'rgba(255, 255, 255, 0.96)',
          color: '#1a1a2e',
        }}
      >
        {/* Header */}
        <div className="flex justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{company?.name}</h2>
            {company?.address_line1 && <p className="text-sm text-gray-600">{company.address_line1}</p>}
            {company?.city && (
              <p className="text-sm text-gray-600">
                {company.postal_code} {company.city}, {company.country}
              </p>
            )}
            {company?.vat_number && (
              <p className="text-sm text-gray-600 mt-1">VAT: {company.vat_number}</p>
            )}
          </div>
          <div className="text-right">
            <h3 className="text-2xl font-bold text-gray-900">
              {document.document_type === 'invoice' ? 'INVOICE' : 'CREDIT NOTE'}
            </h3>
            {document.document_number && (
              <p className="text-lg font-medium text-gray-700">{document.document_number}</p>
            )}
            {document.issue_date && (
              <p className="text-sm text-gray-600">Date: {formatDate(document.issue_date)}</p>
            )}
            {document.due_date && (
              <p className="text-sm text-gray-600">Due: {formatDate(document.due_date)}</p>
            )}
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Bill To</p>
          <p className="font-semibold text-gray-900">{document.customer?.name}</p>
          {document.customer?.address_line1 && (
            <p className="text-sm text-gray-600">{document.customer.address_line1}</p>
          )}
          {document.customer?.city && (
            <p className="text-sm text-gray-600">
              {document.customer.postal_code} {document.customer.city}, {document.customer.country}
            </p>
          )}
          {document.customer?.vat_number && (
            <p className="text-sm text-gray-600 mt-1">VAT: {document.customer.vat_number}</p>
          )}
        </div>

        {/* Line Items */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="text-right py-3 text-xs font-semibold text-gray-500 uppercase w-20">Qty</th>
              <th className="text-right py-3 text-xs font-semibold text-gray-500 uppercase w-24">Unit Price</th>
              <th className="text-right py-3 text-xs font-semibold text-gray-500 uppercase w-20">Tax</th>
              <th className="text-right py-3 text-xs font-semibold text-gray-500 uppercase w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines?.map((line) => (
              <tr key={line.id} className="border-b border-gray-100">
                <td className="py-3 text-sm text-gray-900">{line.description}</td>
                <td className="py-3 text-sm text-gray-600 text-right">
                  {line.quantity} {line.unit}
                </td>
                <td className="py-3 text-sm text-gray-600 text-right">
                  {formatCurrency(line.unit_price)}
                </td>
                <td className="py-3 text-sm text-gray-600 text-right">
                  {line.tax_rate === 'standard_20' ? '20%' : line.tax_rate === 'reduced_10' ? '10%' : '0%'}
                </td>
                <td className="py-3 text-sm font-medium text-gray-900 text-right">
                  {formatCurrency(line.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(document.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax</span>
              <span className="font-medium">{formatCurrency(document.tax_total)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-gray-200">
              <span>Total</span>
              <span>{formatCurrency(document.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {document.notes && (
          <div className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes</p>
            <p className="text-sm text-gray-600">{document.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {isAdmin && <DocumentActions document={document} />}
    </div>
  )
}
