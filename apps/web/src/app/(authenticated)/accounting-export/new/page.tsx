'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, FileText, Receipt, Download, Loader2, Check } from 'lucide-react'
import Link from 'next/link'
import { getExportPreview, createAccountingExport, type ExportPreview } from '@/app/actions/finance'
import { formatCurrency } from '@/lib/utils'

export default function NewAccountingExportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const monthParam = searchParams.get('month')

  const today = new Date()
  const defaultYear = monthParam ? new Date(monthParam).getFullYear() : today.getFullYear()
  const defaultMonth = monthParam ? new Date(monthParam).getMonth() + 1 : today.getMonth() + 1

  const [year, setYear] = useState(defaultYear)
  const [month, setMonth] = useState(defaultMonth)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  }

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  // Load preview when year/month changes
  useEffect(() => {
    async function loadPreview() {
      setIsLoading(true)
      setError(null)
      const result = await getExportPreview(year, month)
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setPreview(result.data)
        // Set default name
        const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        setName(`Export ${monthName}`)
      }
      setIsLoading(false)
    }
    loadPreview()
  }, [year, month])

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a name for the export')
      return
    }

    setIsCreating(true)
    setError(null)

    const result = await createAccountingExport(year, month, name, description)
    if (result.error) {
      setError(result.error)
      setIsCreating(false)
    } else if (result.data) {
      setSuccess(true)
      // Trigger download of CSV
      const blob = new Blob([result.data.csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name.replace(/\s+/g, '_')}.csv`
      a.click()
      URL.revokeObjectURL(url)

      // Redirect after delay
      setTimeout(() => {
        router.push('/accounting-export')
      }, 2000)
    }
  }

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ]

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i)

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full mb-4" style={{ background: 'rgba(34, 197, 94, 0.2)' }}>
          <Check className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Export Created Successfully!</h1>
        <p className="text-[rgba(232,236,255,0.6)]">Your CSV file has been downloaded. Redirecting...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/accounting-export"
          className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-[rgba(232,236,255,0.6)]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Create Accounting Export</h1>
          <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
            Generate a monthly export package for your accountant
          </p>
        </div>
      </div>

      {error && (
        <div
          className="p-4 rounded-lg text-[13px]"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      {/* Period Selection */}
      <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">Select Period</h2>
        </div>
        <div className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[12px] font-medium text-[rgba(232,236,255,0.7)] mb-2">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-[14px] text-white focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                style={inputStyle}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value} className="bg-[#0f172a]">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[rgba(232,236,255,0.7)] mb-2">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-[14px] text-white focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                style={inputStyle}
              >
                {years.map((y) => (
                  <option key={y} value={y} className="bg-[#0f172a]">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Export Details */}
      <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">Export Details</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[rgba(232,236,255,0.7)] mb-2">
              Export Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Export January 2026"
              className="w-full px-3 py-2 rounded-lg text-[14px] text-white placeholder:text-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[rgba(232,236,255,0.7)] mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes for your accountant..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-[14px] text-white placeholder:text-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff] resize-none"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      {isLoading ? (
        <div className="rounded-[18px] p-12 text-center" style={cardStyle}>
          <Loader2 className="h-8 w-8 text-[#1f5bff] animate-spin mx-auto mb-3" />
          <p className="text-[rgba(232,236,255,0.6)]">Loading preview...</p>
        </div>
      ) : preview && (
        <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
          <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <h2 className="text-[15px] font-semibold text-white">Export Preview</h2>
            <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
              {preview.periodStart} to {preview.periodEnd}
            </p>
          </div>
          <div className="p-5">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div
                className="p-4 rounded-[12px]"
                style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-[#22c55e]" />
                  <span className="text-[11px] text-[rgba(232,236,255,0.5)] uppercase tracking-wide">Invoices</span>
                </div>
                <div className="text-2xl font-bold text-white">{preview.invoices.length}</div>
              </div>
              <div
                className="p-4 rounded-[12px]"
                style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-[#f59e0b]" />
                  <span className="text-[11px] text-[rgba(232,236,255,0.5)] uppercase tracking-wide">Credit Notes</span>
                </div>
                <div className="text-2xl font-bold text-white">{preview.creditNotes.length}</div>
              </div>
              <div
                className="p-4 rounded-[12px]"
                style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="h-4 w-4 text-[#ef4444]" />
                  <span className="text-[11px] text-[rgba(232,236,255,0.5)] uppercase tracking-wide">Expenses</span>
                </div>
                <div className="text-2xl font-bold text-white">{preview.expenses.length}</div>
              </div>
              <div
                className="p-4 rounded-[12px]"
                style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-[rgba(232,236,255,0.5)] uppercase tracking-wide">Net Revenue</span>
                </div>
                <div className="text-2xl font-bold text-[#22c55e]">{formatCurrency(preview.totalRevenue)}</div>
              </div>
            </div>

            {/* Invoices List */}
            {preview.invoices.length > 0 && (
              <div className="mb-6">
                <h3 className="text-[13px] font-semibold text-white mb-3">Invoices</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[rgba(232,236,255,0.5)]">
                        <th className="pb-2">Number</th>
                        <th className="pb-2">Customer</th>
                        <th className="pb-2">Date</th>
                        <th className="pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.invoices.map((inv) => (
                        <tr key={inv.id} className="text-[rgba(232,236,255,0.7)] border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                          <td className="py-2 font-medium text-white">{inv.documentNumber}</td>
                          <td className="py-2">{inv.customerName}</td>
                          <td className="py-2">{inv.issueDate}</td>
                          <td className="py-2 text-right">{formatCurrency(inv.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expenses List */}
            {preview.expenses.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-white mb-3">Expenses</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[rgba(232,236,255,0.5)]">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Category</th>
                        <th className="pb-2">Vendor/User</th>
                        <th className="pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.expenses.map((exp) => (
                        <tr key={exp.id} className="text-[rgba(232,236,255,0.7)] border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                          <td className="py-2">{exp.date}</td>
                          <td className="py-2 capitalize">{exp.category}</td>
                          <td className="py-2">{exp.merchant || exp.userName}</td>
                          <td className="py-2 text-right">{formatCurrency(exp.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.invoices.length === 0 && preview.expenses.length === 0 && (
              <p className="text-center text-[rgba(232,236,255,0.5)] py-8">
                No documents found for this period.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link
          href="/accounting-export"
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-[rgba(232,236,255,0.7)]"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        >
          Cancel
        </Link>
        <button
          onClick={handleCreate}
          disabled={isCreating || isLoading || !preview || (preview.invoices.length === 0 && preview.expenses.length === 0)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#1f5bff' }}
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Create & Download Export
            </>
          )}
        </button>
      </div>
    </div>
  )
}
