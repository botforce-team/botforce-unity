'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from '@/components/ui'
import { createCustomer, updateCustomer, type CreateCustomerInput } from '@/app/actions/customers'
import type { Customer } from '@/types'

interface CustomerFormProps {
  customer?: Customer
}

const taxRateOptions = [
  { value: 'standard_20', label: '20% (Standard)' },
  { value: 'reduced_10', label: '10% (Reduced)' },
  { value: 'zero', label: '0% (Tax Exempt)' },
  { value: 'reverse_charge', label: 'Reverse Charge' },
]

const countryOptions = [
  { value: 'AT', label: 'Austria' },
  { value: 'DE', label: 'Germany' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'IT', label: 'Italy' },
  { value: 'HU', label: 'Hungary' },
  { value: 'CZ', label: 'Czech Republic' },
  { value: 'SK', label: 'Slovakia' },
  { value: 'SI', label: 'Slovenia' },
  { value: 'HR', label: 'Croatia' },
  { value: 'PL', label: 'Poland' },
]

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!customer

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const input: CreateCustomerInput = {
        name: formData.get('name') as string,
        legal_name: (formData.get('legal_name') as string) || null,
        vat_number: (formData.get('vat_number') as string) || null,
        tax_exempt: formData.get('tax_exempt') === 'on',
        reverse_charge: formData.get('reverse_charge') === 'on',
        email: (formData.get('email') as string) || null,
        phone: (formData.get('phone') as string) || null,
        address_line1: (formData.get('address_line1') as string) || null,
        address_line2: (formData.get('address_line2') as string) || null,
        postal_code: (formData.get('postal_code') as string) || null,
        city: (formData.get('city') as string) || null,
        country: (formData.get('country') as string) || 'AT',
        payment_terms_days: parseInt(formData.get('payment_terms_days') as string) || 14,
        default_tax_rate: formData.get('default_tax_rate') as string || 'standard_20',
        currency: (formData.get('currency') as string) || 'EUR',
        notes: (formData.get('notes') as string) || null,
        skonto_percent: formData.get('skonto_percent')
          ? parseFloat(formData.get('skonto_percent') as string)
          : null,
        skonto_days: formData.get('skonto_days')
          ? parseInt(formData.get('skonto_days') as string)
          : null,
      }

      const result = isEditing
        ? await updateCustomer(customer.id, input)
        : await createCustomer(input)

      if (result.success) {
        router.push(isEditing ? `/customers/${customer.id}` : '/customers')
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Customer Name *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={customer?.name}
                  placeholder="Acme GmbH"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_name">Legal Name</Label>
                <Input
                  id="legal_name"
                  name="legal_name"
                  defaultValue={customer?.legal_name || ''}
                  placeholder="Acme Gesellschaft mit beschränkter Haftung"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={customer?.email || ''}
                  placeholder="contact@acme.at"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={customer?.phone || ''}
                  placeholder="+43 1 234 5678"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                name="address_line1"
                defaultValue={customer?.address_line1 || ''}
                placeholder="Hauptstraße 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                name="address_line2"
                defaultValue={customer?.address_line2 || ''}
                placeholder="Floor 3, Suite 42"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  defaultValue={customer?.postal_code || ''}
                  placeholder="1010"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={customer?.city || ''}
                  placeholder="Vienna"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  id="country"
                  name="country"
                  defaultValue={customer?.country || 'AT'}
                  options={countryOptions}
                />
              </div>
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
                <Label htmlFor="vat_number">VAT Number</Label>
                <Input
                  id="vat_number"
                  name="vat_number"
                  defaultValue={customer?.vat_number || ''}
                  placeholder="ATU12345678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms_days">Payment Terms (days)</Label>
                <Input
                  id="payment_terms_days"
                  name="payment_terms_days"
                  type="number"
                  min="0"
                  defaultValue={customer?.payment_terms_days || 14}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="default_tax_rate">Default Tax Rate</Label>
                <Select
                  id="default_tax_rate"
                  name="default_tax_rate"
                  defaultValue={customer?.default_tax_rate || 'standard_20'}
                  options={taxRateOptions}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  id="currency"
                  name="currency"
                  defaultValue={customer?.currency || 'EUR'}
                  options={[
                    { value: 'EUR', label: 'EUR - Euro' },
                    { value: 'CHF', label: 'CHF - Swiss Franc' },
                    { value: 'USD', label: 'USD - US Dollar' },
                  ]}
                />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="tax_exempt"
                  defaultChecked={customer?.tax_exempt}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">Tax Exempt</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="reverse_charge"
                  defaultChecked={customer?.reverse_charge}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">Reverse Charge (EU B2B)</span>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="skonto_percent">Skonto %</Label>
                <Input
                  id="skonto_percent"
                  name="skonto_percent"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  defaultValue={customer?.skonto_percent ?? ''}
                  placeholder="z.B. 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skonto_days">Skonto Tage</Label>
                <Input
                  id="skonto_days"
                  name="skonto_days"
                  type="number"
                  min="0"
                  defaultValue={customer?.skonto_days ?? ''}
                  placeholder="z.B. 10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={customer?.notes || ''}
              placeholder="Internal notes about this customer..."
            />
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
              : 'Create Customer'}
          </Button>
        </div>
      </div>
    </form>
  )
}
