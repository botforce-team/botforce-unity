import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Pencil,
  Mail,
  Phone,
  MapPin,
  Building,
  CreditCard,
  Clock,
  FileText,
  FolderOpen
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { getCustomer } from '@/app/actions/customers'
import { createClient } from '@/lib/supabase/server'

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>
}

const taxRateLabels: Record<string, string> = {
  standard_20: '20% (Standard)',
  reduced_10: '10% (Reduced)',
  zero: '0% (Tax Exempt)',
  reverse_charge: 'Reverse Charge',
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params
  const customer = await getCustomer(id)

  if (!customer) {
    notFound()
  }

  const supabase = await createClient()

  // Fetch related projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, code, is_active')
    .eq('customer_id', id)
    .order('name')

  // Fetch recent documents
  const { data: documents } = await supabase
    .from('documents')
    .select('id, document_number, document_type, status, total, created_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          {customer.legal_name && customer.legal_name !== customer.name && (
            <p className="text-text-secondary">{customer.legal_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={customer.is_active ? 'success' : 'secondary'}>
            {customer.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Link href={`/customers/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="h-5 w-5 text-text-secondary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-text-muted" />
                <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-text-muted" />
                <a href={`tel:${customer.phone}`} className="hover:text-primary">
                  {customer.phone}
                </a>
              </div>
            )}
            {(customer.address_line1 || customer.city) && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-text-muted mt-0.5" />
                <div className="text-text-secondary">
                  {customer.address_line1 && <div>{customer.address_line1}</div>}
                  {customer.address_line2 && <div>{customer.address_line2}</div>}
                  {(customer.postal_code || customer.city) && (
                    <div>
                      {customer.postal_code} {customer.city}
                    </div>
                  )}
                  <div>{customer.country}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-text-secondary" />
              Billing Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.vat_number && (
              <div className="flex justify-between">
                <span className="text-text-secondary">VAT Number</span>
                <span className="font-medium">{customer.vat_number}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-text-secondary">Payment Terms</span>
              <span className="font-medium">{customer.payment_terms_days} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Tax Rate</span>
              <span className="font-medium">{taxRateLabels[customer.default_tax_rate]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Currency</span>
              <span className="font-medium">{customer.currency}</span>
            </div>
            {customer.tax_exempt && (
              <Badge variant="warning">Tax Exempt</Badge>
            )}
            {customer.reverse_charge && (
              <Badge variant="info">Reverse Charge</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-text-secondary" />
              Projects
            </CardTitle>
            <Link href={`/projects/new?customer=${id}`}>
              <Button variant="outline" size="sm">
                New Project
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {projects && projects.length > 0 ? (
              <ul className="space-y-2">
                {projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between rounded-md p-2 hover:bg-surface-hover"
                    >
                      <div>
                        <span className="font-medium">{project.name}</span>
                        <span className="ml-2 text-text-muted text-sm">{project.code}</span>
                      </div>
                      <Badge variant={project.is_active ? 'success' : 'secondary'} className="text-xs">
                        {project.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted text-sm">No projects yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-text-secondary" />
              Recent Documents
            </CardTitle>
            <Link href={`/documents/new?customer=${id}`}>
              <Button variant="outline" size="sm">
                New Invoice
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {documents && documents.length > 0 ? (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="flex items-center justify-between rounded-md p-2 hover:bg-surface-hover"
                    >
                      <div>
                        <span className="font-medium">
                          {doc.document_number || 'Draft'}
                        </span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {doc.document_type}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {new Intl.NumberFormat('de-AT', {
                            style: 'currency',
                            currency: 'EUR',
                          }).format(doc.total)}
                        </div>
                        <Badge
                          variant={
                            doc.status === 'paid'
                              ? 'success'
                              : doc.status === 'issued'
                              ? 'info'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {doc.status}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted text-sm">No documents yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {customer.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary whitespace-pre-wrap">{customer.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
