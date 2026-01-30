'use client'

import { useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import { Upload, X, Loader2 } from 'lucide-react'
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import {
  updateCompanyInfo,
  updateCompanySettings,
  updateUserProfile,
  uploadCompanyLogo,
  removeCompanyLogo,
  type CompanyInfo,
  type CompanySettings,
} from '@/app/actions/settings'

interface CompanyInfoFormProps {
  company: CompanyInfo
}

export function CompanyInfoForm({ company }: CompanyInfoFormProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(company.logo_url)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateCompanyInfo({
        name: formData.get('name') as string,
        legal_name: formData.get('legal_name') as string,
        vat_number: formData.get('vat_number') as string || null,
        registration_number: formData.get('registration_number') as string || null,
        address_line1: formData.get('address_line1') as string || null,
        address_line2: formData.get('address_line2') as string || null,
        postal_code: formData.get('postal_code') as string || null,
        city: formData.get('city') as string || null,
        country: formData.get('country') as string,
        email: formData.get('email') as string || null,
        phone: formData.get('phone') as string || null,
        website: formData.get('website') as string || null,
      })

      if (result.success) {
        setMessage({ type: 'success', text: 'Company information updated successfully' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update' })
      }

      setTimeout(() => setMessage(null), 3000)
    })
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingLogo(true)
    const formData = new FormData()
    formData.append('logo', file)

    try {
      const result = await uploadCompanyLogo(formData)
      if (result.success && result.data?.logo_url) {
        setLogoUrl(result.data.logo_url)
        setMessage({ type: 'success', text: 'Logo uploaded successfully' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to upload logo' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to upload logo' })
    } finally {
      setIsUploadingLogo(false)
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleRemoveLogo = async () => {
    setIsUploadingLogo(true)
    try {
      const result = await removeCompanyLogo()
      if (result.success) {
        setLogoUrl(null)
        setMessage({ type: 'success', text: 'Logo removed successfully' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to remove logo' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove logo' })
    } finally {
      setIsUploadingLogo(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo Upload Section */}
          <div className="space-y-3">
            <Label>Company Logo</Label>
            <div className="flex items-start gap-4">
              {logoUrl ? (
                <div className="relative group">
                  <div className="relative h-20 w-40 rounded-lg border border-border overflow-hidden bg-white">
                    <Image
                      src={logoUrl}
                      alt="Company logo"
                      fill
                      className="object-contain p-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={isUploadingLogo}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-danger text-white hover:bg-danger/90 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove logo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center h-20 w-40 rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer bg-surface transition-colors"
                >
                  {isUploadingLogo ? (
                    <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-text-muted mb-1" />
                      <span className="text-xs text-text-muted">Upload logo</span>
                    </>
                  )}
                </div>
              )}
              <div className="text-xs text-text-muted space-y-1">
                <p>Recommended size: 400x200 pixels</p>
                <p>Formats: PNG, JPEG, SVG, WebP</p>
                <p>Max size: 2MB</p>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="mt-2"
                  >
                    Change logo
                  </Button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input id="name" name="name" defaultValue={company.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_name">Legal Name *</Label>
              <Input id="legal_name" name="legal_name" defaultValue={company.legal_name} required />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vat_number">VAT Number</Label>
              <Input id="vat_number" name="vat_number" defaultValue={company.vat_number || ''} placeholder="ATU12345678" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration_number">Registration Number</Label>
              <Input id="registration_number" name="registration_number" defaultValue={company.registration_number || ''} placeholder="FN 123456a" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_line1">Address Line 1</Label>
            <Input id="address_line1" name="address_line1" defaultValue={company.address_line1 || ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input id="address_line2" name="address_line2" defaultValue={company.address_line2 || ''} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input id="postal_code" name="postal_code" defaultValue={company.postal_code || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={company.city || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" defaultValue={company.country} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={company.email || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={company.phone || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" defaultValue={company.website || ''} placeholder="https://" />
            </div>
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

interface InvoiceSettingsFormProps {
  settings: CompanySettings
}

export function InvoiceSettingsForm({ settings }: InvoiceSettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateCompanySettings({
        default_payment_terms_days: Number(formData.get('payment_terms')),
        invoice_prefix: formData.get('invoice_prefix') as string,
        credit_note_prefix: formData.get('credit_note_prefix') as string,
        default_tax_rate: formData.get('default_tax_rate') as string,
        mileage_rate: Number(formData.get('mileage_rate')),
      })

      if (result.success) {
        setMessage({ type: 'success', text: 'Invoice settings updated successfully' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update' })
      }

      setTimeout(() => setMessage(null), 3000)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
              <Input id="invoice_prefix" name="invoice_prefix" defaultValue={settings.invoice_prefix} placeholder="INV" />
              <p className="text-xs text-text-muted">e.g., INV-2024-0001</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit_note_prefix">Credit Note Prefix</Label>
              <Input id="credit_note_prefix" name="credit_note_prefix" defaultValue={settings.credit_note_prefix} placeholder="CN" />
              <p className="text-xs text-text-muted">e.g., CN-2024-0001</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment_terms">Default Payment Terms (days)</Label>
              <Input
                id="payment_terms"
                name="payment_terms"
                type="number"
                min="0"
                max="365"
                defaultValue={settings.default_payment_terms_days}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_tax_rate">Default Tax Rate</Label>
              <select
                id="default_tax_rate"
                name="default_tax_rate"
                defaultValue={settings.default_tax_rate}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="standard_20">Standard (20%)</option>
                <option value="reduced_10">Reduced (10%)</option>
                <option value="reduced_13">Reduced (13%)</option>
                <option value="exempt_0">Exempt (0%)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mileage_rate">Mileage Rate (EUR/km)</Label>
            <Input
              id="mileage_rate"
              name="mileage_rate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={settings.mileage_rate}
            />
            <p className="text-xs text-text-muted">Rate used for mileage expense calculations</p>
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

interface UserProfileFormProps {
  profile: {
    id: string
    email: string
    full_name: string | null
    phone: string | null
    avatar_url: string | null
    role: string
    hourly_rate: number | null
  }
}

export function UserProfileForm({ profile }: UserProfileFormProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateUserProfile({
        full_name: formData.get('full_name') as string,
        phone: formData.get('phone') as string || undefined,
      })

      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update' })
      }

      setTimeout(() => setMessage(null), 3000)
    })
  }

  const roleLabels: Record<string, string> = {
    superadmin: 'Super Admin',
    employee: 'Employee',
    accountant: 'Accountant',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-muted text-xl font-semibold text-primary">
              {profile.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
            </div>
            <div>
              <p className="font-medium text-text-primary">{profile.email}</p>
              <p className="text-sm text-text-secondary">{roleLabels[profile.role] || profile.role}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" name="full_name" defaultValue={profile.full_name || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={profile.phone || ''} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled className="bg-surface" />
              <p className="text-xs text-text-muted">Email cannot be changed</p>
            </div>
            {profile.hourly_rate !== null && (
              <div className="space-y-2">
                <Label>Hourly Rate</Label>
                <Input value={`€${profile.hourly_rate}`} disabled className="bg-surface" />
                <p className="text-xs text-text-muted">Contact admin to change</p>
              </div>
            )}
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Update Profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
