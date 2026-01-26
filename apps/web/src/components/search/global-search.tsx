'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, FileText, Users, Briefcase, Clock, Receipt, User, Loader2 } from 'lucide-react'
import { globalSearch, type SearchResult } from '@/app/actions/search'

const typeIcons: Record<SearchResult['type'], React.ComponentType<{ className?: string }>> = {
  customer: Users,
  project: Briefcase,
  document: FileText,
  timesheet: Clock,
  expense: Receipt,
  team_member: User,
}

const typeLabels: Record<SearchResult['type'], string> = {
  customer: 'Customer',
  project: 'Project',
  document: 'Document',
  timesheet: 'Time Entry',
  expense: 'Expense',
  team_member: 'Team Member',
}

const typeColors: Record<SearchResult['type'], string> = {
  customer: '#8b5cf6',
  project: '#1f5bff',
  document: '#22c55e',
  timesheet: '#f59e0b',
  expense: '#ef4444',
  team_member: '#06b6d4',
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Keyboard shortcut to open search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Search as user types (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setIsLoading(true)
        const { results: searchResults } = await globalSearch(query)
        setResults(searchResults)
        setSelectedIndex(0)
        setIsLoading(false)
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = useCallback((result: SearchResult) => {
    router.push(result.url)
    setIsOpen(false)
    setQuery('')
    setResults([])
  }, [router])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    }
  }, [results, selectedIndex, handleSelect])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg"
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Search className="h-4 w-4 text-[rgba(255,255,255,0.4)]" />
        <span className="text-[13px] text-[rgba(255,255,255,0.4)]">Search...</span>
        <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-[rgba(255,255,255,0.4)] rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[15%] z-50 mx-auto max-w-xl">
        <div
          className="overflow-hidden rounded-xl shadow-2xl"
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Search className="h-5 w-5 text-[rgba(255,255,255,0.4)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search customers, projects, invoices..."
              className="flex-1 bg-transparent border-0 text-[15px] text-white placeholder:text-[rgba(255,255,255,0.4)] focus:outline-none focus:ring-0"
            />
            {isLoading && <Loader2 className="h-4 w-4 text-[rgba(255,255,255,0.4)] animate-spin" />}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-[rgba(255,255,255,0.1)]"
            >
              <X className="h-4 w-4 text-[rgba(255,255,255,0.4)]" />
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="max-h-80 overflow-y-auto py-2">
              {results.map((result, index) => {
                const Icon = typeIcons[result.type]
                const isSelected = index === selectedIndex
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    }}
                  >
                    <div
                      className="flex items-center justify-center h-8 w-8 rounded-lg"
                      style={{ background: `${typeColors[result.type]}20` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: typeColors[result.type] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] text-white truncate">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-[12px] text-[rgba(255,255,255,0.5)] truncate">{result.subtitle}</div>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded"
                      style={{
                        background: `${typeColors[result.type]}20`,
                        color: typeColors[result.type],
                      }}
                    >
                      {typeLabels[result.type]}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {query.length >= 2 && !isLoading && results.length === 0 && (
            <div className="py-8 text-center">
              <Search className="h-8 w-8 text-[rgba(255,255,255,0.2)] mx-auto mb-2" />
              <p className="text-[14px] text-[rgba(255,255,255,0.5)]">No results found for "{query}"</p>
            </div>
          )}

          {/* Help text */}
          {query.length < 2 && (
            <div className="py-8 text-center">
              <p className="text-[13px] text-[rgba(255,255,255,0.4)]">Type at least 2 characters to search</p>
            </div>
          )}

          {/* Footer */}
          <div
            className="flex items-center justify-between px-4 py-2 text-[11px] text-[rgba(255,255,255,0.4)]"
            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>↵</kbd>
                to select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>esc</kbd>
              to close
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
