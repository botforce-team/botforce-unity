'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveTimeEntry, rejectTimeEntry } from '@/app/actions/time-entries'

export function TimeEntryActions({ entryId }: { entryId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  async function handleApprove() {
    setLoading(true)
    const result = await approveTimeEntry(entryId)
    if (result.error) {
      alert(result.error)
    }
    setLoading(false)
    router.refresh()
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    setLoading(true)
    const result = await rejectTimeEntry(entryId, rejectReason)
    if (result.error) {
      alert(result.error)
    }
    setLoading(false)
    setShowRejectModal(false)
    router.refresh()
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[#22c55e] disabled:opacity-50"
          style={{
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
          }}
        >
          Approve
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[#ef4444] disabled:opacity-50"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
          }}
        >
          Reject
        </button>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.75)' }}
        >
          <div
            className="w-full max-w-md p-6 rounded-[18px]"
            style={{
              background: '#0b1020',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <h2 className="text-lg font-semibold text-white mb-4">Reject Time Entry</h2>
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Reason for rejection *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Please explain why this entry is being rejected..."
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none resize-none"
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={loading || !rejectReason.trim()}
                className="px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: '#ef4444' }}
              >
                {loading ? 'Rejecting...' : 'Reject Entry'}
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-[12px] text-[13px] text-[rgba(255,255,255,0.6)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
