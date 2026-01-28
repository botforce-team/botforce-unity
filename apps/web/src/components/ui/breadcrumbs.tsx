'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  className?: string
}

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  projects: 'Projects',
  timesheets: 'Timesheets',
  documents: 'Documents',
  expenses: 'Expenses',
  finance: 'Finance',
  team: 'Team',
  settings: 'Settings',
  new: 'New',
  edit: 'Edit',
  recurring: 'Recurring',
  'accounting-export': 'Accounting Export',
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const pathname = usePathname()

  // If no items provided, auto-generate from pathname
  const breadcrumbItems: BreadcrumbItem[] = items || generateBreadcrumbs(pathname)

  if (breadcrumbItems.length <= 1) {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4', className)}>
      <ol className="flex items-center gap-1 text-sm">
        <li>
          <Link
            href="/dashboard"
            className="flex items-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <Home className="h-4 w-4" />
          </Link>
        </li>
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-text-muted" />
            {item.href && index < breadcrumbItems.length - 1 ? (
              <Link
                href={item.href}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-text-primary font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const items: BreadcrumbItem[] = []

  let currentPath = ''
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    currentPath += `/${segment}`

    // Skip UUIDs in breadcrumb labels but keep the path
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)

    if (isUuid) {
      items.push({
        label: 'Details',
        href: currentPath,
      })
    } else {
      items.push({
        label: routeLabels[segment] || capitalize(segment),
        href: currentPath,
      })
    }
  }

  return items
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ')
}
