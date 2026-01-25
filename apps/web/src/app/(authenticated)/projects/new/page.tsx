'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createProject, createCustomer } from '@/app/actions/projects'
import { createClient } from '@/lib/supabase/client'

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [billingType, setBillingType] = useState<'hourly' | 'fixed'>('hourly')
  const [timeRecordingMode, setTimeRecordingMode] = useState<'hours' | 'start_end'>('hours')

  useEffect(() => {
    async function loadCustomers() {
      const { data } = await supabase
        .from('customers')
        .select('id, name')
        .order('name')
      setCustomers(data || [])
    }
    loadCustomers()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createProject(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/projects')
    }
  }

  async function handleCreateCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await createCustomer(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setCustomers([...customers, result.data])
      setShowNewCustomer(false)
    }
    setLoading(false)
  }

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <h1 className="text-2xl font-bold text-white">New Project</h1>
        <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
          Create a new project for your team
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
            <div className="flex gap-2">
              <select
                name="customer_id"
                required
                className="flex-1 px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
                style={inputStyle}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="px-3 py-2 rounded-[12px] text-[13px] text-[rgba(255,255,255,0.8)]"
                style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)' }}
              >
                + New
              </button>
            </div>
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Project Name *
            </label>
            <input
              type="text"
              name="name"
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
              name="code"
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
              name="description"
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
                  name="hourly_rate"
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
                  name="fixed_price"
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
                name="budget_hours"
                step="0.5"
                min="0"
                placeholder="e.g. 100"
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                style={inputStyle}
              />
            </div>
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
            {loading ? 'Creating...' : 'Create Project'}
          </button>
          <Link
            href="/projects"
            className="px-5 py-2.5 rounded-[12px] text-[13px] font-medium text-[rgba(255,255,255,0.8)]"
            style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)' }}
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* New Customer Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0, 0, 0, 0.75)' }}>
          <div
            className="w-full max-w-md p-6 rounded-[18px]"
            style={{
              background: '#0b1020',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <h2 className="text-lg font-semibold text-white mb-4">New Customer</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
                  style={inputStyle}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white"
                  style={{ background: '#1f5bff' }}
                >
                  Create Customer
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(false)}
                  className="px-4 py-2 rounded-[12px] text-[13px] text-[rgba(255,255,255,0.6)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
