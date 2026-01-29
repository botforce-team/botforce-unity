'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, Filter } from 'lucide-react'
import { Select } from '@/components/ui'
import { MonthPicker } from '@/components/ui/month-picker'

interface ExpenseFiltersProps {
  projects: { value: string; label: string }[]
  selectedProject?: string
  selectedMonth?: string
}

export function ExpenseFilters({ projects, selectedProject, selectedMonth }: ExpenseFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    // Reset to page 1 when filters change
    params.delete('page')
    router.push(`/expenses?${params.toString()}`)
  }

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('project')
    params.delete('month')
    params.delete('page')
    router.push(`/expenses?${params.toString()}`)
  }

  const hasActiveFilters = selectedProject || selectedMonth

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-surface border border-border">
      <Filter className="h-4 w-4 text-text-muted" />

      {/* Project Filter */}
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-text-muted" />
        <Select
          value={selectedProject || ''}
          onChange={(e) => updateFilter('project', e.target.value || undefined)}
          className="w-48"
        >
          <option value="">Alle Projekte</option>
          {projects.map((project) => (
            <option key={project.value} value={project.value}>
              {project.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Month Filter */}
      <div className="w-48">
        <MonthPicker
          value={selectedMonth}
          onChange={(value) => updateFilter('month', value)}
          placeholder="Alle Monate"
        />
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="text-sm text-text-secondary hover:text-primary transition-colors"
        >
          Filter zurücksetzen
        </button>
      )}

      {/* Active filter display */}
      {hasActiveFilters && (
        <div className="ml-auto text-sm text-text-muted">
          Gefiltert nach:
          {selectedProject && (
            <span className="ml-1 text-text-secondary">
              {projects.find(p => p.value === selectedProject)?.label?.split(' (')[0]}
            </span>
          )}
          {selectedMonth && (
            <span className="ml-1 text-text-secondary">
              {new Date(selectedMonth + '-01').toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
