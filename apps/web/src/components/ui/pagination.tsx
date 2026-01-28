import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  baseUrl: string
}

export function Pagination({ currentPage, totalPages, baseUrl }: PaginationProps) {
  const getPageUrl = (page: number) => {
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}page=${page}`
  }

  // Generate page numbers to show
  const pages: (number | 'ellipsis')[] = []

  if (totalPages <= 7) {
    // Show all pages
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    // Always show first page
    pages.push(1)

    if (currentPage > 3) {
      pages.push('ellipsis')
    }

    // Show pages around current
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)

    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) {
        pages.push(i)
      }
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis')
    }

    // Always show last page
    if (!pages.includes(totalPages)) {
      pages.push(totalPages)
    }
  }

  return (
    <nav className="flex items-center justify-center gap-1">
      {/* Previous */}
      {currentPage > 1 ? (
        <Link
          href={getPageUrl(currentPage - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-muted opacity-50 cursor-not-allowed">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {/* Page numbers */}
      {pages.map((page, index) =>
        page === 'ellipsis' ? (
          <span
            key={`ellipsis-${index}`}
            className="flex h-9 w-9 items-center justify-center text-text-muted"
          >
            ...
          </span>
        ) : (
          <Link
            key={page}
            href={getPageUrl(page)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
              page === currentPage
                ? 'bg-primary text-white'
                : 'border border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            )}
          >
            {page}
          </Link>
        )
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={getPageUrl(currentPage + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-muted opacity-50 cursor-not-allowed">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  )
}
