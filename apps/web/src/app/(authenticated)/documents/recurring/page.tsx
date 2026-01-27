import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, RefreshCw, Pause, Play, Trash2, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { RecurringTemplateActions } from './actions'

interface CompanyMembership {
  company_id: string
  role: string
}

interface RecurringLine {
  id: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  tax_rate: string
}

interface RecurringTemplate {
  id: string
  name: string
  description: string | null
  frequency: string
  day_of_month: number | null
  next_issue_date: string | null
  last_issued_at: string | null
  is_active: boolean
  created_at: string
  customer: { name: string } | null
  lines: RecurringLine[]
}

function getFrequencyLabel(frequency: string) {
  switch (frequency) {
    case 'weekly':
      return 'Weekly'
    case 'biweekly':
      return 'Bi-weekly'
    case 'monthly':
      return 'Monthly'
    case 'quarterly':
      return 'Quarterly'
    case 'yearly':
      return 'Yearly'
    default:
      return frequency
  }
}

function calculateTemplateTotal(lines: RecurringLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0)
}

export default async function RecurringInvoicesPage() {
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

  if (!isAdmin) {
    return (
      <div className="py-12 text-center">
        <p className="text-[rgba(232,236,255,0.6)]">Only admins can manage recurring invoices.</p>
      </div>
    )
  }

  // Fetch recurring templates
  const { data: templatesData } = await supabase
    .from('recurring_invoice_templates')
    .select(
      `
      *,
      customer:customers(name),
      lines:recurring_invoice_lines(*)
    `
    )
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })

  const templates = (templatesData || []) as RecurringTemplate[]

  const activeTemplates = templates.filter((t) => t.is_active)
  const pausedTemplates = templates.filter((t) => !t.is_active)

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recurring Invoices</h1>
          <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
            Set up automatic invoice generation on a schedule
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/documents"
            className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-[13px] font-medium text-[rgba(255,255,255,0.8)]"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <FileText className="h-4 w-4" />
            All Documents
          </Link>
          <Link
            href="/documents/recurring/new"
            className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: '#1f5bff' }}
          >
            <Plus className="h-4 w-4" />
            New Template
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <div className="text-2xl font-bold text-white">{templates.length}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Total Templates</p>
        </div>
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <div className="text-2xl font-bold text-[#22c55e]">{activeTemplates.length}</div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Active</p>
        </div>
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <div className="text-2xl font-bold text-[rgba(255,255,255,0.5)]">
            {pausedTemplates.length}
          </div>
          <p className="text-[13px] text-[rgba(232,236,255,0.6)]">Paused</p>
        </div>
      </div>

      {/* Templates List */}
      <div className="overflow-hidden rounded-[18px]" style={cardStyle}>
        <div className="border-b p-5" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">Invoice Templates</h2>
        </div>
        <div className="p-5">
          {templates.length === 0 ? (
            <div className="py-12 text-center">
              <RefreshCw className="mx-auto h-12 w-12 text-[rgba(232,236,255,0.3)]" />
              <p className="mt-4 text-[14px] font-medium text-white">No recurring templates</p>
              <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.6)]">
                Create a template to automatically generate invoices on a schedule.
              </p>
              <Link
                href="/documents/recurring/new"
                className="mt-4 inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white"
                style={{ background: '#1f5bff' }}
              >
                <Plus className="h-4 w-4" />
                Create First Template
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => {
                const total = calculateTemplateTotal(template.lines)
                return (
                  <div
                    key={template.id}
                    className="rounded-[14px] p-4"
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-[14px] font-semibold text-white">{template.name}</h3>
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                            style={{
                              background: template.is_active
                                ? 'rgba(34, 197, 94, 0.12)'
                                : 'rgba(255, 255, 255, 0.08)',
                              border: template.is_active
                                ? '1px solid rgba(34, 197, 94, 0.35)'
                                : '1px solid rgba(255, 255, 255, 0.12)',
                              color: template.is_active ? '#22c55e' : 'rgba(255, 255, 255, 0.5)',
                            }}
                          >
                            {template.is_active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.6)]">
                          {template.customer?.name}
                        </p>
                        {template.description && (
                          <p className="mt-1 text-[12px] text-[rgba(232,236,255,0.5)]">
                            {template.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[16px] font-bold text-white">{formatCurrency(total)}</p>
                        <p className="text-[11px] text-[rgba(232,236,255,0.5)]">
                          {getFrequencyLabel(template.frequency)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="mt-4 flex items-center justify-between border-t pt-4"
                      style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
                    >
                      <div className="flex gap-6 text-[12px]">
                        <div>
                          <span className="text-[rgba(232,236,255,0.5)]">Next issue: </span>
                          <span className="font-medium text-white">
                            {template.next_issue_date
                              ? formatDate(template.next_issue_date)
                              : 'Not scheduled'}
                          </span>
                        </div>
                        {template.last_issued_at && (
                          <div>
                            <span className="text-[rgba(232,236,255,0.5)]">Last issued: </span>
                            <span className="text-[rgba(232,236,255,0.8)]">
                              {formatDate(template.last_issued_at)}
                            </span>
                          </div>
                        )}
                      </div>

                      <RecurringTemplateActions
                        templateId={template.id}
                        isActive={template.is_active}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
