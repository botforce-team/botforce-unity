'use client'

import { useState, useTransition } from 'react'
import { MoreHorizontal, Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { deleteAccountingExport, generateExportCSV } from '@/app/actions/accounting-export'
import type { AccountingExport } from '@/types'

interface ExportActionsProps {
  export: AccountingExport
}

export function ExportActions({ export: exp }: ExportActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDownload = () => {
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
          <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-border bg-surface shadow-lg">
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
                  <button
                    onClick={handleDownload}
                    disabled={isPending}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {isPending ? 'Generating...' : 'Download CSV'}
                  </button>
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
