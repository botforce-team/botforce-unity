'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, CreditCard, Ban, Trash2, Mail, Bell, RefreshCw, Link2 } from 'lucide-react'
import { Button, Input, Label } from '@/components/ui'
import {
  issueDocument,
  markDocumentPaid,
  cancelDocument,
  deleteDocument,
  refreshDocumentCompanySnapshot,
  autoDetectDocumentProject,
} from '@/app/actions/documents'
import { sendInvoiceEmail, sendPaymentReminder } from '@/app/actions/email'
import type { Document } from '@/types'

interface DocumentStatusActionsProps {
  document: Document
}

export function DocumentStatusActions({ document }: DocumentStatusActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentReference, setPaymentReference] = useState('')

  const handleIssue = () => {
    startTransition(async () => {
      const result = await issueDocument(document.id)
      if (!result.success) {
        alert(result.error)
      }
    })
  }

  const handleMarkPaid = () => {
    startTransition(async () => {
      const result = await markDocumentPaid(document.id, paidDate, paymentReference || undefined)
      if (!result.success) {
        alert(result.error)
      }
      setShowPaymentModal(false)
    })
  }

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelDocument(document.id)
      if (!result.success) {
        alert(result.error)
      }
      setShowCancelModal(false)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteDocument(document.id)
      if (result.success) {
        router.push('/documents')
      } else {
        alert(result.error)
      }
    })
  }

  const handleSendEmail = () => {
    startTransition(async () => {
      const result = await sendInvoiceEmail(document.id)
      if (result.success) {
        alert('Invoice sent successfully!')
      } else {
        alert(result.error || 'Failed to send email')
      }
    })
  }

  const handleSendReminder = () => {
    startTransition(async () => {
      const result = await sendPaymentReminder(document.id)
      if (result.success) {
        alert('Payment reminder sent!')
      } else {
        alert(result.error || 'Failed to send reminder')
      }
    })
  }

  const handleRefreshCompanyInfo = () => {
    startTransition(async () => {
      const result = await refreshDocumentCompanySnapshot(document.id)
      if (result.success) {
        alert('Company info updated! The document now includes your current logo and bank details.')
      } else {
        alert(result.error || 'Failed to refresh company info')
      }
    })
  }

  const handleLinkProject = () => {
    startTransition(async () => {
      const result = await autoDetectDocumentProject(document.id)
      if (result.success) {
        alert('Project linked! The document now shows the project reference.')
      } else {
        alert(result.error || 'Failed to link project')
      }
    })
  }

  const canIssue = document.status === 'draft'
  const canMarkPaid = document.status === 'issued'
  const canCancel = document.status === 'draft' || document.status === 'issued'
  const canDelete = document.status === 'draft'
  const canSendEmail = ['issued', 'paid'].includes(document.status)
  const canSendReminder = document.status === 'issued' && document.document_type === 'invoice'
  const canRefreshCompanyInfo = document.status !== 'cancelled'
  const canLinkProject = !document.project_id && document.status !== 'cancelled'

  if (!canIssue && !canMarkPaid && !canCancel && !canDelete && !canSendEmail && !canSendReminder && !canRefreshCompanyInfo && !canLinkProject) {
    return null
  }

  return (
    <>
      <div className="flex gap-2">
        {canIssue && (
          <Button onClick={handleIssue} disabled={isPending}>
            <Send className="mr-2 h-4 w-4" />
            {isPending ? 'Issuing...' : 'Issue'}
          </Button>
        )}
        {canSendEmail && (
          <Button variant="outline" onClick={handleSendEmail} disabled={isPending}>
            <Mail className="mr-2 h-4 w-4" />
            Send Email
          </Button>
        )}
        {canSendReminder && (
          <Button variant="outline" onClick={handleSendReminder} disabled={isPending}>
            <Bell className="mr-2 h-4 w-4" />
            Send Reminder
          </Button>
        )}
        {canRefreshCompanyInfo && (
          <Button variant="outline" onClick={handleRefreshCompanyInfo} disabled={isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Update Company Info
          </Button>
        )}
        {canLinkProject && (
          <Button variant="outline" onClick={handleLinkProject} disabled={isPending}>
            <Link2 className="mr-2 h-4 w-4" />
            Link Project
          </Button>
        )}
        {canMarkPaid && (
          <Button onClick={() => setShowPaymentModal(true)} disabled={isPending}>
            <CreditCard className="mr-2 h-4 w-4" />
            Mark Paid
          </Button>
        )}
        {canCancel && (
          <Button variant="outline" onClick={() => setShowCancelModal(true)} disabled={isPending}>
            <Ban className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        )}
        {canDelete && (
          <Button variant="danger" onClick={() => setShowDeleteModal(true)} disabled={isPending}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPaymentModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-medium text-text-primary mb-4">Record Payment</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paid_date">Payment Date</Label>
                <Input
                  id="paid_date"
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_ref">Reference (optional)</Label>
                <Input
                  id="payment_ref"
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g., Bank transfer, Check #123"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button onClick={handleMarkPaid} disabled={isPending}>
                  {isPending ? 'Saving...' : 'Mark as Paid'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCancelModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-medium text-text-primary mb-2">Cancel Document</h3>
            <p className="text-sm text-text-secondary mb-6">
              Are you sure you want to cancel this {document.document_type === 'invoice' ? 'invoice' : 'credit note'}?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={isPending}>
                Back
              </Button>
              <Button variant="danger" onClick={handleCancel} disabled={isPending}>
                {isPending ? 'Cancelling...' : 'Cancel Document'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-medium text-text-primary mb-2">Delete Document</h3>
            <p className="text-sm text-text-secondary mb-6">
              Are you sure you want to delete this draft? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={isPending}>
                {isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
