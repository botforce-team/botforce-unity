'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Clock,
  FileText,
  Receipt,
  TrendingUp,
  FileSpreadsheet,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { canAccessNav } from '@/lib/permissions'
import { type UserRole } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useSidebar } from './sidebar-context'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  navKey: 'dashboard' | 'customers' | 'projects' | 'timesheets' | 'documents' | 'expenses' | 'finance' | 'reports' | 'accounting' | 'team' | 'settings'
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, navKey: 'dashboard' },
  { href: '/customers', label: 'Customers', icon: Users, navKey: 'customers' },
  { href: '/projects', label: 'Projects', icon: FolderKanban, navKey: 'projects' },
  { href: '/timesheets', label: 'Timesheets', icon: Clock, navKey: 'timesheets' },
  { href: '/documents', label: 'Documents', icon: FileText, navKey: 'documents' },
  { href: '/expenses', label: 'Expenses', icon: Receipt, navKey: 'expenses' },
  { href: '/finance', label: 'Finance', icon: TrendingUp, navKey: 'finance' },
  { href: '/reports', label: 'Reports', icon: BarChart3, navKey: 'reports' },
  { href: '/accounting-export', label: 'Accounting', icon: FileSpreadsheet, navKey: 'accounting' },
  { href: '/team', label: 'Team', icon: UserCog, navKey: 'team' },
  { href: '/settings', label: 'Settings', icon: Settings, navKey: 'settings' },
]

interface SidebarProps {
  userRole: UserRole
  userName: string
  userEmail: string
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { isOpen, isMobile, close } = useSidebar()

  const filteredNavItems = navItems.filter((item) => canAccessNav(userRole, item.navKey))

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleNavClick = () => {
    if (isMobile) {
      close()
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-background-secondary transition-transform duration-300 ease-in-out',
          // Desktop: always visible
          'lg:translate-x-0',
          // Mobile: slide in/out
          isMobile && !isOpen && '-translate-x-full',
          isMobile && isOpen && 'translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="BOTFORCE"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <div>
              <span className="text-base font-semibold text-text-primary">BOTFORCE</span>
              <span className="ml-1 text-text-muted">Unity</span>
            </div>
          </div>
          {/* Close button for mobile */}
          {isMobile && (
            <button
              onClick={close}
              className="rounded-md p-1 text-text-muted hover:bg-surface hover:text-text-primary lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={handleNavClick}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-muted text-primary'
                        : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-muted text-sm font-medium text-primary">
              {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium text-text-primary">{userName}</p>
              <p className="truncate text-xs text-text-muted">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
