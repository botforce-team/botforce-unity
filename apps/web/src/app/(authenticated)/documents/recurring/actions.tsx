'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Play, Pause, Trash2, FileText, Loader2 } from 'lucide-react'
import {
  toggleRecurringTemplate,
  deleteRecurringTemplate,
  generateInvoiceFromTemplate,
} from '@/app/actions/recurring-invoices'

interface RecurringTemplateActionsProps {
  templateId: string
  isActive: boolean
}

export function RecurringTemplateActions({ templateId, isActive }: RecurringTemplateActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleToggle() {
    setLoading('toggle')
    const result = await toggleRecurringTemplate(templateId, !isActive)
    if (result.error) {
      alert(result.error)
    }
    setLoading(null)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this recurring invoice template? This cannot be undone.')) return
    setLoading('delete')
    const result = await deleteRecurringTemplate(templateId)
    if (result.error) {
      alert(result.error)
      setLoading(null)
    } else {
      router.refresh()
    }
  }

  async function handleGenerateNow() {
    if (!confirm('Generate an invoice from this template now?')) return
    setLoading('generate')
    const result = await generateInvoiceFromTemplate(templateId)
    if (result.error) {
      alert(result.error)
      setLoading(null)
    } else if (result.data) {
      router.push(`/documents/${(result.data as { id: string }).id}`)
    }
  }

  const buttonStyle = {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleGenerateNow}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[rgba(255,255,255,0.12)] disabled:opacity-50"
        style={buttonStyle}
        title="Generate invoice now"
      >
        {loading === 'generate' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        Generate Now
      </button>

      <Link
        href={`/documents/recurring/${templateId}/edit`}
        className="rounded-[8px] p-2 text-[rgba(232,236,255,0.6)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
        title="Edit template"
      >
        <Pencil className="h-4 w-4" />
      </Link>

      <button
        onClick={handleToggle}
        disabled={loading !== null}
        className="rounded-[8px] p-2 text-[rgba(232,236,255,0.6)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white disabled:opacity-50"
        title={isActive ? 'Pause template' : 'Activate template'}
      >
        {loading === 'toggle' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      <button
        onClick={handleDelete}
        disabled={loading !== null}
        className="rounded-[8px] p-2 text-[rgba(239,68,68,0.7)] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#ef4444] disabled:opacity-50"
        title="Delete template"
      >
        {loading === 'delete' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}
