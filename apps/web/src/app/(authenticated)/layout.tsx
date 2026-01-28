import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { SidebarProvider } from '@/components/layout/sidebar-context'
import { Breadcrumbs } from '@/components/ui'
import { type UserRole } from '@/types'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Use admin client for role query to bypass RLS
  const adminClient = await createAdminClient()

  // Get user profile and company membership
  const { data: membership } = await adminClient
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Get profile separately
  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  // Default to employee if no membership found (edge case during onboarding)
  const userRole: UserRole = (membership?.role as UserRole) || 'employee'
  const userName = profile?.full_name || user.email?.split('@')[0] || 'User'
  const userEmail = profile?.email || user.email || ''

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background">
        <Sidebar userRole={userRole} userName={userName} userEmail={userEmail} />

        {/* Main content - responsive margin */}
        <div className="lg:ml-64">
          <Header />
          <main className="p-4 lg:p-6">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
