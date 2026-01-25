'use client'

import Link from 'next/link'
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
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center">
          <span className="text-xl font-bold text-gray-900">BOTFORCE Unity</span>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {filteredNav.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          isActive
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                          'group flex gap-x-3 rounded-md p-2 text-sm font-medium leading-6'
                        )}
                      >
                        <item.icon
                          className={cn(
                            isActive
                              ? 'text-gray-900'
                              : 'text-gray-400 group-hover:text-gray-900',
                            'h-5 w-5 shrink-0'
                          )}
                        />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
