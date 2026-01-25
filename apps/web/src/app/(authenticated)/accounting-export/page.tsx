import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Download, Lock, FileText } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'

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
        <p className="text-gray-600">No company access.</p>
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
        <p className="text-gray-600">You don't have access to accounting exports.</p>
      </div>
    )
  }

  // Fetch exports
  const { data: exports } = await supabase
    .from('accounting_exports')
    .select(`
      *,
      created_by_profile:profiles!accounting_exports_created_by_fkey(email, first_name, last_name)
    `)
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })
    .limit(20)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting Export</h1>
          <p className="mt-1 text-sm text-gray-600">
            Generate monthly export packages for your accountant
          </p>
        </div>
        <Link href="/accounting-export/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Export
          </Button>
        </Link>
      </div>

      {/* Current Month Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Current Month: {monthName}</CardTitle>
          <CardDescription>
            Documents ready for export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold">{invoiceCount || 0}</div>
              <p className="text-sm text-muted-foreground">Invoices</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold">{expenseCount || 0}</div>
              <p className="text-sm text-muted-foreground">Approved Expenses</p>
            </div>
            <div className="rounded-lg border p-4 flex items-center justify-center">
              <Link href={`/accounting-export/new?month=${startOfMonth.toISOString().split('T')[0]}`}>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Preview Export
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
          <CardDescription>
            Previously generated export packages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!exports || exports.length === 0 ? (
            <p className="text-center text-gray-600 py-8">
              No exports yet. Create your first export to generate a package for your accountant.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Period</th>
                    <th className="pb-3 font-medium">Created</th>
                    <th className="pb-3 font-medium">Invoices</th>
                    <th className="pb-3 font-medium">Expenses</th>
                    <th className="pb-3 font-medium text-right">Revenue</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {exports.map((exp) => (
                    <tr key={exp.id} className="text-sm">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{exp.name}</span>
                          {exp.is_locked && (
                            <Lock className="h-3 w-3 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        {formatDate(exp.period_start)} - {formatDate(exp.period_end)}
                      </td>
                      <td className="py-3">
                        <div>
                          {formatDate(exp.created_at)}
                          <p className="text-xs text-gray-500">
                            by {exp.created_by_profile?.first_name || exp.created_by_profile?.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-3">{exp.invoice_count}</td>
                      <td className="py-3">{exp.expense_count}</td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(Number(exp.total_revenue))}
                      </td>
                      <td className="py-3">
                        <Badge className={
                          exp.status === 'completed' ? 'bg-green-100 text-green-800' :
                          exp.status === 'failed' ? 'bg-red-100 text-red-800' :
                          exp.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {exp.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Link href={`/accounting-export/${exp.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          {exp.zip_file_id && (
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
    </div>
  )
}
