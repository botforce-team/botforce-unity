'use client'

import { useTransition } from 'react'
import { Send, Check } from 'lucide-react'
import { Button } from '@/components/ui'
import { submitMultipleTimeEntries, approveMultipleTimeEntries } from '@/app/actions/time-entries'

interface BulkActionsProps {
  draftIds: string[]
  submittedIds: string[]
  isAdmin: boolean
}

export function BulkActions({ draftIds, submittedIds, isAdmin }: BulkActionsProps) {
  const [isPending, startTransition] = useTransition()

  const handleSubmitAll = () => {
    if (draftIds.length === 0) return

    startTransition(async () => {
      const result = await submitMultipleTimeEntries(draftIds)
      if (!result.success) {
        alert(result.error)
      }
    })
  }

  const handleApproveAll = () => {
    if (submittedIds.length === 0) return

    startTransition(async () => {
      const result = await approveMultipleTimeEntries(submittedIds)
      if (!result.success) {
        alert(result.error)
      }
    })
  }

  const hasDrafts = draftIds.length > 0
  const hasSubmitted = submittedIds.length > 0 && isAdmin

  if (!hasDrafts && !hasSubmitted) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {hasDrafts && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSubmitAll}
          disabled={isPending}
        >
          <Send className="mr-2 h-4 w-4" />
          {isPending ? 'Submitting...' : `Submit All Draft (${draftIds.length})`}
        </Button>
      )}
      {hasSubmitted && (
        <Button
          variant="success"
          size="sm"
          onClick={handleApproveAll}
          disabled={isPending}
        >
          <Check className="mr-2 h-4 w-4" />
          {isPending ? 'Approving...' : `Approve All (${submittedIds.length})`}
        </Button>
      )}
    </div>
  )
}
