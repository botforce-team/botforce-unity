'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCompanyInfo, updateCompanyAddress, updateCompanyContact } from '@/app/actions/settings'

interface Company {
  name: string | null
  legal_name: string | null
  vat_number: string | null
  registration_number: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  email: string | null
  phone: string | null
  website: string | null
}

const cardStyle = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
}

const inputStyle = {
  background: 'rgba(0, 0, 0, 0.25)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
}

export function CompanyInfoForm({ company }: { company: Company }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [name, setName] = useState(company.name || '')
  const [legalName, setLegalName] = useState(company.legal_name || '')
  const [vatNumber, setVatNumber] = useState(company.vat_number || '')
  const [registrationNumber, setRegistrationNumber] = useState(company.registration_number || '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData()
    formData.set('name', name)
    formData.set('legal_name', legalName)
    formData.set('vat_number', vatNumber)
    formData.set('registration_number', registrationNumber)

    const result = await updateCompanyInfo(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Company information saved!' })
      router.refresh()
    }
    setLoading(false)

    // Clear success message after 3 seconds
    if (!result.error) {
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[18px] overflow-hidden" style={cardStyle}>
      <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
        <h2 className="text-[15px] font-semibold text-white">Company Information</h2>
        <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
          Basic information about your company
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Legal Name
            </label>
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
              style={inputStyle}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              VAT Number
            </label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="ATU12345678"
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Registration Number
            </label>
            <input
              type="text"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="FN 123456a"
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
              style={inputStyle}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#1f5bff' }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          {message && (
            <span
              className={`text-[13px] ${message.type === 'success' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
            >
              {message.text}
            </span>
          )}
        </div>
      </div>
    </form>
  )
}

export function AddressForm({ company }: { company: Company }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [addressLine1, setAddressLine1] = useState(company.address_line1 || '')
  const [addressLine2, setAddressLine2] = useState(company.address_line2 || '')
  const [postalCode, setPostalCode] = useState(company.postal_code || '')
  const [city, setCity] = useState(company.city || '')
  const [country, setCountry] = useState(company.country || 'AT')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData()
    formData.set('address_line1', addressLine1)
    formData.set('address_line2', addressLine2)
    formData.set('postal_code', postalCode)
    formData.set('city', city)
    formData.set('country', country)

    const result = await updateCompanyAddress(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Address saved!' })
      router.refresh()
    }
    setLoading(false)

    if (!result.error) {
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[18px] overflow-hidden" style={cardStyle}>
      <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
        <h2 className="text-[15px] font-semibold text-white">Address</h2>
        <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
          Company address for invoices
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
            Address Line 1
          </label>
          <input
            type="text"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
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
            className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
            style={inputStyle}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Postal Code
            </label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
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
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Country
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
              style={inputStyle}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#1f5bff' }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          {message && (
            <span
              className={`text-[13px] ${message.type === 'success' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
            >
              {message.text}
            </span>
          )}
        </div>
      </div>
    </form>
  )
}

export function ContactForm({ company }: { company: Company }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [email, setEmail] = useState(company.email || '')
  const [phone, setPhone] = useState(company.phone || '')
  const [website, setWebsite] = useState(company.website || '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData()
    formData.set('email', email)
    formData.set('phone', phone)
    formData.set('website', website)

    const result = await updateCompanyContact(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Contact info saved!' })
      router.refresh()
    }
    setLoading(false)

    if (!result.error) {
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[18px] overflow-hidden" style={cardStyle}>
      <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
        <h2 className="text-[15px] font-semibold text-white">Contact</h2>
        <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
          Company contact information
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
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
              className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
              style={inputStyle}
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
            Website
          </label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none"
            style={inputStyle}
          />
        </div>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#1f5bff' }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          {message && (
            <span
              className={`text-[13px] ${message.type === 'success' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
            >
              {message.text}
            </span>
          )}
        </div>
      </div>
    </form>
  )
}
