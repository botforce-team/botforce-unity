import Link from 'next/link'
import { Plus, Building2, Mail, MapPin } from 'lucide-react'
import { Button, Card, Badge, EmptyState } from '@/components/ui'
import { getCustomers } from '@/app/actions/customers'
import { CustomerActions } from './customer-actions'

interface CustomersPageProps {
  searchParams: Promise<{ page?: string; search?: string; active?: string }>
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = params.search || ''
  const isActive = params.active === 'false' ? false : params.active === 'true' ? true : undefined

  const { data: customers, total, totalPages } = await getCustomers({
    page,
    search,
    isActive,
    limit: 20,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Link href="/customers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Customer
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <form className="flex-1">
          <input
            type="text"
            name="search"
            placeholder="Search customers..."
            defaultValue={search}
            className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Link
            href="/customers"
            className={`px-3 py-1 rounded-md transition-colors ${isActive === undefined ? 'bg-surface-hover text-text-primary' : 'hover:bg-surface-hover'}`}
          >
            All
          </Link>
          <Link
            href="/customers?active=true"
            className={`px-3 py-1 rounded-md transition-colors ${isActive === true ? 'bg-surface-hover text-text-primary' : 'hover:bg-surface-hover'}`}
          >
            Active
          </Link>
          <Link
            href="/customers?active=false"
            className={`px-3 py-1 rounded-md transition-colors ${isActive === false ? 'bg-surface-hover text-text-primary' : 'hover:bg-surface-hover'}`}
          >
            Inactive
          </Link>
        </div>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No customers found"
          description={search ? 'Try adjusting your search terms' : 'Get started by adding your first customer'}
          action={
            !search && (
              <Link href="/customers/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-sm font-medium text-text-secondary">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/customers/${customer.id}`} className="group">
                          <div className="font-medium text-text-primary group-hover:text-primary">
                            {customer.name}
                          </div>
                          {customer.legal_name && customer.legal_name !== customer.name && (
                            <div className="text-sm text-text-secondary">{customer.legal_name}</div>
                          )}
                          {customer.vat_number && (
                            <div className="text-xs text-text-muted">{customer.vat_number}</div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {customer.email && (
                          <div className="flex items-center gap-1 text-sm text-text-secondary">
                            <Mail className="h-3.5 w-3.5" />
                            <a href={`mailto:${customer.email}`} className="hover:text-primary">
                              {customer.email}
                            </a>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="text-sm text-text-muted">{customer.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(customer.city || customer.country) && (
                          <div className="flex items-center gap-1 text-sm text-text-secondary">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>
                              {[customer.city, customer.country].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={customer.is_active ? 'success' : 'secondary'}>
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {customer.reverse_charge && (
                          <Badge variant="warning" className="ml-1">
                            RC
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CustomerActions customer={customer} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} customers
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link href={`/customers?page=${page - 1}${search ? `&search=${search}` : ''}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/customers?page=${page + 1}${search ? `&search=${search}` : ''}`}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
