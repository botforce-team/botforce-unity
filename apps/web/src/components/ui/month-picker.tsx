'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

const MONTHS_DE = [
  'Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
]

const MONTHS_FULL_DE = [
  'Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
]

interface MonthPickerProps {
  value?: string // Format: "2024-01"
  onChange: (value: string) => void
  minDate?: string
  maxDate?: string
  className?: string
  placeholder?: string
}

export function MonthPicker({
  value,
  onChange,
  minDate,
  maxDate,
  className,
  placeholder = 'Monat wählen',
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Parse current value or default to current month
  const now = new Date()
  const [viewYear, setViewYear] = useState(() => {
    if (value) {
      return parseInt(value.split('-')[0], 10)
    }
    return now.getFullYear()
  })

  const selectedYear = value ? parseInt(value.split('-')[0], 10) : null
  const selectedMonth = value ? parseInt(value.split('-')[1], 10) : null

  const handleMonthSelect = (month: number) => {
    const yearMonth = `${viewYear}-${String(month).padStart(2, '0')}`
    onChange(yearMonth)
    setIsOpen(false)
  }

  const isMonthDisabled = (month: number) => {
    const yearMonth = `${viewYear}-${String(month).padStart(2, '0')}`
    if (minDate && yearMonth < minDate) return true
    if (maxDate && yearMonth > maxDate) return true
    return false
  }

  const displayValue = value
    ? `${MONTHS_FULL_DE[selectedMonth! - 1]} ${selectedYear}`
    : placeholder

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <span className={!value ? 'text-text-muted' : ''}>{displayValue}</span>
        <ChevronRight className={cn('h-4 w-4 text-text-muted transition-transform', isOpen && 'rotate-90')} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 rounded-md border border-border bg-background p-3 shadow-lg">
          {/* Year Navigation */}
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setViewYear(viewYear - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{viewYear}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setViewYear(viewYear + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-1">
            {MONTHS_DE.map((month, index) => {
              const monthNum = index + 1
              const isSelected = selectedYear === viewYear && selectedMonth === monthNum
              const isDisabled = isMonthDisabled(monthNum)
              const isCurrent = now.getFullYear() === viewYear && now.getMonth() === index

              return (
                <button
                  key={month}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleMonthSelect(monthNum)}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-sm transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-surface-hover',
                    isDisabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  {month}
                </button>
              )
            })}
          </div>

          {/* Quick Actions */}
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
                const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
                onChange(`${prevYear}-${String(prevMonth).padStart(2, '0')}`)
                setIsOpen(false)
              }}
            >
              Letzter Monat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                onChange(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
                setIsOpen(false)
              }}
            >
              Aktueller Monat
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { MONTHS_DE, MONTHS_FULL_DE }
