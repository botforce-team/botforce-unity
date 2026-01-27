'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  approveExpense,
  rejectExpense,
  submitExpense,
  deleteExpense,
  getReceiptUrl,
  uploadReceipt,
} from '@/app/actions/expenses'
import { Eye, Upload, Loader2 } from 'lucide-react'

export function SubmitExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    const result = await submitExpense(expenseId)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleSubmit}
      disabled={loading}
      className="rounded-[8px] px-3 py-1 text-[12px] font-medium text-[#1f5bff] disabled:opacity-50"
      style={{
        background: 'rgba(31, 91, 255, 0.12)',
        border: '1px solid rgba(31, 91, 255, 0.35)',
      }}
    >
      {loading ? '...' : 'Submit'}
    </button>
  )
}

export function ApproveExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleApprove() {
    setLoading(true)
    const result = await approveExpense(expenseId)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="rounded-[8px] px-3 py-1 text-[12px] font-medium text-[#22c55e] disabled:opacity-50"
      style={{
        background: 'rgba(34, 197, 94, 0.12)',
        border: '1px solid rgba(34, 197, 94, 0.35)',
      }}
    >
      {loading ? '...' : 'Approve'}
    </button>
  )
}

export function RejectExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [reason, setReason] = useState('')

  async function handleReject() {
    if (!showReasonInput) {
      setShowReasonInput(true)
      return
    }

    if (!reason.trim()) {
      alert('Please provide a rejection reason')
      return
    }

    setLoading(true)
    const result = await rejectExpense(expenseId, reason)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
    setLoading(false)
    setShowReasonInput(false)
    setReason('')
  }

  if (showReasonInput) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason"
          className="w-32 rounded-[6px] px-2 py-1 text-[11px]"
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e8ecff',
          }}
          autoFocus
        />
        <button
          onClick={handleReject}
          disabled={loading}
          className="rounded-[6px] px-2 py-1 text-[11px] font-medium text-[#ef4444] disabled:opacity-50"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
          }}
        >
          {loading ? '...' : 'Confirm'}
        </button>
        <button
          onClick={() => {
            setShowReasonInput(false)
            setReason('')
          }}
          className="rounded-[6px] px-2 py-1 text-[11px] text-[rgba(232,236,255,0.6)]"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleReject}
      disabled={loading}
      className="rounded-[8px] px-3 py-1 text-[12px] font-medium text-[#ef4444] disabled:opacity-50"
      style={{
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
      }}
    >
      Reject
    </button>
  )
}

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deleteExpense(expenseId)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
    setLoading(false)
    setShowConfirm(false)
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-[6px] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
          style={{ background: '#ef4444' }}
        >
          {loading ? '...' : 'Delete'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="rounded-[6px] px-2 py-1 text-[11px] text-[rgba(232,236,255,0.6)]"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="rounded-[8px] px-3 py-1 text-[12px] font-medium text-[rgba(232,236,255,0.5)] hover:text-[#ef4444]"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      Delete
    </button>
  )
}

export function ViewReceiptButton({ expenseId }: { expenseId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleView() {
    setLoading(true)
    const result = await getReceiptUrl(expenseId)
    setLoading(false)

    if (result.error) {
      alert(result.error)
      return
    }

    if (result.url) {
      window.open(result.url, '_blank')
    }
  }

  return (
    <button
      onClick={handleView}
      disabled={loading}
      className="rounded-[6px] p-1.5 text-[#22c55e] transition-colors hover:bg-[rgba(34,197,94,0.15)] disabled:opacity-50"
      title="View receipt"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}

export function UploadReceiptButton({ expenseId }: { expenseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
  const MAX_SIZE = 5 * 1024 * 1024

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF')
      return
    }

    if (file.size > MAX_SIZE) {
      alert('File too large. Maximum size is 5MB')
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.set('file', file)

    const result = await uploadReceipt(expenseId, formData)
    setLoading(false)

    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="rounded-[6px] p-1.5 text-[rgba(232,236,255,0.4)] transition-colors hover:bg-[rgba(31,91,255,0.15)] hover:text-[#1f5bff] disabled:opacity-50"
        title="Upload receipt"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      </button>
    </>
  )
}
