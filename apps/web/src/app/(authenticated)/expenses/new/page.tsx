'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Car, Clock, Receipt, Info } from 'lucide-react'
import { createExpense } from '@/app/actions/expenses'
import { createClient } from '@/lib/supabase/client'

// Austrian standard mileage rate (Kilometergeld)
const MILEAGE_RATE_DEFAULT = 0.42

type ExpenseCategory = 'mileage' | 'travel_time' | 'reimbursement'

interface Project {
  id: string
  name: string
  code: string | null
  hourly_rate: number | null
  customer: { name: string } | null
}

const cardStyle = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
}

const inputStyle = {
  background: 'rgba(0, 0, 0, 0.25)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
}

const categoryInfo = {
  mileage: {
    icon: Car,
    title: 'Kilometergeld',
    subtitle: 'Mileage reimbursement for using your private car',
    description: 'Austrian standard rate: €0.42/km. Enter the distance driven for business purposes.',
  },
  travel_time: {
    icon: Clock,
    title: 'Reisezeit',
    subtitle: 'Travel time at a reduced hourly rate',
    description: 'Bill travel time at a reduced rate from your normal hourly rate (as per project agreement).',
  },
  reimbursement: {
    icon: Receipt,
    title: 'Auslagenersatz',
    subtitle: 'Expense reimbursement for tickets, meals, etc.',
    description: 'Reimbursement for business expenses like train tickets, flights, meals, or other costs.',
  },
}

export default function NewExpensePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedProject = searchParams.get('project')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)

  // Form state
  const [category, setCategory] = useState<ExpenseCategory>('mileage')
  const [projectId, setProjectId] = useState(preselectedProject || '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [merchant, setMerchant] = useState('')

  // Mileage specific
  const [distanceKm, setDistanceKm] = useState('')
  const [ratePerKm, setRatePerKm] = useState(MILEAGE_RATE_DEFAULT.toString())
  const [route, setRoute] = useState('')

  // Travel time specific
  const [hours, setHours] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')

  // Direct amount (reimbursement)
  const [amount, setAmount] = useState('')

  // Load projects
  useEffect(() => {
    async function loadProjects() {
      const supabase = createClient()
      const { data } = await supabase
        .from('projects')
        .select('id, name, code, hourly_rate, customer:customers(name)')
        .eq('is_active', true)
        .order('name')

      setProjects(data || [])
      setLoadingProjects(false)
    }
    loadProjects()
  }, [])

  // Update hourly rate when project changes
  useEffect(() => {
    if (projectId && category === 'travel_time') {
      const project = projects.find(p => p.id === projectId)
      if (project?.hourly_rate) {
        // Default to 50% of project hourly rate for travel time
        setHourlyRate((project.hourly_rate * 0.5).toFixed(2))
      }
    }
  }, [projectId, projects, category])

  // Calculate amount preview
  const calculatedAmount = (() => {
    if (category === 'mileage') {
      const dist = parseFloat(distanceKm) || 0
      const rate = parseFloat(ratePerKm) || MILEAGE_RATE_DEFAULT
      return dist * rate
    } else if (category === 'travel_time') {
      const h = parseFloat(hours) || 0
      const rate = parseFloat(hourlyRate) || 0
      return h * rate
    } else {
      return parseFloat(amount) || 0
    }
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.set('category', category)
    formData.set('project_id', projectId)
    formData.set('date', date)
    formData.set('description', description)
    formData.set('merchant', merchant)

    if (category === 'mileage') {
      formData.set('distance_km', distanceKm)
      formData.set('rate_per_km', ratePerKm)
      formData.set('route', route)
    } else if (category === 'travel_time') {
      formData.set('hours', hours)
      formData.set('hourly_rate', hourlyRate)
    } else {
      formData.set('amount', amount)
    }

    const result = await createExpense(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/expenses')
    }
  }

  const selectedCategoryInfo = categoryInfo[category]
  const CategoryIcon = selectedCategoryInfo.icon

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/expenses"
          className="inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Expenses
        </Link>
        <h1 className="text-2xl font-bold text-white">New Expense</h1>
        <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
          Submit a new expense for reimbursement
        </p>
      </div>

      {/* Category Selection */}
      <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">Expense Type</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(categoryInfo) as ExpenseCategory[]).map((cat) => {
              const info = categoryInfo[cat]
              const Icon = info.icon
              const isSelected = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`p-4 rounded-[12px] text-left transition-all ${
                    isSelected ? 'ring-2 ring-[#1f5bff]' : ''
                  }`}
                  style={{
                    background: isSelected ? 'rgba(31, 91, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    border: isSelected ? '1px solid rgba(31, 91, 255, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Icon className={`h-5 w-5 mb-2 ${isSelected ? 'text-[#1f5bff]' : 'text-[rgba(232,236,255,0.5)]'}`} />
                  <p className={`text-[13px] font-semibold ${isSelected ? 'text-white' : 'text-[rgba(232,236,255,0.8)]'}`}>
                    {info.title}
                  </p>
                  <p className="text-[11px] text-[rgba(232,236,255,0.5)] mt-0.5">
                    {info.subtitle}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Category Info */}
          <div
            className="mt-4 p-3 rounded-[10px] flex items-start gap-3"
            style={{ background: 'rgba(31, 91, 255, 0.1)', border: '1px solid rgba(31, 91, 255, 0.2)' }}
          >
            <Info className="h-4 w-4 text-[#1f5bff] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[rgba(232,236,255,0.7)]">
              {selectedCategoryInfo.description}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Expense Details */}
        <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
          <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <h2 className="text-[15px] font-semibold text-white">Details</h2>
          </div>
          <div className="p-5 space-y-4">
            {/* Common fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                  Project
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                  style={inputStyle}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} {project.customer?.name ? `(${project.customer.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category-specific fields */}
            {category === 'mileage' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                    Route (From - To)
                  </label>
                  <input
                    type="text"
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    placeholder="e.g. Vienna - Graz"
                    className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                    style={inputStyle}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                      Distance (km) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.1"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                      Rate per km (EUR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ratePerKm}
                      onChange={(e) => setRatePerKm(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                      style={inputStyle}
                    />
                    <p className="mt-1 text-[11px] text-[rgba(232,236,255,0.5)]">
                      Austrian standard: €0.42/km
                    </p>
                  </div>
                </div>
              </>
            )}

            {category === 'travel_time' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                    Hours *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                    Hourly Rate (EUR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                    style={inputStyle}
                  />
                  <p className="mt-1 text-[11px] text-[rgba(232,236,255,0.5)]">
                    Usually 50% of regular hourly rate
                  </p>
                </div>
              </div>
            )}

            {category === 'reimbursement' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                    Merchant / Vendor
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="e.g. ÖBB, Austrian Airlines, Hotel Wien"
                    className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                    Amount (EUR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            {/* Description */}
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Notes / Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Additional details about this expense..."
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff] resize-none"
                style={inputStyle}
              />
            </div>

            {/* Amount Preview */}
            <div
              className="p-4 rounded-[12px]"
              style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[rgba(232,236,255,0.7)]">Calculated Amount</span>
                <span className="text-[20px] font-bold text-[#22c55e]">
                  €{calculatedAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {error && (
              <div
                className="p-3 rounded-[10px] text-[13px] text-[#ef4444]"
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || calculatedAmount <= 0}
                className="px-6 py-2.5 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: '#1f5bff' }}
              >
                {loading ? 'Creating...' : 'Create Expense'}
              </button>
              <Link
                href="/expenses"
                className="px-4 py-2.5 rounded-[12px] text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
