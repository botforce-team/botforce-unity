'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui'
import { getYearMonthKey, getMonthYearDisplay, formatDate } from '@/lib/utils'
import { TimeEntryActions } from './time-entry-actions'
import type { TimeEntry, TimeEntryStatus } from '@/types'

interface TimesheetGroupedViewProps {
  entries: (TimeEntry & { project?: { name: string; code: string } })[]
  isAdmin: boolean
}

interface MonthGroup {
  entries: (TimeEntry & { project?: { name: string; code: string } })[]
  totalHours: number
  statusCounts: Record<TimeEntryStatus, number>
}

interface YearGroup {
  months: Record<string, MonthGroup>
  totalHours: number
}

const statusColors: Record<string, 'secondary' | 'info' | 'success' | 'danger' | 'warning'> = {
  draft: 'secondary',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  invoiced: 'warning',
}

export function TimesheetGroupedView({ entries, isAdmin }: TimesheetGroupedViewProps) {
  // Group entries by year and month
  const groupedData = useMemo(() => {
    const grouped: Record<string, YearGroup> = {}

    entries.forEach((entry) => {
      const yearMonth = getYearMonthKey(entry.date)
      const year = yearMonth.split('-')[0]
      const month = yearMonth.split('-')[1]

      if (!grouped[year]) {
        grouped[year] = { months: {}, totalHours: 0 }
      }
      if (!grouped[year].months[month]) {
        grouped[year].months[month] = {
          entries: [],
          totalHours: 0,
          statusCounts: { draft: 0, submitted: 0, approved: 0, rejected: 0, invoiced: 0 },
        }
      }

      grouped[year].months[month].entries.push(entry)
      grouped[year].months[month].totalHours += entry.hours || 0
      grouped[year].months[month].statusCounts[entry.status]++
      grouped[year].totalHours += entry.hours || 0
    })

    // Sort entries within each month by date (newest first)
    Object.values(grouped).forEach((yearGroup) => {
      Object.values(yearGroup.months).forEach((monthGroup) => {
        monthGroup.entries.sort((a, b) => b.date.localeCompare(a.date))
      })
    })

    return grouped
  }, [entries])

  const years = Object.keys(groupedData).sort((a, b) => b.localeCompare(a))

  // Current year and month for default expanded state
  const now = new Date()
  const currentYear = now.getFullYear().toString()
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0')

  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set([currentYear]))
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    new Set([`${currentYear}-${currentMonth}`])
  )

  const toggleYear = (year: string) => {
    const newSet = new Set(expandedYears)
    if (newSet.has(year)) {
      newSet.delete(year)
    } else {
      newSet.add(year)
    }
    setExpandedYears(newSet)
  }

  const toggleMonth = (yearMonth: string) => {
    const newSet = new Set(expandedMonths)
    if (newSet.has(yearMonth)) {
      newSet.delete(yearMonth)
    } else {
      newSet.add(yearMonth)
    }
    setExpandedMonths(newSet)
  }

  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.slice(0, 5)
  }

  const formatShortDate = (date: string) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) {
      return 'Heute'
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Gestern'
    }
    return new Intl.DateTimeFormat('de-AT', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    }).format(d)
  }

  return (
    <div className="space-y-2">
      {years.map((year) => {
        const yearData = groupedData[year]
        const isYearExpanded = expandedYears.has(year)
        const months = Object.keys(yearData.months).sort((a, b) => b.localeCompare(a))

        return (
          <div key={year} className="rounded-lg border border-border bg-surface overflow-hidden">
            {/* Year Header */}
            <button
              onClick={() => toggleYear(year)}
              className="flex w-full items-center justify-between px-4 py-3 bg-surface-hover hover:bg-surface-active transition-colors"
            >
              <div className="flex items-center gap-2">
                {isYearExpanded ? (
                  <ChevronDown className="h-4 w-4 text-text-muted" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-text-muted" />
                )}
                <span className="font-semibold text-lg">{year}</span>
              </div>
              <span className="text-sm text-text-secondary">
                {yearData.totalHours.toFixed(1)} Stunden
              </span>
            </button>

            {/* Months */}
            {isYearExpanded && (
              <div className="divide-y divide-border">
                {months.map((month) => {
                  const yearMonth = `${year}-${month}`
                  const monthData = yearData.months[month]
                  const isMonthExpanded = expandedMonths.has(yearMonth)

                  return (
                    <div key={yearMonth}>
                      {/* Month Header */}
                      <button
                        onClick={() => toggleMonth(yearMonth)}
                        className="flex w-full items-center justify-between px-4 py-2 hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isMonthExpanded ? (
                            <ChevronDown className="h-3 w-3 text-text-muted" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-text-muted" />
                          )}
                          <Calendar className="h-4 w-4 text-text-muted" />
                          <span className="font-medium">{getMonthYearDisplay(yearMonth)}</span>
                          <span className="text-xs text-text-muted">
                            ({monthData.entries.length} Einträge)
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Status Summary */}
                          <div className="flex items-center gap-1">
                            {monthData.statusCounts.draft > 0 && (
                              <Badge variant="secondary" className="text-xs px-1.5">
                                {monthData.statusCounts.draft}
                              </Badge>
                            )}
                            {monthData.statusCounts.submitted > 0 && (
                              <Badge variant="info" className="text-xs px-1.5">
                                {monthData.statusCounts.submitted}
                              </Badge>
                            )}
                            {monthData.statusCounts.approved > 0 && (
                              <Badge variant="success" className="text-xs px-1.5">
                                {monthData.statusCounts.approved}
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm font-medium">
                            {monthData.totalHours.toFixed(1)}h
                          </span>
                        </div>
                      </button>

                      {/* Entries */}
                      {isMonthExpanded && (
                        <div className="bg-background">
                          {monthData.entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-hover transition-colors border-t border-border/50"
                            >
                              {/* Date */}
                              <span className="w-20 shrink-0 text-text-muted text-xs">
                                {formatShortDate(entry.date)}
                              </span>

                              {/* Project */}
                              <Link
                                href={`/projects/${entry.project_id}`}
                                className="w-24 shrink-0 font-medium text-primary hover:underline truncate"
                                title={entry.project?.name}
                              >
                                {entry.project?.code || 'N/A'}
                              </Link>

                              {/* Description */}
                              <span
                                className="flex-1 text-text-secondary truncate"
                                title={entry.description || undefined}
                              >
                                {entry.description || '-'}
                              </span>

                              {/* Time (if recorded) */}
                              {entry.start_time && entry.end_time && (
                                <span className="text-xs text-text-muted shrink-0">
                                  {formatTime(entry.start_time)}-{formatTime(entry.end_time)}
                                </span>
                              )}

                              {/* Hours */}
                              <span className="w-12 shrink-0 text-right font-medium">
                                {entry.hours}h
                              </span>

                              {/* Billable indicator */}
                              {!entry.is_billable && (
                                <span className="text-xs text-text-muted shrink-0">NB</span>
                              )}

                              {/* Status */}
                              <Badge
                                variant={statusColors[entry.status]}
                                className="shrink-0 text-xs"
                              >
                                {entry.status}
                              </Badge>

                              {/* Actions */}
                              <div className="shrink-0">
                                <TimeEntryActions entry={entry} isAdmin={isAdmin} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
