import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Team</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-secondary">
            Team management will be implemented in Sprint 8.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
