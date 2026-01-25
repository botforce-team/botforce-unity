import { createClient } from '@/lib/supabase/server'
import { Plus, Building2, Mail, Phone, MapPin } from 'lucide-react'
import Link from 'next/link'

export default async function CustomersPage() {
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

  // Fetch customers with project counts
  const { data: customers } = await supabase
    .from('customers')
    .select(`
      *,
      projects:projects(count)
    `)
    .eq('company_id', company_id)
    .order('name', { ascending: true })

  // Get invoice totals per customer
  const { data: invoiceTotals } = await supabase
    .from('documents')
    .select('customer_id, total, status')
    .eq('company_id', company_id)
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])

  // Calculate totals per customer
  const customerStats: Record<string, { total: number; unpaid: number }> = {}
  invoiceTotals?.forEach(inv => {
    if (!customerStats[inv.customer_id]) {
      customerStats[inv.customer_id] = { total: 0, unpaid: 0 }
    }
    customerStats[inv.customer_id].total += Number(inv.total)
    if (inv.status === 'issued') {
      customerStats[inv.customer_id].unpaid += Number(inv.total)
    }
  })

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-AT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
            Manage your customers and their projects
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/customers/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white"
            style={{ background: '#1f5bff' }}
          >
            <Plus className="h-4 w-4" />
            New Customer
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="text-2xl font-bold text-white">{customers?.length || 0}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Total Customers</p>
        </div>
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="text-2xl font-bold text-white">
            {customers?.filter(c => c.is_active !== false).length || 0}
          </div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Active</p>
        </div>
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="text-2xl font-bold text-[#f59e0b]">
            {formatCurrency(Object.values(customerStats).reduce((sum, s) => sum + s.unpaid, 0))}
          </div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Total Outstanding</p>
        </div>
      </div>

      {/* Customers List */}
      {!customers || customers.length === 0 ? (
        <div
          className="py-12 rounded-[18px] text-center"
          style={cardStyle}
        >
          <Building2 className="h-12 w-12 mx-auto text-[rgba(232,236,255,0.3)] mb-4" />
          <p className="text-[rgba(232,236,255,0.6)] text-[14px]">
            No customers yet.
            {isAdmin && ' Add your first customer to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => {
            const stats = customerStats[customer.id] || { total: 0, unpaid: 0 }
            const projectCount = customer.projects?.[0]?.count || 0

            return (
              <Link key={customer.id} href={`/customers/${customer.id}`}>
                <div
                  className="p-5 rounded-[18px] h-full transition-all hover:border-[rgba(255,255,255,0.2)]"
                  style={cardStyle}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center"
                        style={{
                          background: 'rgba(139, 92, 246, 0.15)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                        }}
                      >
                        <span className="text-[14px] font-semibold text-[#a78bfa]">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-white">{customer.name}</h3>
                        {customer.vat_number && (
                          <p className="text-[11px] text-[rgba(232,236,255,0.5)]">
                            {customer.vat_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {customer.email && (
                      <div className="flex items-center gap-2 text-[12px] text-[rgba(232,236,255,0.6)]">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-[12px] text-[rgba(232,236,255,0.6)]">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                    {(customer.city || customer.country) && (
                      <div className="flex items-center gap-2 text-[12px] text-[rgba(232,236,255,0.6)]">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{[customer.city, customer.country].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div
                    className="pt-3 flex items-center justify-between text-[12px]"
                    style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
                  >
                    <span className="text-[rgba(232,236,255,0.5)]">
                      {projectCount} project{projectCount !== 1 ? 's' : ''}
                    </span>
                    {stats.unpaid > 0 ? (
                      <span className="text-[#f59e0b] font-medium">
                        {formatCurrency(stats.unpaid)} unpaid
                      </span>
                    ) : stats.total > 0 ? (
                      <span className="text-[#22c55e] font-medium">
                        {formatCurrency(stats.total)} total
                      </span>
                    ) : (
                      <span className="text-[rgba(232,236,255,0.4)]">No invoices</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
