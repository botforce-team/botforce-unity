import { Metadata } from 'next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { TimeReportView } from './time-report'
import { RevenueReportView } from './revenue-report'
import { getProjectsForSelect } from '@/app/actions/time-entries'
import { getCustomersForDocumentSelect } from '@/app/actions/documents'

export const metadata: Metadata = {
  title: 'Reports | BOTFORCE Unity',
}

interface ReportsPageProps {
  searchParams: Promise<{
    tab?: string
    from?: string
    to?: string
    project?: string
    customer?: string
  }>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams
  const activeTab = params.tab || 'time'

  const [projects, customers] = await Promise.all([
    getProjectsForSelect(),
    getCustomersForDocumentSelect(),
  ])

  // Default to current month
  const now = new Date()
  const defaultFrom = params.from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const defaultTo = params.to || now.toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Reports</h1>
        <p className="mt-1 text-text-secondary">
          Analyze your time and revenue data
        </p>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="time">Time Report</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Report</TabsTrigger>
        </TabsList>

        <TabsContent value="time">
          <TimeReportView
            projects={projects}
            customers={customers}
            defaultFrom={defaultFrom}
            defaultTo={defaultTo}
            defaultProject={params.project}
            defaultCustomer={params.customer}
          />
        </TabsContent>

        <TabsContent value="revenue">
          <RevenueReportView
            customers={customers}
            defaultFrom={defaultFrom}
            defaultTo={defaultTo}
            defaultCustomer={params.customer}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
