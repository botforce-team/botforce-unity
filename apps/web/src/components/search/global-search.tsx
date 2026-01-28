'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Users, FolderKanban, FileText, Receipt } from 'lucide-react'
import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  type: 'customer' | 'project' | 'document' | 'expense'
  title: string
  subtitle?: string
  href: string
}

const typeIcons = {
  customer: Users,
  project: FolderKanban,
  document: FileText,
  expense: Receipt,
}

const typeLabels = {
  customer: 'Customer',
  project: 'Project',
  document: 'Document',
  expense: 'Expense',
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

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data.results || [])
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      router.push(results[selectedIndex].href)
      setIsOpen(false)
      setQuery('')
    }
  }

  const handleSelect = (result: SearchResult) => {
    router.push(result.href)
    setIsOpen(false)
    setQuery('')
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-text-muted hover:text-text-secondary"
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="ml-2 hidden rounded bg-background px-1.5 py-0.5 text-xs font-medium text-text-muted sm:inline-block">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={() => setIsOpen(false)}
      />

      {/* Search dialog */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-lg border border-border bg-background-elevated shadow-xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-5 w-5 text-text-muted" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search customers, projects, documents..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 border-0 bg-transparent px-0 focus:ring-0"
          />
          <button
            onClick={() => setIsOpen(false)}
            className="rounded p-1 text-text-muted hover:bg-surface hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-text-muted">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <ul>
              {results.map((result, index) => {
                const Icon = typeIcons[result.type]
                return (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      onClick={() => handleSelect(result)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                        index === selectedIndex
                          ? 'bg-primary-muted text-primary'
                          : 'text-text-secondary hover:bg-surface'
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1 truncate">
                        <p className="truncate text-sm font-medium">{result.title}</p>
                        {result.subtitle && (
                          <p className="truncate text-xs text-text-muted">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-text-muted">
                        {typeLabels[result.type]}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : query.trim() ? (
            <div className="py-8 text-center text-sm text-text-muted">
              No results found for "{query}"
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-text-muted">
              Start typing to search...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <kbd className="rounded bg-surface px-1.5 py-0.5">↑↓</kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded bg-surface px-1.5 py-0.5">↵</kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded bg-surface px-1.5 py-0.5">Esc</kbd>
              <span>Close</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
