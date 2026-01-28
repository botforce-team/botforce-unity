'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Car, ArrowRight, RotateCcw } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from '@/components/ui'
import { createMileageExpense } from '@/app/actions/expenses'
import { calculateMileageExpense } from '@/lib/mileage'
import { useToast } from '@/components/ui/use-toast'

interface MileageFormProps {
  projects: { value: string; label: string }[]
  defaultProjectId?: string
  defaultMileageRate?: number
}

export function MileageForm({ projects, defaultProjectId, defaultMileageRate = 0.42 }: MileageFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const [distanceKm, setDistanceKm] = useState('')
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [roundTrip, setRoundTrip] = useState(false)
  const [projectId, setProjectId] = useState(defaultProjectId || '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const distance = parseFloat(distanceKm) || 0
  const totalDistance = roundTrip ? distance * 2 : distance
  const { amount } = calculateMileageExpense(totalDistance, defaultMileageRate)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!distanceKm || !fromLocation || !toLocation) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    startTransition(async () => {
      const result = await createMileageExpense({
        project_id: projectId || null,
        date,
        distance_km: parseFloat(distanceKm),
        from_location: fromLocation,
        to_location: toLocation,
        round_trip: roundTrip,
      })

      if (result.success) {
        toast({
          title: 'Mileage expense created',
          description: `€${amount.toFixed(2)} for ${totalDistance} km`,
        })
        router.push('/expenses')
      } else {
        toast({
          title: 'Failed to create expense',
          description: result.error || 'Please try again',
          variant: 'destructive',
        })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Mileage Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="distance">Distance (km) *</Label>
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  min="0"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Route</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={fromLocation}
                  onChange={(e) => setFromLocation(e.target.value)}
                  placeholder="From (e.g., Vienna Office)"
                  required
                />
                <ArrowRight className="h-5 w-5 flex-shrink-0 text-text-muted" />
                <Input
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  placeholder="To (e.g., Client Site)"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="roundTrip"
                checked={roundTrip}
                onChange={(e) => setRoundTrip(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="roundTrip" className="flex cursor-pointer items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Round trip (doubles the distance)
              </Label>
            </div>

            {/* Calculation Preview */}
            {distance > 0 && (
              <div className="rounded-lg bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-text-muted">
                    {totalDistance} km × €{defaultMileageRate.toFixed(2)}/km
                  </div>
                  <div className="text-xl font-semibold text-primary">
                    €{amount.toFixed(2)}
                  </div>
                </div>
                {roundTrip && (
                  <p className="mt-1 text-xs text-text-muted">
                    Including return journey
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="project">Project (optional)</Label>
              <Select
                id="project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                options={[{ value: '', label: 'No project' }, ...projects]}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || !distanceKm || !fromLocation || !toLocation}>
            {isPending ? 'Creating...' : 'Create Mileage Expense'}
          </Button>
        </div>
      </div>
    </form>
  )
}
