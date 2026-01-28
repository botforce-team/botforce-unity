'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Pencil, Trash2, Send, Check, X, CreditCard, FileDown, Ban } from 'lucide-react'
import { Button, Input, Label } from '@/components/ui'
import {
  deleteDocument,
  issueDocument,
  markDocumentPaid,
  cancelDocument,
} from '@/app/actions/documents'
import type { Document } from '@/types'

interface DocumentActionsProps {
  document: Document
}

export function DocumentActions({ document }: DocumentActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentReference, setPaymentReference] = useState('')

  const handleIssue = () => {
    startTransition(async () => {
      const result = await issueDocument(document.id)
      if (!result.success) {
        alert(result.error)
      }
      setIsOpen(false)
    })
  }

  const handleMarkPaid = () => {
    startTransition(async () => {
      const result = await markDocumentPaid(document.id, paidDate, paymentReference || undefined)
      if (!result.success) {
        alert(result.error)
      }
      setShowPaymentForm(false)
      setIsOpen(false)
    })
  }

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelDocument(document.id)
      if (!result.success) {
        alert(result.error)
      }
      setShowCancelConfirm(false)
      setIsOpen(false)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteDocument(document.id)
      if (!result.success) {
        alert(result.error)
      }
      setShowDeleteConfirm(false)
      setIsOpen(false)
    })
  }

  const canEdit = document.status === 'draft'
  const canIssue = document.status === 'draft'
  const canMarkPaid = document.status === 'issued'
  const canCancel = document.status === 'draft' || document.status === 'issued'
  const canDelete = document.status === 'draft'

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
              setShowPaymentForm(false)
              setShowCancelConfirm(false)
            }}
          />
          <div className="absolute right-0 z-50 mt-1 w-64 rounded-md border border-border bg-surface shadow-lg">
            {showDeleteConfirm ? (
              <div className="p-3">
                <p className="text-sm text-text-primary mb-3">Delete this {document.document_type}?</p>
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
            ) : showCancelConfirm ? (
              <div className="p-3">
                <p className="text-sm text-text-primary mb-3">
                  Cancel this {document.document_type}? This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={isPending}
                  >
                    Back
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isPending}
                  >
                    {isPending ? 'Cancelling...' : 'Cancel Document'}
                  </Button>
                </div>
              </div>
            ) : showPaymentForm ? (
              <div className="p-3 space-y-3">
                <p className="text-sm font-medium text-text-primary">Record Payment</p>
                <div className="space-y-2">
                  <Label htmlFor="paid_date" className="text-xs">Payment Date</Label>
                  <Input
                    id="paid_date"
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_ref" className="text-xs">Reference (optional)</Label>
                  <Input
                    id="payment_ref"
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g., Bank transfer"
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPaymentForm(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleMarkPaid}
                    disabled={isPending}
                  >
                    {isPending ? 'Saving...' : 'Mark Paid'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-1">
                <Link
                  href={`/documents/${document.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                  onClick={() => setIsOpen(false)}
                >
                  <FileDown className="h-4 w-4" />
                  View Details
                </Link>
                {canEdit && (
                  <Link
                    href={`/documents/${document.id}/edit`}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                    onClick={() => setIsOpen(false)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>
                )}
                {canIssue && (
                  <button
                    onClick={handleIssue}
                    disabled={isPending}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-surface-hover disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Issue {document.document_type === 'invoice' ? 'Invoice' : 'Credit Note'}
                  </button>
                )}
                {canMarkPaid && (
                  <button
                    onClick={() => setShowPaymentForm(true)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-success hover:bg-surface-hover"
                  >
                    <CreditCard className="h-4 w-4" />
                    Mark as Paid
                  </button>
                )}
                {canCancel && (
                  <>
                    <hr className="my-1 border-border" />
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-warning hover:bg-surface-hover"
                    >
                      <Ban className="h-4 w-4" />
                      Cancel Document
                    </button>
                  </>
                )}
                {canDelete && (
                  <>
                    {!canCancel && <hr className="my-1 border-border" />}
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
