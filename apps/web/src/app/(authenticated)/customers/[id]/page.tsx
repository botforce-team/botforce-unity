import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, MapPin, Globe, FileText, FolderKanban, Edit, AlertCircle } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { DeleteCustomerButton } from './actions'

export default async function CustomerDetailPage({
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
    return (
      <div className="text-center py-12">
        <p className="text-[rgba(232,236,255,0.6)]">No company access.</p>
      </div>
    )
  }

  const isAdmin = membership.role === 'superadmin'

  // Fetch customer
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', membership.company_id)
    .single()

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-[rgba(232,236,255,0.6)]">Customer not found.</p>
        <Link href="/customers" className="text-[#1f5bff] hover:underline mt-2 inline-block">
          Back to Customers
        </Link>
      </div>
    )
  }

  // Fetch projects for this customer
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  // Fetch invoices for this customer
  const { data: invoices } = await supabase
    .from('documents')
    .select('*')
    .eq('customer_id', customer.id)
    .eq('document_type', 'invoice')
    .order('created_at', { ascending: false })
    .limit(10)

  // Calculate totals
  const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
  const unpaidAmount = invoices?.filter(inv => inv.status === 'issued').reduce((sum, inv) => sum + Number(inv.total), 0) || 0

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'paid':
        return { background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.35)', color: '#22c55e' }
      case 'issued':
        return { background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#f59e0b' }
      default:
        return { background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)', color: 'rgba(255, 255, 255, 0.5)' }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              <span className="text-[20px] font-bold text-[#a78bfa]">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{customer.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                {customer.vat_number && (
                  <p className="text-[13px] text-[rgba(232,236,255,0.5)]">VAT: {customer.vat_number}</p>
                )}
                {customer.reverse_charge && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                    style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#f59e0b' }}
                  >
                    <AlertCircle className="h-3 w-3" />
                    Reverse Charge
                  </span>
                )}
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3">
              <Link
                href={`/customers/${customer.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-medium text-[rgba(232,236,255,0.8)]"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <Edit className="h-4 w-4" />
                Edit
              </Link>
              <DeleteCustomerButton customerId={customer.id} />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="text-2xl font-bold text-white">{projects?.length || 0}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Projects</p>
        </div>
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="text-2xl font-bold text-white">{invoices?.length || 0}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Invoices</p>
        </div>
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="text-2xl font-bold text-white">{formatCurrency(totalInvoiced)}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Total Invoiced</p>
        </div>
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className={`text-2xl font-bold ${unpaidAmount > 0 ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
            {formatCurrency(unpaidAmount)}
          </div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Outstanding</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact Info */}
        <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
          <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <h2 className="text-[15px] font-semibold text-white">Contact Information</h2>
          </div>
          <div className="p-5 space-y-4">
            {customer.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
                <a href={`mailto:${customer.email}`} className="text-[13px] text-[#1f5bff] hover:underline">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
                <a href={`tel:${customer.phone}`} className="text-[13px] text-[rgba(232,236,255,0.8)]">
                  {customer.phone}
                </a>
              </div>
            )}
            {customer.website && (
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
                <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#1f5bff] hover:underline">
                  {customer.website}
                </a>
              </div>
            )}
            {(customer.address_line1 || customer.city) && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-[rgba(232,236,255,0.5)] mt-0.5" />
                <div className="text-[13px] text-[rgba(232,236,255,0.8)]">
                  {customer.address_line1 && <p>{customer.address_line1}</p>}
                  {customer.address_line2 && <p>{customer.address_line2}</p>}
                  {(customer.postal_code || customer.city) && (
                    <p>{[customer.postal_code, customer.city].filter(Boolean).join(' ')}</p>
                  )}
                  {customer.country && <p>{customer.country}</p>}
                </div>
              </div>
            )}
            {!customer.email && !customer.phone && !customer.address_line1 && (
              <p className="text-[13px] text-[rgba(232,236,255,0.5)]">No contact information</p>
            )}
          </div>
        </div>

        {/* Projects */}
        <div className="lg:col-span-2 rounded-[18px] overflow-hidden" style={cardStyle}>
          <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <h2 className="text-[15px] font-semibold text-white">Projects</h2>
            {isAdmin && (
              <Link
                href={`/projects/new?customer=${customer.id}`}
                className="text-[12px] text-[#1f5bff] hover:underline"
              >
                + Add Project
              </Link>
            )}
          </div>
          <div className="p-5">
            {!projects || projects.length === 0 ? (
              <p className="text-center text-[rgba(232,236,255,0.5)] py-4 text-[13px]">
                No projects yet
              </p>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 rounded-[10px] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FolderKanban className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
                      <div>
                        <p className="text-[13px] font-medium text-white">{project.name}</p>
                        {project.code && (
                          <p className="text-[11px] text-[rgba(232,236,255,0.5)]">{project.code}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                      style={project.is_active
                        ? { background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.35)', color: '#22c55e' }
                        : { background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)', color: 'rgba(255, 255, 255, 0.5)' }
                      }
                    >
                      {project.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">Recent Invoices</h2>
          {isAdmin && (
            <Link
              href={`/documents/new?customer=${customer.id}`}
              className="text-[12px] text-[#1f5bff] hover:underline"
            >
              + Create Invoice
            </Link>
          )}
        </div>
        <div className="p-5">
          {!invoices || invoices.length === 0 ? (
            <p className="text-center text-[rgba(232,236,255,0.5)] py-4 text-[13px]">
              No invoices yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: 'rgba(255, 255, 255, 0.08)', color: 'rgba(232, 236, 255, 0.5)' }}>
                    <th className="pb-3">Number</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="text-[13px] border-b last:border-0"
                      style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
                    >
                      <td className="py-3">
                        <Link href={`/documents/${invoice.id}`} className="font-medium text-white hover:text-[#1f5bff]">
                          {invoice.document_number || 'Draft'}
                        </Link>
                      </td>
                      <td className="py-3 text-[rgba(232,236,255,0.6)]">
                        {invoice.issue_date ? formatDate(invoice.issue_date) : '-'}
                      </td>
                      <td className="py-3 text-right font-medium text-white">
                        {formatCurrency(Number(invoice.total))}
                      </td>
                      <td className="py-3">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                          style={getStatusStyle(invoice.status)}
                        >
                          {invoice.status}
                        </span>
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
