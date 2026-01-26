import { describe, it, expect } from 'vitest'
import { cn, formatCurrency, formatDate, formatHours, getTaxPercent, getStatusColor } from './utils'

describe('cn (classname merger)', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', true && 'bar', false && 'baz')).toBe('foo bar')
  })

  it('merges Tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })
})

describe('formatCurrency', () => {
  it('formats EUR amounts correctly', () => {
    const result = formatCurrency(1234.56)
    // Austrian locale uses € with space
    expect(result).toMatch(/1[\.\s]?234,56/)
    expect(result).toContain('€')
  })

  it('handles zero amounts', () => {
    const result = formatCurrency(0)
    expect(result).toMatch(/0,00/)
    expect(result).toContain('€')
  })

  it('handles negative amounts', () => {
    const result = formatCurrency(-100.50)
    expect(result).toContain('100,50')
    expect(result).toContain('€')
  })

  it('supports different currencies', () => {
    const result = formatCurrency(100, 'USD')
    expect(result).toMatch(/100,00/)
    expect(result).toContain('$')
  })
})

describe('formatDate', () => {
  it('formats date strings correctly', () => {
    const result = formatDate('2026-01-15')
    expect(result).toBe('15.01.2026')
  })

  it('formats Date objects correctly', () => {
    const result = formatDate(new Date('2026-06-20'))
    expect(result).toBe('20.06.2026')
  })
})

describe('formatHours', () => {
  it('formats whole hours correctly', () => {
    expect(formatHours(8)).toBe('8:00')
  })

  it('formats fractional hours correctly', () => {
    expect(formatHours(8.5)).toBe('8:30')
  })

  it('formats quarter hours correctly', () => {
    expect(formatHours(2.25)).toBe('2:15')
  })

  it('formats zero hours correctly', () => {
    expect(formatHours(0)).toBe('0:00')
  })

  it('handles small fractions', () => {
    expect(formatHours(0.1)).toBe('0:06')
  })
})

describe('getTaxPercent', () => {
  it('returns 20 for standard_20', () => {
    expect(getTaxPercent('standard_20')).toBe(20)
  })

  it('returns 10 for reduced_10', () => {
    expect(getTaxPercent('reduced_10')).toBe(10)
  })

  it('returns 0 for zero', () => {
    expect(getTaxPercent('zero')).toBe(0)
  })

  it('returns 20 as default for unknown values', () => {
    expect(getTaxPercent('unknown')).toBe(20)
  })
})

describe('getStatusColor', () => {
  it('returns correct color for draft', () => {
    expect(getStatusColor('draft')).toContain('gray')
  })

  it('returns correct color for submitted', () => {
    expect(getStatusColor('submitted')).toContain('blue')
  })

  it('returns correct color for approved', () => {
    expect(getStatusColor('approved')).toContain('green')
  })

  it('returns correct color for rejected', () => {
    expect(getStatusColor('rejected')).toContain('red')
  })

  it('returns correct color for invoiced', () => {
    expect(getStatusColor('invoiced')).toContain('purple')
  })

  it('returns correct color for issued', () => {
    expect(getStatusColor('issued')).toContain('green')
  })

  it('returns correct color for paid', () => {
    expect(getStatusColor('paid')).toContain('emerald')
  })

  it('returns correct color for cancelled', () => {
    expect(getStatusColor('cancelled')).toContain('gray')
  })

  it('returns gray for unknown status', () => {
    expect(getStatusColor('unknown')).toContain('gray')
  })
})
