'use client'

import { usePathname } from 'next/navigation'
import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui'
import { GlobalSearch } from '@/components/search/global-search'
import { useSidebar } from './sidebar-context'

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
  const { toggle, isMobile } = useSidebar()

  // Find the matching title
  const title = Object.entries(pageTitles).find(([path]) =>
    pathname === path || pathname.startsWith(`${path}/`)
  )?.[1] || 'BOTFORCE Unity'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger menu for mobile */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold text-text-primary lg:text-xl">{title}</h1>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <GlobalSearch />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
