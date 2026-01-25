'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { updateProject } from '@/app/actions/projects'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
  code: string | null
  description: string | null
  customer_id: string
  billing_type: 'hourly' | 'fixed'
  hourly_rate: number | null
  fixed_price: number | null
  budget_hours: number | null
  time_recording_mode: 'hours' | 'start_end'
  is_active: boolean
}

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [billingType, setBillingType] = useState<'hourly' | 'fixed'>('hourly')
  const [hourlyRate, setHourlyRate] = useState('')
  const [fixedPrice, setFixedPrice] = useState('')
  const [budgetHours, setBudgetHours] = useState('')
  const [timeRecordingMode, setTimeRecordingMode] = useState<'hours' | 'start_end'>('hours')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoadingData(true)

      // Load customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name')
        .order('name')
      setCustomers(customersData || [])

      // Load project
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectData) {
        setProject(projectData)
        setName(projectData.name)
        setCode(projectData.code || '')
        setDescription(projectData.description || '')
        setCustomerId(projectData.customer_id)
        setBillingType(projectData.billing_type)
        setHourlyRate(projectData.hourly_rate?.toString() || '')
        setFixedPrice(projectData.fixed_price?.toString() || '')
        setBudgetHours(projectData.budget_hours?.toString() || '')
        setTimeRecordingMode(projectData.time_recording_mode || 'hours')
        setIsActive(projectData.is_active)
      }

      setLoadingData(false)
    }

    loadData()
  }, [supabase, projectId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.set('customer_id', customerId)
    formData.set('name', name)
    formData.set('code', code)
    formData.set('description', description)
    formData.set('billing_type', billingType)
    formData.set('hourly_rate', hourlyRate)
    formData.set('fixed_price', fixedPrice)
    formData.set('budget_hours', budgetHours)
    formData.set('time_recording_mode', timeRecordingMode)
    formData.set('is_active', isActive.toString())

    const result = await updateProject(projectId, formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(`/projects/${projectId}`)
    }
  }

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[rgba(232,236,255,0.6)]">Loading...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-[rgba(232,236,255,0.6)]">Project not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>
        <h1 className="text-2xl font-bold text-white">Edit Project</h1>
        <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
          Update project details and settings
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div
          className="p-6 rounded-[18px] space-y-5"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Customer */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Customer *
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
              style={inputStyle}
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Website Redesign"
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Project Code */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Project Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ACME-WEB"
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief project description..."
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none resize-none"
              style={inputStyle}
            />
          </div>

          {/* Billing Type */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Billing Type *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="billing_type"
                  value="hourly"
                  checked={billingType === 'hourly'}
                  onChange={() => setBillingType('hourly')}
                  className="text-[#1f5bff]"
                />
                <span className="text-[13px] text-white">Hourly</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="billing_type"
                  value="fixed"
                  checked={billingType === 'fixed'}
                  onChange={() => setBillingType('fixed')}
                  className="text-[#1f5bff]"
                />
                <span className="text-[13px] text-white">Fixed Price</span>
              </label>
            </div>
          </div>

          {/* Time Recording Mode */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Time Recording Mode
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="time_recording_mode"
                  value="hours"
                  checked={timeRecordingMode === 'hours'}
                  onChange={() => setTimeRecordingMode('hours')}
                  className="text-[#1f5bff]"
                />
                <span className="text-[13px] text-white">Direct Hours</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="time_recording_mode"
                  value="start_end"
                  checked={timeRecordingMode === 'start_end'}
                  onChange={() => setTimeRecordingMode('start_end')}
                  className="text-[#1f5bff]"
                />
                <span className="text-[13px] text-white">Start/End Time</span>
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-[rgba(232,236,255,0.5)]">
              {timeRecordingMode === 'hours'
                ? 'Team members enter total hours worked directly'
                : 'Team members enter start time, end time, and break duration'}
            </p>
          </div>

          {/* Rate/Price */}
          <div className="grid grid-cols-2 gap-4">
            {billingType === 'hourly' ? (
              <div>
                <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                  Hourly Rate (EUR)
                </label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  step="0.01"
                  min="0"
                  placeholder="e.g. 85.00"
                  className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                  style={inputStyle}
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                  Fixed Price (EUR)
                </label>
                <input
                  type="number"
                  value={fixedPrice}
                  onChange={(e) => setFixedPrice(e.target.value)}
                  step="0.01"
                  min="0"
                  placeholder="e.g. 5000.00"
                  className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                  style={inputStyle}
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Budget Hours
              </label>
              <input
                type="number"
                value={budgetHours}
                onChange={(e) => setBudgetHours(e.target.value)}
                step="0.5"
                min="0"
                placeholder="e.g. 100"
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <label htmlFor="is_active" className="text-[13px] text-[rgba(232,236,255,0.8)]">
              Project is active
            </label>
          </div>
        </div>

        {error && (
          <div
            className="text-[13px] p-3 rounded-[10px]"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#1f5bff' }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href={`/projects/${projectId}`}
            className="px-5 py-2.5 rounded-[12px] text-[13px] font-medium text-[rgba(255,255,255,0.8)]"
            style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)' }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
