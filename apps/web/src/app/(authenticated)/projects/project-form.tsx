'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from '@/components/ui'
import { createProject, updateProject, type CreateProjectInput } from '@/app/actions/projects'
import type { Project } from '@/types'

interface ProjectFormProps {
  project?: Project
  customers: { value: string; label: string }[]
  defaultCustomerId?: string
}

export function ProjectForm({ project, customers, defaultCustomerId }: ProjectFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!project

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const billingType = formData.get('billing_type') as 'hourly' | 'fixed'

      const input: CreateProjectInput = {
        customer_id: formData.get('customer_id') as string,
        name: formData.get('name') as string,
        code: formData.get('code') as string,
        description: (formData.get('description') as string) || null,
        billing_type: billingType,
        hourly_rate: billingType === 'hourly' ? parseFloat(formData.get('hourly_rate') as string) || null : null,
        fixed_price: billingType === 'fixed' ? parseFloat(formData.get('fixed_price') as string) || null : null,
        budget_hours: parseFloat(formData.get('budget_hours') as string) || null,
        budget_amount: parseFloat(formData.get('budget_amount') as string) || null,
        start_date: (formData.get('start_date') as string) || null,
        end_date: (formData.get('end_date') as string) || null,
        time_recording_mode: formData.get('time_recording_mode') as 'hours' | 'start_end',
        is_billable: formData.get('is_billable') === 'on',
      }

      const result = isEditing
        ? await updateProject(project.id, input)
        : await createProject(input)

      if (result.success) {
        router.push(isEditing ? `/projects/${project.id}` : '/projects')
      } else {
        alert(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <Select
                id="customer_id"
                name="customer_id"
                required
                defaultValue={project?.customer_id || defaultCustomerId || ''}
                options={[{ value: '', label: 'Select a customer...' }, ...customers]}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={project?.name}
                  placeholder="Website Redesign"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Project Code *</Label>
                <Input
                  id="code"
                  name="code"
                  required
                  defaultValue={project?.code}
                  placeholder="WEB-001"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={project?.description || ''}
                placeholder="Project description..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="billing_type">Billing Type *</Label>
                <Select
                  id="billing_type"
                  name="billing_type"
                  required
                  defaultValue={project?.billing_type || 'hourly'}
                  options={[
                    { value: 'hourly', label: 'Hourly' },
                    { value: 'fixed', label: 'Fixed Price' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Hourly Rate (EUR)</Label>
                <Input
                  id="hourly_rate"
                  name="hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={project?.hourly_rate || ''}
                  placeholder="85.00"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fixed_price">Fixed Price (EUR)</Label>
                <Input
                  id="fixed_price"
                  name="fixed_price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={project?.fixed_price || ''}
                  placeholder="10000.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time_recording_mode">Time Recording Mode</Label>
                <Select
                  id="time_recording_mode"
                  name="time_recording_mode"
                  defaultValue={project?.time_recording_mode || 'hours'}
                  options={[
                    { value: 'hours', label: 'Hours only' },
                    { value: 'start_end', label: 'Start/End times' },
                  ]}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_billable"
                name="is_billable"
                defaultChecked={project?.is_billable ?? true}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="is_billable" className="cursor-pointer">
                Billable project
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budget & Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget_hours">Budget Hours</Label>
                <Input
                  id="budget_hours"
                  name="budget_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  defaultValue={project?.budget_hours || ''}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget_amount">Budget Amount (EUR)</Label>
                <Input
                  id="budget_amount"
                  name="budget_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={project?.budget_amount || ''}
                  placeholder="8500.00"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  defaultValue={project?.start_date || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  name="end_date"
                  type="date"
                  defaultValue={project?.end_date || ''}
                />
              </div>
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
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
              ? 'Save Changes'
              : 'Create Project'}
          </Button>
        </div>
      </div>
    </form>
  )
}
