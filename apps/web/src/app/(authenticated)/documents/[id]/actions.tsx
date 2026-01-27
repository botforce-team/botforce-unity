'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'
import {
  issueDocument,
  markDocumentPaid,
  deleteDocument,
  generateDocumentPDF,
} from '@/app/actions/documents'

interface Document {
  id: string
  status: string
  document_type: string
}

export function DocumentActions({ document }: { document: Document }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleIssue() {
    if (!confirm('Issue this invoice? This will assign a document number and lock the document.'))
      return
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

  async function handleDownloadPDF() {
    setDownloading(true)
    const result = await generateDocumentPDF(document.id)

    if (result.error) {
      alert(result.error)
      setDownloading(false)
      return
    }

    if (result.data) {
      // Create blob from base64 and trigger download
      const byteCharacters = atob(result.data.base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })

      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = result.data.filename
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }

    setDownloading(false)
  }

  return (
    <div className="flex gap-3">
      {/* Download PDF - always available */}
      <button
        onClick={handleDownloadPDF}
        disabled={downloading}
        className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {downloading ? 'Generating...' : 'Download PDF'}
      </button>

      {document.status === 'draft' && (
        <>
          <button
            onClick={handleIssue}
            disabled={loading}
            className="rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#1f5bff' }}
          >
            {loading ? 'Processing...' : 'Issue Invoice'}
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded-[12px] px-4 py-2 text-[13px] font-medium text-[rgba(239,68,68,0.9)] disabled:opacity-50"
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
          className="rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: '#22c55e' }}
        >
          {loading ? 'Processing...' : 'Mark as Paid'}
        </button>
      )}
    </div>
  )
}
