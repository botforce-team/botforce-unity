'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Pencil, Trash2, Send, Check, X } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  deleteExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
} from '@/app/actions/expenses'
import type { Expense } from '@/types'

interface ExpenseActionsProps {
  expense: Expense
  isAdmin?: boolean
}

export function ExpenseActions({ expense, isAdmin }: ExpenseActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await submitExpense(expense.id)
      if (!result.success) {
        alert(result.error)
      }
      setIsOpen(false)
    })
  }

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveExpense(expense.id)
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
      const result = await rejectExpense(expense.id, rejectReason)
      if (!result.success) {
        alert(result.error)
      }
      setShowRejectForm(false)
      setIsOpen(false)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteExpense(expense.id)
      if (!result.success) {
        alert(result.error)
      }
      setShowDeleteConfirm(false)
      setIsOpen(false)
    })
  }

  const canEdit = expense.status === 'draft' || expense.status === 'rejected'
  const canSubmit = expense.status === 'draft'
  const canApprove = isAdmin && expense.status === 'submitted'
  const canDelete = expense.status === 'draft' || expense.status === 'rejected'

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
              setShowRejectForm(false)
            }}
          />
          <div className="absolute right-0 bottom-full z-50 mb-1 w-56 rounded-md border border-border bg-surface shadow-lg max-h-80 overflow-y-auto">
            {showDeleteConfirm ? (
              <div className="p-3">
                <p className="text-sm text-text-primary mb-3">Delete this expense?</p>
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
                    href={`/expenses/${expense.id}/edit`}
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
