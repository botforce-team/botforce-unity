import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, FileText, Download } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'

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
        <p className="text-gray-600">No company access.</p>
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
        <p className="text-gray-600">You don't have access to documents.</p>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage invoices and credit notes
          </p>
        </div>
        {isAdmin && (
          <Link href="/documents/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{invoices.length}</div>
            <p className="text-sm text-muted-foreground">Total Invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {invoices.filter(d => d.status === 'draft').length}
            </div>
            <p className="text-sm text-muted-foreground">Draft</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {invoices.filter(d => d.status === 'issued').length}
            </div>
            <p className="text-sm text-muted-foreground">Unpaid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatCurrency(
                invoices
                  .filter(d => d.status === 'paid')
                  .reduce((sum, d) => sum + Number(d.total), 0)
              )}
            </div>
            <p className="text-sm text-muted-foreground">Paid Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-gray-600 py-8">
              No invoices yet.
              {isAdmin && ' Click "New Invoice" to create your first invoice.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Number</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Due Date</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((doc) => (
                    <tr key={doc.id} className="text-sm">
                      <td className="py-3">
                        <span className="font-medium">
                          {doc.document_number || 'Draft'}
                        </span>
                      </td>
                      <td className="py-3">{doc.customer?.name}</td>
                      <td className="py-3">
                        {doc.issue_date ? formatDate(doc.issue_date) : '-'}
                      </td>
                      <td className="py-3">
                        {doc.due_date ? formatDate(doc.due_date) : '-'}
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(Number(doc.total))}
                      </td>
                      <td className="py-3">
                        <Badge className={getStatusColor(doc.status)}>
                          {doc.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Link href={`/documents/${doc.id}`}>
                            <Button variant="ghost" size="sm">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </Link>
                          {doc.pdf_url && (
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
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

      {creditNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Credit Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Number</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {creditNotes.map((doc) => (
                    <tr key={doc.id} className="text-sm">
                      <td className="py-3">
                        <span className="font-medium">
                          {doc.document_number || 'Draft'}
                        </span>
                      </td>
                      <td className="py-3">{doc.customer?.name}</td>
                      <td className="py-3">
                        {doc.issue_date ? formatDate(doc.issue_date) : '-'}
                      </td>
                      <td className="py-3 text-right font-medium text-red-600">
                        -{formatCurrency(Number(doc.total))}
                      </td>
                      <td className="py-3">
                        <Badge className={getStatusColor(doc.status)}>
                          {doc.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Link href={`/documents/${doc.id}`}>
                          <Button variant="ghost" size="sm">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
