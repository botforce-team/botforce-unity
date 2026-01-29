'use client'

import { useState, useTransition } from 'react'
import { MoreHorizontal, Download, Trash2, Archive, FileText } from 'lucide-react'
import { Button } from '@/components/ui'
import { deleteAccountingExport, generateExportCSV, generateExportZip, getReceiptSignedUrls } from '@/app/actions/accounting-export'
import type { AccountingExport } from '@/types'

interface ExportActionsProps {
  export: AccountingExport
}

export function ExportActions({ export: exp }: ExportActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null)

  const handleDownloadCSV = () => {
    startTransition(async () => {
      const result = await generateExportCSV(exp.id)
      if (result.success && result.data) {
        // Create and download the CSV file
        const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${exp.name.replace(/\s+/g, '_')}_${exp.period_start}_${exp.period_end}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else {
        alert(result.error || 'Failed to generate export')
      }
      setIsOpen(false)
    })
  }

  const handleDownloadZip = async () => {
    setDownloadProgress('Preparing export...')

    try {
      // Get export data
      const result = await generateExportZip(exp.id)
      if (!result.success || !result.data) {
        alert(result.error || 'Failed to prepare export')
        setDownloadProgress(null)
        return
      }

      const { csvData, receipts } = result.data

      // Dynamically import JSZip
      setDownloadProgress('Loading ZIP library...')
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      // Add CSV file
      setDownloadProgress('Adding CSV data...')
      zip.file('accounting_export.csv', csvData)

      // Create folders
      const receiptsFolder = zip.folder('receipts')

      // Fetch and add receipt files
      if (receipts.length > 0 && receiptsFolder) {
        setDownloadProgress(`Fetching ${receipts.length} receipts...`)

        // Get signed URLs for all receipts
        const urlsResult = await getReceiptSignedUrls(receipts.map(r => r.storagePath))

        if (urlsResult.success && urlsResult.data) {
          for (let i = 0; i < receipts.length; i++) {
            const receipt = receipts[i]
            const signedUrl = urlsResult.data[receipt.storagePath]

            if (signedUrl) {
              setDownloadProgress(`Downloading receipt ${i + 1}/${receipts.length}...`)

              try {
                const response = await fetch(signedUrl)
                if (response.ok) {
                  const blob = await response.blob()
                  const ext = receipt.storagePath.split('.').pop() || 'jpg'
                  receiptsFolder.file(`expense_${receipt.expenseId}.${ext}`, blob)
                }
              } catch (err) {
                console.error(`Failed to fetch receipt ${receipt.expenseId}:`, err)
              }
            }
          }
        }
      }

      // Generate and download ZIP
      setDownloadProgress('Creating ZIP file...')
      const content = await zip.generateAsync({ type: 'blob' })

      const url = URL.createObjectURL(content)
      const link = document.createElement('a')
      link.href = url
      link.download = `${exp.name.replace(/\s+/g, '_')}_${exp.period_start}_${exp.period_end}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setDownloadProgress(null)
      setIsOpen(false)
    } catch (err) {
      console.error('Failed to create ZIP:', err)
      alert('Failed to create ZIP file')
      setDownloadProgress(null)
    }
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAccountingExport(exp.id)
      if (!result.success) {
        alert(result.error)
      }
      setShowDeleteConfirm(false)
      setIsOpen(false)
    })
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false)
              setShowDeleteConfirm(false)
            }}
          />
          <div className="absolute right-0 bottom-full z-50 mb-1 w-48 rounded-md border border-border bg-surface shadow-lg max-h-80 overflow-y-auto">
            {showDeleteConfirm ? (
              <div className="p-3">
                <p className="text-sm text-text-primary mb-3">Delete this export?</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-1">
                {exp.status === 'completed' && (
                  <>
                    <button
                      onClick={handleDownloadCSV}
                      disabled={isPending || !!downloadProgress}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
                    >
                      <FileText className="h-4 w-4" />
                      {isPending ? 'Generating...' : 'Download CSV'}
                    </button>
                    <button
                      onClick={handleDownloadZip}
                      disabled={isPending || !!downloadProgress}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" />
                      {downloadProgress || 'Download ZIP (with receipts)'}
                    </button>
                  </>
                )}
                {!exp.is_locked && (
                  <>
                    <hr className="my-1 border-border" />
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface-hover"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
