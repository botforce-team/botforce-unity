import { createClient } from '@/lib/supabase/server'
import { Plus, Building2, Mail, Phone, MapPin } from 'lucide-react'
import Link from 'next/link'

interface CompanyMembership {
  company_id: string
  role: string
}

interface CustomerWithProjects {
  id: string
  name: string
  email: string | null
  phone: string | null
  address_line1: string | null
  city: string | null
  country: string | null
  vat_number: string | null
  is_active?: boolean
  projects: { count: number }[]
}

interface InvoiceTotal {
  customer_id: string
  total: number
  status: string
}

export default async function CustomersPage() {
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

  // Fetch customers with project counts
  const { data: customersData } = await supabase
    .from('customers')
    .select(
      `
      *,
      projects:projects(count)
    `
    )
    .eq('company_id', company_id)
    .order('name', { ascending: true })

  const customers = (customersData || []) as CustomerWithProjects[]

  // Get invoice totals per customer
  const { data: invoiceTotalsData } = await supabase
    .from('documents')
    .select('customer_id, total, status')
    .eq('company_id', company_id)
    .eq('document_type', 'invoice')
    .in('status', ['issued', 'paid'])

  const invoiceTotals = (invoiceTotalsData || []) as InvoiceTotal[]

  // Calculate totals per customer
  const customerStats: Record<string, { total: number; unpaid: number }> = {}
  invoiceTotals.forEach((inv) => {
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
            className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: '#1f5bff' }}
          >
            <Plus className="h-4 w-4" />
            New Customer
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <div className="text-2xl font-bold text-white">{customers?.length || 0}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Total Customers</p>
        </div>
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <div className="text-2xl font-bold text-white">
            {customers?.filter((c) => c.is_active !== false).length || 0}
          </div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Active</p>
        </div>
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <div className="text-2xl font-bold text-[#f59e0b]">
            {formatCurrency(Object.values(customerStats).reduce((sum, s) => sum + s.unpaid, 0))}
          </div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Total Outstanding</p>
        </div>
      </div>

      {/* Customers List */}
      {!customers || customers.length === 0 ? (
        <div className="rounded-[18px] py-12 text-center" style={cardStyle}>
          <Building2 className="mx-auto mb-4 h-12 w-12 text-[rgba(232,236,255,0.3)]" />
          <p className="text-[14px] text-[rgba(232,236,255,0.6)]">
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
                  className="h-full rounded-[18px] p-5 transition-all hover:border-[rgba(255,255,255,0.2)]"
                  style={cardStyle}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full"
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

                  <div className="mb-4 space-y-2">
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
                    className="flex items-center justify-between pt-3 text-[12px]"
                    style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
                  >
                    <span className="text-[rgba(232,236,255,0.5)]">
                      {projectCount} project{projectCount !== 1 ? 's' : ''}
                    </span>
                    {stats.unpaid > 0 ? (
                      <span className="font-medium text-[#f59e0b]">
                        {formatCurrency(stats.unpaid)} unpaid
                      </span>
                    ) : stats.total > 0 ? (
                      <span className="font-medium text-[#22c55e]">
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
