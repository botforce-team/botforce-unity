import { describe, it, expect } from 'vitest'
import { calculateMileageExpense } from './mileage'

describe('calculateMileageExpense', () => {
  it('calculates expense with default rate', () => {
    const result = calculateMileageExpense(100)
    expect(result.amount).toBe(42) // 100 * 0.42
    expect(result.description).toContain('100 km')
    expect(result.description).toContain('0.42')
  })

  it('calculates expense with custom rate', () => {
    const result = calculateMileageExpense(50, 0.5)
    expect(result.amount).toBe(25) // 50 * 0.5
    expect(result.description).toContain('0.50')
  })

  it('rounds to 2 decimal places', () => {
    const result = calculateMileageExpense(33.33, 0.42)
    expect(result.amount).toBe(14) // 33.33 * 0.42 = 13.9986 -> 14.00
  })

  it('handles zero distance', () => {
    const result = calculateMileageExpense(0)
    expect(result.amount).toBe(0)
  })

  it('handles decimal distances', () => {
    const result = calculateMileageExpense(10.5, 0.42)
    expect(result.amount).toBe(4.41) // 10.5 * 0.42 = 4.41
  })

  it('includes correct description format', () => {
    const result = calculateMileageExpense(75, 0.42)
    expect(result.description).toBe('Mileage: 75 km @ €0.42/km')
  })
})
