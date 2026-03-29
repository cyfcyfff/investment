import { describe, it, expect } from 'vitest'
import { isValidTicker, isValidCurrency, isValidDate, isValidWeight } from '../validators'

describe('isValidTicker', () => {
  it('should accept valid tickers', () => {
    expect(isValidTicker('SPY')).toBe(true)
    expect(isValidTicker('VT')).toBe(true)
    expect(isValidTicker('GLD')).toBe(true)
    expect(isValidTicker('BIL')).toBe(true)
  })

  it('should accept single character tickers', () => {
    expect(isValidTicker('A')).toBe(true)
    expect(isValidTicker('Z')).toBe(true)
  })

  it('should accept tickers with dots and hyphens', () => {
    expect(isValidTicker('BRK.B')).toBe(true)
    expect(isValidTicker('VTI-A')).toBe(true)
  })

  it('should reject lowercase tickers', () => {
    expect(isValidTicker('spy')).toBe(false)
    expect(isValidTicker('Spy')).toBe(false)
  })

  it('should reject empty string', () => {
    expect(isValidTicker('')).toBe(false)
  })

  it('should reject tickers with special characters', () => {
    expect(isValidTicker('SPY@')).toBe(false)
    expect(isValidTicker('SP Y')).toBe(false)
  })

  it('should reject tickers starting with dot or hyphen', () => {
    expect(isValidTicker('.SPY')).toBe(false)
    expect(isValidTicker('-SPY')).toBe(false)
  })
})

describe('isValidCurrency', () => {
  it('should accept major currencies', () => {
    expect(isValidCurrency('USD')).toBe(true)
    expect(isValidCurrency('EUR')).toBe(true)
    expect(isValidCurrency('GBP')).toBe(true)
    expect(isValidCurrency('JPY')).toBe(true)
    expect(isValidCurrency('CNY')).toBe(true)
  })

  it('should accept other valid currencies', () => {
    expect(isValidCurrency('AUD')).toBe(true)
    expect(isValidCurrency('CHF')).toBe(true)
    expect(isValidCurrency('KRW')).toBe(true)
  })

  it('should reject invalid currencies', () => {
    expect(isValidCurrency('')).toBe(false)
    expect(isValidCurrency('XYZ')).toBe(false)
    expect(isValidCurrency('usd')).toBe(false)
    expect(isValidCurrency('US')).toBe(false)
  })
})

describe('isValidDate', () => {
  it('should accept valid dates in YYYY-MM-DD format', () => {
    expect(isValidDate('2024-01-15')).toBe(true)
    expect(isValidDate('2023-12-31')).toBe(true)
    expect(isValidDate('2000-01-01')).toBe(true)
  })

  it('should reject invalid dates', () => {
    expect(isValidDate('2024-13-01')).toBe(false)
    expect(isValidDate('not-a-date')).toBe(false)
    expect(isValidDate('')).toBe(false)
  })

  it('should reject dates in wrong format', () => {
    expect(isValidDate('01/15/2024')).toBe(false)
    expect(isValidDate('2024/01/15')).toBe(false)
    expect(isValidDate('20240115')).toBe(false)
  })
})

describe('isValidWeight', () => {
  it('should accept valid weights', () => {
    expect(isValidWeight(0)).toBe(true)
    expect(isValidWeight(0.25)).toBe(true)
    expect(isValidWeight(0.5)).toBe(true)
    expect(isValidWeight(1)).toBe(true)
  })

  it('should reject weights outside [0, 1]', () => {
    expect(isValidWeight(-0.1)).toBe(false)
    expect(isValidWeight(1.1)).toBe(false)
    expect(isValidWeight(100)).toBe(false)
  })

  it('should reject NaN', () => {
    expect(isValidWeight(NaN)).toBe(false)
  })

  it('should reject non-numbers', () => {
    expect(isValidWeight('0.5' as unknown as number)).toBe(false)
  })
})
