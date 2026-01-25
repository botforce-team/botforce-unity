'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Info } from 'lucide-react'
import { createCustomer } from '@/app/actions/projects'

const EU_COUNTRIES = ['DE', 'FR', 'IT', 'NL', 'BE', 'ES', 'PT', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'RO', 'BG', 'GR', 'IE', 'DK', 'SE', 'FI', 'EE', 'LV', 'LT', 'LU', 'MT', 'CY']

export default function NewCustomerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('AT')
  const [reverseCharge, setReverseCharge] = useState(false)

  // Auto-enable reverse charge for EU countries
  useEffect(() => {
    if (EU_COUNTRIES.includes(country)) {
      setReverseCharge(true)
    } else if (country === 'AT') {
      setReverseCharge(false)
    }
  }, [country])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData()
    formData.set('name', name)
    formData.set('email', email)
    formData.set('phone', phone)
    formData.set('vat_number', vatNumber)
    formData.set('address_line1', addressLine1)
    formData.set('address_line2', addressLine2)
    formData.set('postal_code', postalCode)
    formData.set('city', city)
    formData.set('country', country)
    formData.set('reverse_charge', String(reverseCharge))

    const result = await createCustomer(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/customers')
    }
  }

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  const isEuCountry = EU_COUNTRIES.includes(country)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-2 text-[13px] text-[rgba(232,236,255,0.6)] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Link>
        <h1 className="text-2xl font-bold text-white">New Customer</h1>
        <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
          Add a new customer to your company
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
          <h2 className="text-[14px] font-semibold text-white">Basic Information</h2>

          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Company Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Acme GmbH"
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* VAT Number */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              VAT Number {reverseCharge && <span className="text-[#f59e0b]">(Required for Reverse Charge)</span>}
            </label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="DE123456789"
              required={reverseCharge}
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@acme.de"
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49 30 12345678"
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div
          className="p-6 rounded-[18px] space-y-5"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h2 className="text-[14px] font-semibold text-white">Address</h2>

          {/* Address Lines */}
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Address Line 1
            </label>
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Musterstraße 123"
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Address Line 2
            </label>
            <input
              type="text"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Floor 4, Office 12"
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* City, Postal, Country */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Postal Code
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="10115"
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Berlin"
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
                style={inputStyle}
              >
                <option value="AT">Austria</option>
                <option value="DE">Germany</option>
                <option value="CH">Switzerland</option>
                <option value="IT">Italy</option>
                <option value="FR">France</option>
                <option value="NL">Netherlands</option>
                <option value="BE">Belgium</option>
                <option value="CZ">Czech Republic</option>
                <option value="PL">Poland</option>
                <option value="HU">Hungary</option>
                <option value="SK">Slovakia</option>
                <option value="SI">Slovenia</option>
                <option value="HR">Croatia</option>
                <option value="GB">United Kingdom</option>
                <option value="US">United States</option>
              </select>
            </div>
          </div>
        </div>

        {/* Billing Settings */}
        <div
          className="p-6 rounded-[18px] space-y-5"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h2 className="text-[14px] font-semibold text-white">Billing Settings</h2>

          {/* Reverse Charge */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="reverse_charge"
              checked={reverseCharge}
              onChange={(e) => setReverseCharge(e.target.checked)}
              className="h-4 w-4 rounded mt-0.5"
            />
            <div>
              <label htmlFor="reverse_charge" className="text-[13px] text-white font-medium">
                Reverse Charge (Steuerschuldnerschaft)
              </label>
              <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
                Enable for B2B customers in other EU countries. VAT will not be charged on invoices.
              </p>
            </div>
          </div>

          {isEuCountry && (
            <div
              className="flex items-start gap-3 p-3 rounded-[10px]"
              style={{
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
              }}
            >
              <Info className="h-4 w-4 text-[#3b82f6] mt-0.5 shrink-0" />
              <p className="text-[12px] text-[#93c5fd]">
                This customer is in an EU country. Reverse charge is automatically enabled for B2B transactions.
                The invoice will show "Steuerschuldnerschaft des Leistungsempfängers" and VAT number is required.
              </p>
            </div>
          )}
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
            disabled={loading || !name.trim()}
            className="px-5 py-2.5 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#1f5bff' }}
          >
            {loading ? 'Creating...' : 'Create Customer'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-[12px] text-[13px] text-[rgba(255,255,255,0.6)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
