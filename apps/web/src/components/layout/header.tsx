'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui'
import { GlobalSearch } from '@/components/search/global-search'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customers',
  '/projects': 'Projects',
  '/timesheets': 'Timesheets',
  '/documents': 'Documents',
  '/expenses': 'Expenses',
  '/finance': 'Finance',
  '/team': 'Team',
  '/settings': 'Settings',
}

export function Header() {
  const pathname = usePathname()

  // Find the matching title
  const title = Object.entries(pageTitles).find(([path]) =>
    pathname === path || pathname.startsWith(`${path}/`)
  )?.[1] || 'BOTFORCE Unity'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>

      <div className="flex items-center gap-4">
        <GlobalSearch />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
