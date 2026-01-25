'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveExpense, rejectExpense, submitExpense, deleteExpense } from '@/app/actions/expenses'

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
      className="px-3 py-1 rounded-[8px] text-[12px] font-medium text-[#1f5bff] disabled:opacity-50"
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
      className="px-3 py-1 rounded-[8px] text-[12px] font-medium text-[#22c55e] disabled:opacity-50"
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
          className="px-2 py-1 rounded-[6px] text-[11px] w-32"
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
          className="px-2 py-1 rounded-[6px] text-[11px] font-medium text-[#ef4444] disabled:opacity-50"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
          }}
        >
          {loading ? '...' : 'Confirm'}
        </button>
        <button
          onClick={() => { setShowReasonInput(false); setReason('') }}
          className="px-2 py-1 rounded-[6px] text-[11px] text-[rgba(232,236,255,0.6)]"
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
      className="px-3 py-1 rounded-[8px] text-[12px] font-medium text-[#ef4444] disabled:opacity-50"
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
          className="px-2 py-1 rounded-[6px] text-[11px] font-medium text-white disabled:opacity-50"
          style={{ background: '#ef4444' }}
        >
          {loading ? '...' : 'Delete'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="px-2 py-1 rounded-[6px] text-[11px] text-[rgba(232,236,255,0.6)]"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-3 py-1 rounded-[8px] text-[12px] font-medium text-[rgba(232,236,255,0.5)] hover:text-[#ef4444]"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      Delete
    </button>
  )
}
