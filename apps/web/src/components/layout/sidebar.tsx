'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  FileText,
  Receipt,
  Download,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserRole } from '@/types/database'

interface SidebarProps {
  role?: UserRole | null
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['superadmin', 'employee', 'accountant'] },
  { name: 'Projects', href: '/projects', icon: FolderKanban, roles: ['superadmin', 'employee'] },
  { name: 'Timesheets', href: '/timesheets', icon: Clock, roles: ['superadmin', 'employee'] },
  { name: 'Documents', href: '/documents', icon: FileText, roles: ['superadmin', 'accountant'] },
  { name: 'Expenses', href: '/expenses', icon: Receipt, roles: ['superadmin', 'employee', 'accountant'] },
  { name: 'Accounting Export', href: '/accounting-export', icon: Download, roles: ['superadmin', 'accountant'] },
  { name: 'Team', href: '/team', icon: Users, roles: ['superadmin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['superadmin'] },
]

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()

  const filteredNav = navigation.filter((item) =>
    role ? item.roles.includes(role) : false
  )

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col overflow-y-auto border-r border-gray-200 bg-white">
        {/* Logo Section - Dark background for white logo */}
        <div className="flex h-20 shrink-0 items-center px-6 bg-slate-900">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="BOTFORCE"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white tracking-tight">BOTFORCE</span>
              <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Unity</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col px-4 pt-5">
          <ul role="list" className="flex flex-1 flex-col gap-y-1">
            {filteredNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'nav-item',
                      isActive
                        ? 'nav-item-active'
                        : 'nav-item-inactive'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        isActive ? 'text-primary-foreground' : 'text-gray-400'
                      )}
                    />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Footer */}
          <div className="py-4 border-t border-gray-100 mt-auto">
            <p className="text-xs text-gray-400 text-center">
              &copy; {new Date().getFullYear()} BOTFORCE GmbH
            </p>
          </div>
        </nav>
      </div>
    </div>
  )
}
