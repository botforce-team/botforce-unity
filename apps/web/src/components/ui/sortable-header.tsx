'use client'

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

export type SortDirection = 'asc' | 'desc' | null

interface SortableHeaderProps {
  label: string
  sortKey: string
  currentSortKey: string | null
  currentSortDirection: SortDirection
  onSort: (key: string) => void
  className?: string
}

export function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey

  const handleClick = () => {
    onSort(sortKey)
  }

  return (
    <button
      onClick={handleClick}
      className={`group flex items-center gap-1 text-left hover:text-white transition-colors ${className}`}
      style={{ color: isActive ? 'white' : 'rgba(232, 236, 255, 0.5)' }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      <span className="ml-1">
        {isActive ? (
          currentSortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        )}
      </span>
    </button>
  )
}

// Hook for managing sort state
export function useSort<T>(
  items: T[],
  defaultSortKey: string | null = null,
  defaultDirection: SortDirection = null
) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      // Toggle direction or reset
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortKey(null)
        setSortDirection(null)
      } else {
        setSortDirection('asc')
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const sortedItems = useMemo(() => {
    if (!sortKey || !sortDirection) return items

    return [...items].sort((a, b) => {
      const aVal = getNestedValue(a, sortKey)
      const bVal = getNestedValue(b, sortKey)

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1

      // Compare values
      let comparison = 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal)
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime()
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [items, sortKey, sortDirection])

  return {
    sortKey,
    sortDirection,
    handleSort,
    sortedItems,
  }
}

// Helper to get nested object values (e.g., "customer.name")
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    if (current == null) return undefined
    return (current as Record<string, unknown>)[key]
  }, obj)
}

import { useState, useMemo } from 'react'
