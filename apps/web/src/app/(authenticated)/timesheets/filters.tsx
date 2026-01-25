'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Project {
  id: string
  name: string
  code: string | null
}

interface TimesheetFiltersProps {
  projects: Project[]
  selectedProject?: string
  selectedMonth?: string
  selectedYear?: string
}

export function TimesheetFilters({ projects, selectedProject, selectedMonth, selectedYear }: TimesheetFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/timesheets?${params.toString()}`)
  }

  const clearAllFilters = () => {
    router.push('/timesheets')
  }

  const hasFilters = selectedProject || selectedMonth || selectedYear

  // Generate month options
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]

  // Generate year options (current year and 2 years back)
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  return (
    <div
      className="p-4 rounded-[16px]"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="flex flex-wrap items-center gap-4">
        {/* Project Filter */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide">
            Project
          </label>
          <select
            value={selectedProject || ''}
            onChange={(e) => updateFilter('project', e.target.value)}
            className="px-3 py-2 rounded-[10px] text-[13px] text-[#e8ecff] focus:outline-none min-w-[180px]"
            style={inputStyle}
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} {project.code && `(${project.code})`}
              </option>
            ))}
          </select>
        </div>

        {/* Month Filter */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide">
            Month
          </label>
          <select
            value={selectedMonth || ''}
            onChange={(e) => updateFilter('month', e.target.value)}
            className="px-3 py-2 rounded-[10px] text-[13px] text-[#e8ecff] focus:outline-none min-w-[140px]"
            style={inputStyle}
          >
            <option value="">All Months</option>
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide">
            Year
          </label>
          <select
            value={selectedYear || ''}
            onChange={(e) => updateFilter('year', e.target.value)}
            className="px-3 py-2 rounded-[10px] text-[13px] text-[#e8ecff] focus:outline-none min-w-[100px]"
            style={inputStyle}
          >
            <option value="">All Years</option>
            {years.map((year) => (
              <option key={year} value={year.toString()}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Clear All Button */}
        {hasFilters && (
          <button
            onClick={clearAllFilters}
            className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[rgba(255,255,255,0.6)] hover:text-white transition-colors"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  )
}
