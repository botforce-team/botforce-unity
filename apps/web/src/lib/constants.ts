import type { ExpenseCategory, TaxRate } from '@/types'

export const expenseCategories: { value: ExpenseCategory; label: string }[] = [
  { value: 'mileage', label: 'Mileage' },
  { value: 'travel_time', label: 'Travel Time' },
  { value: 'materials', label: 'Materials' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'meals', label: 'Meals' },
  { value: 'transport', label: 'Transport' },
  { value: 'communication', label: 'Communication' },
  { value: 'software', label: 'Software' },
  { value: 'other', label: 'Other' },
]

export const taxRateOptions: { value: TaxRate; label: string }[] = [
  { value: 'standard_20', label: '20% (Standard)' },
  { value: 'reduced_10', label: '10% (Reduced)' },
  { value: 'zero', label: '0% (Tax Exempt)' },
  { value: 'reverse_charge', label: 'Reverse Charge' },
]

export const countryOptions = [
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

export const currencyOptions = [
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'USD', label: 'USD - US Dollar' },
]
