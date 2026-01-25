'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, Menu } from 'lucide-react'
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

  const roleLabels: Record<UserRole, string> = {
    superadmin: 'Admin',
    employee: 'Employee',
    accountant: 'Accountant',
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
      >
        <Menu className="h-6 w-6" />
      </button>

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center">
          {company && (
            <span className="text-sm font-medium text-gray-900">
              {company.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <div className="flex items-center gap-x-3">
            <span className="text-sm text-gray-700">{displayName}</span>
            {role && (
              <Badge variant="secondary">
                {roleLabels[role]}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
