import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency for Austrian locale (EUR)
 */
export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format date for Austrian locale
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }).format(d)
}

/**
 * Format date and time for Austrian locale
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Format number for Austrian locale
 */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('de-AT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format hours (e.g., 7.5 -> "7:30")
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

/**
 * Calculate hours from start/end time
 */
export function calculateHours(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
): number {
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  const totalMinutes = endMinutes - startMinutes - breakMinutes
  return Math.max(0, totalMinutes / 60)
}

/**
 * Generate a random UUID (client-side only, for UI purposes)
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Calculate VAT amount from gross amount
 */
export function calculateVat(grossAmount: number, vatRate: number): number {
  return grossAmount - grossAmount / (1 + vatRate / 100)
}

/**
 * Calculate net amount from gross amount
 */
export function calculateNet(grossAmount: number, vatRate: number): number {
  return grossAmount / (1 + vatRate / 100)
}

/**
 * Calculate gross amount from net amount
 */
export function calculateGross(netAmount: number, vatRate: number): number {
  return netAmount * (1 + vatRate / 100)
}

/**
 * Austrian kilometergeld rate (EUR per km)
 */
export const KILOMETERGELD_RATE = 0.42

/**
 * German month names (Austrian style - Jänner instead of Januar)
 */
export const MONTHS_DE = [
  'Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
]

/**
 * Format month and year for Austrian locale
 * @example formatMonthYear('2024-01-15') // "Jänner 2024"
 */
export function formatMonthYear(date: Date | string, locale = 'de-AT'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
}

/**
 * Get year-month key from date string
 * @example getYearMonthKey('2024-01-15') // "2024-01"
 */
export function getYearMonthKey(date: string): string {
  return date.substring(0, 7)
}

/**
 * Parse year-month key into year and month numbers
 * @example parseYearMonthKey('2024-01') // { year: 2024, month: 1 }
 */
export function parseYearMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split('-').map(Number)
  return { year, month }
}

/**
 * Get date range for a given year-month
 * @example getDateRangeForMonth('2024-01') // { from: '2024-01-01', to: '2024-01-31' }
 */
export function getDateRangeForMonth(yearMonth: string): { from: string; to: string } {
  const { year, month } = parseYearMonthKey(yearMonth)
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

/**
 * Get display name for year-month
 * @example getMonthYearDisplay('2024-01') // "Jänner 2024"
 */
export function getMonthYearDisplay(yearMonth: string): string {
  const { year, month } = parseYearMonthKey(yearMonth)
  return `${MONTHS_DE[month - 1]} ${year}`
}
