'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, Menu, Bell, Search } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile, Company, UserRole } from '@/types'

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
    superadmin: 'Administrator',
    employee: 'Employee',
    accountant: 'Accountant',
  }

  const roleBadgeColors: Record<UserRole, string> = {
    superadmin: 'bg-violet-100 text-violet-700 border-violet-200',
    employee: 'bg-blue-100 text-blue-700 border-blue-200',
    accountant: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Mobile menu button */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-500 hover:text-gray-700 lg:hidden"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Search (placeholder) */}
        <div className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-0 h-5 w-5 text-gray-400" />
          <input
            type="search"
            placeholder="Search..."
            className="h-full w-full border-0 bg-transparent py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
          />
        </div>

        {/* Right section */}
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notifications */}
          <button
            type="button"
            className="relative p-2 text-gray-400 hover:text-gray-500"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          </button>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" />

          {/* User profile */}
          <div className="flex items-center gap-x-3">
            <div className="hidden lg:flex lg:flex-col lg:items-end">
              <span className="text-sm font-medium text-gray-900">{displayName}</span>
              <span className="text-xs text-gray-500">{company?.name}</span>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-x-3">
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">{initials}</span>
              </div>
            </div>

            {/* Role badge */}
            {role && (
              <Badge className={`hidden sm:inline-flex ${roleBadgeColors[role]} border`}>
                {roleLabels[role]}
              </Badge>
            )}
          </div>

          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
