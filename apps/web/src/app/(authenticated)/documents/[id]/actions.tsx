'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { issueDocument, markDocumentPaid, deleteDocument } from '@/app/actions/documents'

interface Document {
  id: string
  status: string
  document_type: string
}

export function DocumentActions({ document }: { document: Document }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleIssue() {
    if (!confirm('Issue this invoice? This will assign a document number and lock the document.')) return
    setLoading(true)
    const result = await issueDocument(document.id)
    if (result.error) {
      alert(result.error)
    }
    setLoading(false)
    router.refresh()
  }

  async function handleMarkPaid() {
    if (!confirm('Mark this invoice as paid?')) return
    setLoading(true)
    const result = await markDocumentPaid(document.id)
    if (result.error) {
      alert(result.error)
    }
    setLoading(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this draft? This cannot be undone.')) return
    setLoading(true)
    const result = await deleteDocument(document.id)
    if (result.error) {
      alert(result.error)
      setLoading(false)
    } else {
      router.push('/documents')
    }
  }

  return (
    <div className="flex gap-3">
      {document.status === 'draft' && (
        <>
          <button
            onClick={handleIssue}
            disabled={loading}
            className="px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#1f5bff' }}
          >
            {loading ? 'Processing...' : 'Issue Invoice'}
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 rounded-[12px] text-[13px] font-medium text-[rgba(239,68,68,0.9)] disabled:opacity-50"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            Delete Draft
          </button>
        </>
      )}

      {document.status === 'issued' && (
        <button
          onClick={handleMarkPaid}
          disabled={loading}
          className="px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: '#22c55e' }}
        >
          {loading ? 'Processing...' : 'Mark as Paid'}
        </button>
      )}
    </div>
  )
}
