'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  showHome?: boolean
}

// Route to label mapping
const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  timesheets: 'Timesheets',
  documents: 'Documents',
  expenses: 'Expenses',
  customers: 'Customers',
  projects: 'Projects',
  team: 'Team',
  settings: 'Settings',
  finance: 'Finance',
  'accounting-export': 'Accounting Export',
  new: 'New',
  edit: 'Edit',
}

export function Breadcrumbs({ items, showHome = true }: BreadcrumbsProps) {
  const pathname = usePathname()

  // Generate breadcrumbs from pathname if items not provided
  const breadcrumbs: BreadcrumbItem[] = items || generateBreadcrumbs(pathname)

  if (breadcrumbs.length === 0) return null

  return (
    <nav className="flex items-center gap-1 text-[13px] mb-4" aria-label="Breadcrumb">
      {showHome && (
        <>
          <Link
            href="/dashboard"
            className="flex items-center text-[rgba(232,236,255,0.5)] hover:text-white transition-colors"
          >
            <Home className="h-4 w-4" />
          </Link>
          {breadcrumbs.length > 0 && (
            <ChevronRight className="h-4 w-4 text-[rgba(232,236,255,0.3)]" />
          )}
        </>
      )}

      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1

        return (
          <div key={item.href || item.label} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-[rgba(232,236,255,0.3)]" />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-[rgba(232,236,255,0.5)] hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-white font-medium' : 'text-[rgba(232,236,255,0.5)]'}>
                {item.label}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  let currentPath = ''

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    currentPath += `/${segment}`

    // Skip UUID segments (show as "Details" or similar)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)

    let label: string
    if (isUuid) {
      // For UUIDs, use a generic label based on the previous segment
      const prevSegment = segments[i - 1]
      if (prevSegment === 'documents') {
        label = 'Invoice Details'
      } else if (prevSegment === 'customers') {
        label = 'Customer Details'
      } else if (prevSegment === 'projects') {
        label = 'Project Details'
      } else if (prevSegment === 'timesheets') {
        label = 'Timesheet Details'
      } else {
        label = 'Details'
      }
    } else {
      label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    }

    breadcrumbs.push({
      label,
      href: i < segments.length - 1 ? currentPath : undefined,
    })
  }

  return breadcrumbs
}

// Export a helper to use in page components
export function useBreadcrumbs() {
  const pathname = usePathname()
  return generateBreadcrumbs(pathname)
}
