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
  HelpCircle,
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
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-[220px] lg:flex-col">
      {/* Glass sidebar */}
      <div
        className="flex grow flex-col overflow-y-auto"
        style={{
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Logo Section */}
        <div
          className="flex h-16 shrink-0 items-center px-4"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
        >
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="BOTFORCE"
              width={36}
              height={36}
              className="h-9 w-auto"
            />
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-white tracking-wide">BOTFORCE</span>
              <span className="text-[9px] font-medium text-[rgba(255,255,255,0.5)] uppercase tracking-widest">Unity</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col p-3">
          <ul role="list" className="flex flex-1 flex-col gap-y-1">
            {filteredNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[14px] font-medium transition-all duration-200',
                      isActive
                        ? 'text-[#a78bfa]'
                        : 'text-[rgba(255,255,255,0.6)] hover:text-white'
                    )}
                    style={isActive ? {
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(31, 91, 255, 0.15) 100%)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                    } : {}}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <item.icon
                      className={cn(
                        'h-5 w-5 shrink-0 opacity-70',
                        isActive && 'opacity-100'
                      )}
                    />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Footer */}
          <div
            className="py-3 mt-auto"
            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
          >
            <button
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-[13px] text-[rgba(255,255,255,0.6)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-all"
              style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
            >
              <HelpCircle className="h-4 w-4" />
              Help & Support
            </button>
            <p className="text-[10px] text-[rgba(255,255,255,0.4)] text-center mt-3">
              &copy; {new Date().getFullYear()} BOTFORCE GmbH
            </p>
          </div>
        </nav>
      </div>
    </div>
  )
}
