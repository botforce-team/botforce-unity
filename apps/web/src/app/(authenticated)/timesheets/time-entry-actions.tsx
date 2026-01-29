'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Pencil, Trash2, Send, Check, X } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  deleteTimeEntry,
  submitTimeEntry,
  approveTimeEntry,
  rejectTimeEntry,
} from '@/app/actions/time-entries'
import type { TimeEntry } from '@/types'

interface TimeEntryActionsProps {
  entry: TimeEntry
  isAdmin?: boolean
}

export function TimeEntryActions({ entry, isAdmin }: TimeEntryActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await submitTimeEntry(entry.id)
      if (!result.success) {
        alert(result.error)
      }
      setIsOpen(false)
    })
  }

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveTimeEntry(entry.id)
      if (!result.success) {
        alert(result.error)
      }
      setIsOpen(false)
    })
  }

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    startTransition(async () => {
      const result = await rejectTimeEntry(entry.id, rejectReason)
      if (!result.success) {
        alert(result.error)
      }
      setShowRejectForm(false)
      setIsOpen(false)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteTimeEntry(entry.id)
      if (!result.success) {
        alert(result.error)
      }
      setShowDeleteConfirm(false)
      setIsOpen(false)
    })
  }

  const canEdit = entry.status === 'draft' || entry.status === 'rejected'
  const canSubmit = entry.status === 'draft'
  const canApprove = isAdmin && entry.status === 'submitted'
  const canDelete = entry.status === 'draft' || entry.status === 'rejected'

  // Debug: log to console
  console.log('TimeEntryActions:', { entryId: entry.id, status: entry.status, isAdmin, canApprove })

  return (
    <div className="relative" title={`isAdmin: ${isAdmin}, status: ${entry.status}`}>
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
              setShowRejectForm(false)
            }}
          />
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-md border border-border bg-surface shadow-lg">
            {showDeleteConfirm ? (
              <div className="p-3">
                <p className="text-sm text-text-primary mb-3">Delete this entry?</p>
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
            ) : showRejectForm ? (
              <div className="p-3">
                <p className="text-sm text-text-primary mb-2">Rejection reason:</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary mb-3"
                  rows={2}
                  placeholder="Enter reason..."
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRejectForm(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleReject}
                    disabled={isPending}
                  >
                    {isPending ? 'Rejecting...' : 'Reject'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-1">
                {canEdit && (
                  <Link
                    href={`/timesheets/${entry.id}/edit`}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                    onClick={() => setIsOpen(false)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>
                )}
                {canSubmit && (
                  <button
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Submit for Approval
                  </button>
                )}
                {canApprove && (
                  <>
                    <button
                      onClick={handleApprove}
                      disabled={isPending}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-success hover:bg-surface-hover disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface-hover"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </>
                )}
                {canDelete && (
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
                {!canEdit && !canSubmit && !canApprove && !canDelete && (
                  <div className="px-3 py-2 text-sm text-text-muted">
                    No actions available
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
