import { Metadata } from 'next'
import { Breadcrumbs } from '@/components/ui'
import { MileageForm } from '@/components/expenses/mileage-form'
import { getProjectsForSelect } from '@/app/actions/time-entries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Log Mileage | BOTFORCE Unity',
}

interface MileagePageProps {
  searchParams: Promise<{ project?: string }>
}

export default async function MileagePage({ searchParams }: MileagePageProps) {
  const params = await searchParams
  const projects = await getProjectsForSelect()

  // Get company mileage rate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let mileageRate = 0.42 // Default Austrian rate

  if (user) {
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (membership) {
      const { data: company } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', membership.company_id)
        .single()

      const settings = company?.settings as { mileage_rate?: number } | null
      if (settings?.mileage_rate) {
        mileageRate = settings.mileage_rate
      }
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Expenses', href: '/expenses' },
          { label: 'Log Mileage' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Log Mileage</h1>
        <p className="mt-1 text-text-secondary">
          Record a mileage expense with automatic calculation
        </p>
      </div>

      <div className="max-w-2xl">
        <MileageForm
          projects={projects}
          defaultProjectId={params.project}
          defaultMileageRate={mileageRate}
        />
      </div>
    </div>
  )
}
