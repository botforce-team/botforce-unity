'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { TimeEntryActions } from './actions'

interface TimeEntry {
  id: string
  date: string
  hours: number
  description: string | null
  status: string
  rejection_reason: string | null
  user_id: string
  profile?: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
  } | null
}

interface DayEntriesProps {
  date: string
  entries: TimeEntry[]
  isAdmin: boolean
  currentUserId: string
  statusStyles: Record<string, { bg: string; border: string; color: string }>
}

export function DayEntries({ date, entries, isAdmin, currentUserId, statusStyles }: DayEntriesProps) {
  const [expanded, setExpanded] = useState(false)

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours || 0), 0)
  const hasMultiple = entries.length > 1

  // Count entries by status for summary
  const statusCounts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // If only one entry, show it directly without expand/collapse
  if (!hasMultiple) {
    const entry = entries[0]
    const style = statusStyles[entry.status] || statusStyles.draft
    return (
      <div className="px-5 py-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] text-[rgba(232,236,255,0.7)]">
                {formatDate(entry.date)}
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                style={{
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  color: style.color,
                }}
              >
                {entry.status}
              </span>
            </div>
            {entry.description && (
              <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.6)]">
                {entry.description}
              </p>
            )}
            {isAdmin && entry.profile && (
              <p className="mt-1 text-[11px] text-[rgba(232,236,255,0.5)]">
                by {entry.profile.first_name || entry.profile.email}
              </p>
            )}
            {entry.status === 'rejected' && entry.rejection_reason && (
              <p className="mt-1 text-[12px] text-[#f87171]">
                Reason: {entry.rejection_reason}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 ml-4">
            <span className="text-[18px] font-bold text-white">
              {Number(entry.hours).toFixed(1)}h
            </span>
            {(entry.status === 'draft' || entry.status === 'rejected') && !isAdmin && entry.user_id === currentUserId && (
              <Link
                href={`/timesheets/${entry.id}/edit`}
                className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[rgba(255,255,255,0.8)]"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                Edit
              </Link>
            )}
            {entry.status === 'submitted' && isAdmin && (
              <TimeEntryActions entryId={entry.id} />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Multiple entries - show collapsible day summary
  return (
    <div>
      {/* Day Summary Row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-[rgba(255,255,255,0.02)] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
          )}
          <span className="text-[13px] text-[rgba(232,236,255,0.7)]">
            {formatDate(date)}
          </span>
          <span className="text-[11px] text-[rgba(232,236,255,0.5)]">
            ({entries.length} entries)
          </span>
          {/* Status badges summary */}
          <div className="flex gap-1.5 ml-2">
            {Object.entries(statusCounts).map(([status, count]) => {
              const style = statusStyles[status] || statusStyles.draft
              return (
                <span
                  key={status}
                  className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
                  style={{
                    background: style.bg,
                    border: `1px solid ${style.border}`,
                    color: style.color,
                  }}
                >
                  {count} {status}
                </span>
              )
            })}
          </div>
        </div>
        <span className="text-[16px] font-bold text-white">
          {totalHours.toFixed(1)}h
        </span>
      </button>

      {/* Expanded Entries */}
      {expanded && (
        <div
          className="ml-7 border-l"
          style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
        >
          {entries.map((entry) => {
            const style = statusStyles[entry.status] || statusStyles.draft
            return (
              <div
                key={entry.id}
                className="px-5 py-3 border-b last:border-0"
                style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                        style={{
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          color: style.color,
                        }}
                      >
                        {entry.status}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.6)]">
                        {entry.description}
                      </p>
                    )}
                    {isAdmin && entry.profile && (
                      <p className="mt-1 text-[11px] text-[rgba(232,236,255,0.5)]">
                        by {entry.profile.first_name || entry.profile.email}
                      </p>
                    )}
                    {entry.status === 'rejected' && entry.rejection_reason && (
                      <p className="mt-1 text-[12px] text-[#f87171]">
                        Reason: {entry.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <span className="text-[15px] font-semibold text-white">
                      {Number(entry.hours).toFixed(1)}h
                    </span>
                    {(entry.status === 'draft' || entry.status === 'rejected') && !isAdmin && entry.user_id === currentUserId && (
                      <Link
                        href={`/timesheets/${entry.id}/edit`}
                        className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[rgba(255,255,255,0.8)]"
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                        }}
                      >
                        Edit
                      </Link>
                    )}
                    {entry.status === 'submitted' && isAdmin && (
                      <TimeEntryActions entryId={entry.id} />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
