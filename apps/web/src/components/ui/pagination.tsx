'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems?: number
  itemsPerPage?: number
  showItemCount?: boolean
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage = 10,
  showItemCount = true,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems || 0)

  const getVisiblePages = () => {
    const pages: (number | string)[] = []
    const delta = 2 // Number of pages to show on each side of current page

    if (totalPages <= 7) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > delta + 2) {
        pages.push('...')
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - delta)
      const end = Math.min(totalPages - 1, currentPage + delta)

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i)
        }
      }

      if (currentPage < totalPages - delta - 1) {
        pages.push('...')
      }

      // Always show last page
      if (!pages.includes(totalPages)) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  if (totalPages <= 1) return null

  const buttonStyle = {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  }

  const activeButtonStyle = {
    background: '#1f5bff',
    border: '1px solid #1f5bff',
  }

  const disabledButtonStyle = {
    opacity: 0.4,
    cursor: 'not-allowed',
  }

  return (
    <div className="flex items-center justify-between py-4">
      {showItemCount && totalItems !== undefined && (
        <div className="text-[12px] text-[rgba(232,236,255,0.5)]">
          Showing {startItem}-{endItem} of {totalItems} items
        </div>
      )}

      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg text-[rgba(232,236,255,0.7)] hover:text-white transition-colors"
          style={currentPage === 1 ? { ...buttonStyle, ...disabledButtonStyle } : buttonStyle}
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {/* Previous page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg text-[rgba(232,236,255,0.7)] hover:text-white transition-colors"
          style={currentPage === 1 ? { ...buttonStyle, ...disabledButtonStyle } : buttonStyle}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-2">
          {getVisiblePages().map((page, index) =>
            typeof page === 'string' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-[rgba(232,236,255,0.4)]"
              >
                {page}
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className="min-w-[32px] h-8 px-2 rounded-lg text-[13px] font-medium transition-colors"
                style={currentPage === page ? activeButtonStyle : buttonStyle}
              >
                <span className={currentPage === page ? 'text-white' : 'text-[rgba(232,236,255,0.7)]'}>
                  {page}
                </span>
              </button>
            )
          )}
        </div>

        {/* Next page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-[rgba(232,236,255,0.7)] hover:text-white transition-colors"
          style={currentPage === totalPages ? { ...buttonStyle, ...disabledButtonStyle } : buttonStyle}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-[rgba(232,236,255,0.7)] hover:text-white transition-colors"
          style={currentPage === totalPages ? { ...buttonStyle, ...disabledButtonStyle } : buttonStyle}
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// Hook for managing pagination state
export function usePagination(totalItems: number, itemsPerPage: number = 10) {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(totalItems / itemsPerPage)

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
  }

  const nextPage = () => goToPage(currentPage + 1)
  const prevPage = () => goToPage(currentPage - 1)

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems)

  return {
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    startIndex,
    endIndex,
    itemsPerPage,
  }
}

// Need to import useState for the hook
import { useState } from 'react'
