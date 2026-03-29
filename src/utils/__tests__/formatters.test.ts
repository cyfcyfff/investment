import { describe, it, expect } from 'vitest'
import { formatCurrency, formatPercent, formatNumber, generateId } from '../formatters'

describe('formatCurrency', () => {
  it('should format positive USD values', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('should format negative values with leading minus', () => {
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56')
  })

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('should support different currencies', () => {
    expect(formatCurrency(1000, 'EUR')).toBe('\u20AC1,000.00')
    expect(formatCurrency(1000, 'GBP')).toBe('\u00A31,000.00')
    expect(formatCurrency(1000, 'CNY')).toBe('\u00A51,000.00')
  })

  it('should fall back to currency code for unknown currencies', () => {
    expect(formatCurrency(1000, 'XYZ')).toBe('XYZ1,000.00')
  })

  it('should respect custom decimal places', () => {
    expect(formatCurrency(1234.5, 'USD', 0)).toBe('$1,235')
    expect(formatCurrency(1234.5678, 'USD', 4)).toBe('$1,234.5678')
  })
})

describe('formatPercent', () => {
  it('should format a decimal as percentage', () => {
    expect(formatPercent(0.25)).toBe('25.00%')
  })

  it('should handle negative values', () => {
    expect(formatPercent(-0.05)).toBe('-5.00%')
  })

  it('should handle zero', () => {
    expect(formatPercent(0)).toBe('0.00%')
  })

  it('should handle values above 1', () => {
    expect(formatPercent(1.5)).toBe('150.00%')
  })

  it('should respect custom decimal places', () => {
    expect(formatPercent(0.12345, 4)).toBe('12.3450%')
  })
})

describe('formatNumber', () => {
  it('should format with locale separators', () => {
    expect(formatNumber(1000000)).toBe('1,000,000')
  })

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('should handle negative values', () => {
    expect(formatNumber(-9999)).toBe('-9,999')
  })

  it('should handle decimals', () => {
    expect(formatNumber(1234.56)).toBe('1,234.56')
  })
})

describe('generateId', () => {
  it('should return a non-empty string', () => {
    const id = generateId()
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

  it('should generate unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })

  it('should match expected format', () => {
    const id = generateId()
    expect(id).toMatch(/^\d+-[a-z0-9]+$/)
  })
})
