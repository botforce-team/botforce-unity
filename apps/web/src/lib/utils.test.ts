import { describe, it, expect, vi } from 'vitest'
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatHours,
  calculateHours,
  capitalize,
  getInitials,
  isEmpty,
  calculateVat,
  calculateNet,
  calculateGross,
  KILOMETERGELD_RATE,
} from './utils'

describe('cn (classname merger)', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz')
  })

  it('merges Tailwind classes correctly', () => {
    expect(cn('p-4', 'p-6')).toBe('p-6')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles arrays and objects', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
    expect(cn({ foo: true, bar: false })).toBe('foo')
  })

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })
})

describe('formatCurrency', () => {
  it('formats EUR correctly for Austrian locale', () => {
    expect(formatCurrency(1234.56)).toMatch(/1[.,]234[.,]56/)
    expect(formatCurrency(1234.56)).toContain('€')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toContain('0')
  })

  it('handles negative numbers', () => {
    expect(formatCurrency(-100)).toMatch(/-.*100/)
  })

  it('rounds to 2 decimal places', () => {
    const result = formatCurrency(10.999)
    expect(result).toContain('11')
  })

  it('handles different currencies', () => {
    const usd = formatCurrency(100, 'USD')
    expect(usd).toContain('$')
  })
})

describe('formatDate', () => {
  it('formats date string correctly', () => {
    const result = formatDate('2024-01-15')
    expect(result).toMatch(/15.*01.*2024/)
  })

  it('formats Date object correctly', () => {
    const result = formatDate(new Date(2024, 0, 15))
    expect(result).toMatch(/15.*01.*2024/)
  })

  it('accepts custom options', () => {
    const result = formatDate('2024-01-15', { month: 'long' })
    // Austrian locale uses "Jänner" for January
    expect(result).toMatch(/Jänner|Januar|January/)
  })
})

describe('formatDateTime', () => {
  it('includes time in output', () => {
    const result = formatDateTime('2024-01-15T14:30:00')
    expect(result).toMatch(/14.*30/)
  })
})

describe('formatNumber', () => {
  it('formats with default 2 decimals', () => {
    const result = formatNumber(1234.5)
    // Austrian locale may use space or non-breaking space as thousands separator
    expect(result).toContain('234')
    expect(result).toContain('50')
  })

  it('accepts custom decimal places', () => {
    const result = formatNumber(1234.567, 3)
    expect(result).toContain('567')
  })

  it('handles zero decimals', () => {
    const result = formatNumber(1234.567, 0)
    // Rounds 1234.567 to 1235
    expect(result).toContain('235')
  })
})

describe('formatHours', () => {
  it('formats whole hours', () => {
    expect(formatHours(8)).toBe('8:00')
  })

  it('formats half hours', () => {
    expect(formatHours(7.5)).toBe('7:30')
  })

  it('formats quarter hours', () => {
    expect(formatHours(2.25)).toBe('2:15')
    expect(formatHours(2.75)).toBe('2:45')
  })

  it('handles zero', () => {
    expect(formatHours(0)).toBe('0:00')
  })

  it('pads minutes with zero', () => {
    expect(formatHours(1.083)).toBe('1:05') // ~1h 5min
  })
})

describe('calculateHours', () => {
  it('calculates hours between times', () => {
    expect(calculateHours('09:00', '17:00')).toBe(8)
    expect(calculateHours('08:30', '12:00')).toBe(3.5)
  })

  it('subtracts break time', () => {
    expect(calculateHours('09:00', '17:00', 60)).toBe(7)
    expect(calculateHours('09:00', '17:00', 30)).toBe(7.5)
  })

  it('returns 0 for invalid time ranges', () => {
    expect(calculateHours('17:00', '09:00')).toBe(0)
  })

  it('handles edge cases', () => {
    expect(calculateHours('00:00', '23:59')).toBeCloseTo(23.983, 2)
  })
})

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('handles empty string', () => {
    expect(capitalize('')).toBe('')
  })

  it('handles already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello')
  })

  it('handles single character', () => {
    expect(capitalize('a')).toBe('A')
  })
})

describe('getInitials', () => {
  it('gets initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('handles single name', () => {
    expect(getInitials('John')).toBe('J')
  })

  it('limits to 2 characters', () => {
    expect(getInitials('John Middle Doe')).toBe('JM')
  })

  it('handles lowercase names', () => {
    expect(getInitials('john doe')).toBe('JD')
  })
})

describe('isEmpty', () => {
  it('returns true for null and undefined', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty(undefined)).toBe(true)
  })

  it('returns true for empty strings', () => {
    expect(isEmpty('')).toBe(true)
    expect(isEmpty('   ')).toBe(true)
  })

  it('returns true for empty arrays', () => {
    expect(isEmpty([])).toBe(true)
  })

  it('returns true for empty objects', () => {
    expect(isEmpty({})).toBe(true)
  })

  it('returns false for non-empty values', () => {
    expect(isEmpty('hello')).toBe(false)
    expect(isEmpty([1])).toBe(false)
    expect(isEmpty({ a: 1 })).toBe(false)
    expect(isEmpty(0)).toBe(false)
    expect(isEmpty(false)).toBe(false)
  })
})

describe('VAT calculations', () => {
  describe('calculateVat', () => {
    it('calculates 20% VAT correctly', () => {
      // 120 gross = 100 net + 20 VAT
      expect(calculateVat(120, 20)).toBeCloseTo(20, 2)
    })

    it('calculates 10% VAT correctly', () => {
      // 110 gross = 100 net + 10 VAT
      expect(calculateVat(110, 10)).toBeCloseTo(10, 2)
    })

    it('handles zero VAT', () => {
      expect(calculateVat(100, 0)).toBe(0)
    })
  })

  describe('calculateNet', () => {
    it('calculates net from gross at 20%', () => {
      expect(calculateNet(120, 20)).toBeCloseTo(100, 2)
    })

    it('calculates net from gross at 10%', () => {
      expect(calculateNet(110, 10)).toBeCloseTo(100, 2)
    })
  })

  describe('calculateGross', () => {
    it('calculates gross from net at 20%', () => {
      expect(calculateGross(100, 20)).toBe(120)
    })

    it('calculates gross from net at 10%', () => {
      expect(calculateGross(100, 10)).toBeCloseTo(110, 2)
    })
  })

  it('calculations are consistent', () => {
    const net = 100
    const vatRate = 20
    const gross = calculateGross(net, vatRate)
    expect(calculateNet(gross, vatRate)).toBeCloseTo(net, 2)
    expect(calculateVat(gross, vatRate)).toBeCloseTo(gross - net, 2)
  })
})

describe('KILOMETERGELD_RATE', () => {
  it('is the correct Austrian rate', () => {
    expect(KILOMETERGELD_RATE).toBe(0.42)
  })
})
