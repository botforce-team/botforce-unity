'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Menu, Bell } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile, Company, UserRole } from '@/types'
import { GlobalSearch } from '@/components/search/global-search'

interface HeaderProps {
  user: User
  profile: Profile | null
  company: Company | null
  role: UserRole | null
}

export function Header({ user, profile, company, role }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : user.email

  const initials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`
    : user.email?.[0]?.toUpperCase() || 'U'

  const roleLabels: Record<UserRole, string> = {
    superadmin: 'Admin',
    employee: 'Employee',
    accountant: 'Accountant',
  }

  const roleBadgeStyles: Record<UserRole, { bg: string; border: string; color: string }> = {
    superadmin: {
      bg: 'rgba(139, 92, 246, 0.15)',
      border: 'rgba(139, 92, 246, 0.35)',
      color: '#a78bfa'
    },
    employee: {
      bg: 'rgba(31, 91, 255, 0.15)',
      border: 'rgba(31, 91, 255, 0.35)',
      color: '#60a5fa'
    },
    accountant: {
      bg: 'rgba(34, 197, 94, 0.15)',
      border: 'rgba(34, 197, 94, 0.35)',
      color: '#4ade80'
    },
  }

  return (
    <header
      className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-5"
      style={{
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Mobile menu button */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-[rgba(255,255,255,0.6)] hover:text-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Separator */}
      <div className="h-5 w-px bg-[rgba(255,255,255,0.08)] lg:hidden" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Search */}
        <div className="relative flex flex-1 items-center max-w-md">
          <GlobalSearch />
        </div>

        {/* Right section */}
        <div className="flex items-center gap-x-3 lg:gap-x-4">
          {/* Notifications */}
          <button
            type="button"
            className="relative p-2 text-[rgba(255,255,255,0.6)] hover:text-white transition-colors rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
          >
            <Bell className="h-5 w-5" />
            <span
              className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
              style={{ background: '#1f5bff', boxShadow: '0 0 6px rgba(31, 91, 255, 0.5)' }}
            />
          </button>

          {/* Separator */}
          <div className="hidden lg:block lg:h-5 lg:w-px" style={{ background: 'rgba(255, 255, 255, 0.08)' }} />

          {/* User profile */}
          <div className="flex items-center gap-x-3">
            {/* Avatar */}
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #1f5bff 100%)',
              }}
            >
              <span className="text-[12px] font-semibold text-white">{initials}</span>
            </div>

            <div className="hidden lg:flex lg:flex-col lg:items-start">
              <span className="text-[13px] font-medium text-white">{displayName}</span>
              <span className="text-[11px] text-[rgba(255,255,255,0.5)]">{company?.name}</span>
            </div>

            {/* Role badge */}
            {role && (
              <span
                className="hidden sm:inline-flex px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  background: roleBadgeStyles[role].bg,
                  border: `1px solid ${roleBadgeStyles[role].border}`,
                  color: roleBadgeStyles[role].color,
                }}
              >
                {roleLabels[role]}
              </span>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-[rgba(255,255,255,0.6)] hover:text-white transition-all"
            style={{
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
