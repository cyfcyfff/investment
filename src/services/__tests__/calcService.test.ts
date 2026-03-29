import { describe, it, expect } from 'vitest'
import {
  calcMarketValue,
  calculateCategoryWeights,
  isRebalanceTriggered,
} from '../calcService'
import type { AssetHolding, RebalanceConfig } from '../../types'
import { Category, DEFAULT_REBALANCE_CONFIG } from '../../types'

function makeHolding(overrides: Partial<AssetHolding> & { ticker: string }): AssetHolding {
  return {
    id: `h-${overrides.ticker}`,
    name: overrides.ticker,
    category: Category.STOCKS,
    currency: 'USD',
    buyPrice: 100,
    quantity: 1,
    fee: 0,
    buyDate: '2024-01-01',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('calcMarketValue', () => {
  it('should calculate market value with default fxRate', () => {
    expect(calcMarketValue(10, 100)).toBe(1000)
  })

  it('should apply fxRate', () => {
    expect(calcMarketValue(10, 100, 0.5)).toBe(500)
  })

  it('should handle zero values', () => {
    expect(calcMarketValue(0, 100)).toBe(0)
    expect(calcMarketValue(10, 0)).toBe(0)
  })
})

describe('calculateCategoryWeights', () => {
  it('should return zero for all categories with empty holdings', () => {
    const weights = calculateCategoryWeights([], {})
    for (const cat of [Category.STOCKS, Category.LONG_BONDS, Category.GOLD, Category.CASH]) {
      expect(weights[cat]).toBe(0)
    }
  })

  it('should return zero for all categories when no prices match', () => {
    const holdings = [makeHolding({ ticker: 'SPY', quantity: 10 })]
    const weights = calculateCategoryWeights(holdings, {})
    for (const cat of [Category.STOCKS, Category.LONG_BONDS, Category.GOLD, Category.CASH]) {
      expect(weights[cat]).toBe(0)
    }
  })

  it('should calculate equal weights for equal holdings', () => {
    const holdings = [
      makeHolding({ ticker: 'SPY', category: Category.STOCKS, quantity: 10 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 10 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 10 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 10 }),
    ]
    const prices = { SPY: 100, TLT: 100, GLD: 100, BIL: 100 }
    const weights = calculateCategoryWeights(holdings, prices)
    expect(weights[Category.STOCKS]).toBe(0.25)
    expect(weights[Category.LONG_BONDS]).toBe(0.25)
    expect(weights[Category.GOLD]).toBe(0.25)
    expect(weights[Category.CASH]).toBe(0.25)
  })

  it('should calculate unequal weights for unequal holdings', () => {
    const holdings = [
      makeHolding({ ticker: 'SPY', category: Category.STOCKS, quantity: 30 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 10 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 10 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 10 }),
    ]
    const prices = { SPY: 100, TLT: 100, GLD: 100, BIL: 100 }
    const weights = calculateCategoryWeights(holdings, prices)
    // Total = 6000. STOCKS = 3000/6000 = 0.5
    expect(weights[Category.STOCKS]).toBe(0.5)
    expect(weights[Category.LONG_BONDS]).toBeCloseTo(1 / 6)
    expect(weights[Category.GOLD]).toBeCloseTo(1 / 6)
    expect(weights[Category.CASH]).toBeCloseTo(1 / 6)
  })

  it('should apply FX rates for foreign currencies', () => {
    const holdings = [
      makeHolding({ ticker: 'SPY', category: Category.STOCKS, quantity: 10, currency: 'USD' }),
      makeHolding({ ticker: 'EWJ', category: Category.LONG_BONDS, quantity: 10, currency: 'JPY' }),
    ]
    const prices = { SPY: 100, EWJ: 1000 }
    const fxRates = { 'JPY-USD': 0.01 }
    const weights = calculateCategoryWeights(holdings, prices, fxRates, 'USD')
    // SPY = 10 * 100 * 1 = 1000, EWJ = 10 * 1000 * 0.01 = 100
    expect(weights[Category.STOCKS]).toBeCloseTo(1000 / 1100)
    expect(weights[Category.LONG_BONDS]).toBeCloseTo(100 / 1100)
  })

  it('should skip holdings with missing prices', () => {
    const holdings = [
      makeHolding({ ticker: 'SPY', category: Category.STOCKS, quantity: 10 }),
      makeHolding({ ticker: 'UNKNOWN', category: Category.CASH, quantity: 10 }),
    ]
    const prices = { SPY: 100 }
    const weights = calculateCategoryWeights(holdings, prices)
    expect(weights[Category.STOCKS]).toBe(1)
    expect(weights[Category.CASH]).toBe(0)
  })
})

describe('isRebalanceTriggered', () => {
  const conservativeConfig: RebalanceConfig = {
    ...DEFAULT_REBALANCE_CONFIG,
    bandPreset: 'CONSERVATIVE',
    bands: { low: 0.15, high: 0.35 },
  }

  it('should not trigger when all weights are within bands', () => {
    const weights: Record<Category, number> = {
      STOCKS: 0.25,
      LONG_BONDS: 0.25,
      GOLD: 0.25,
      CASH: 0.25,
    }
    const result = isRebalanceTriggered(weights, conservativeConfig)
    expect(result.triggered).toBe(false)
  })

  it('should trigger when a category is overweight', () => {
    const weights: Record<Category, number> = {
      STOCKS: 0.40,
      LONG_BONDS: 0.20,
      GOLD: 0.20,
      CASH: 0.20,
    }
    const result = isRebalanceTriggered(weights, conservativeConfig)
    expect(result.triggered).toBe(true)
    expect(result.breachCategories).toContain(Category.STOCKS)
    expect(result.reason).toContain('STOCKS')
  })

  it('should trigger when a category is underweight', () => {
    const weights: Record<Category, number> = {
      STOCKS: 0.10,
      LONG_BONDS: 0.30,
      GOLD: 0.30,
      CASH: 0.30,
    }
    const result = isRebalanceTriggered(weights, conservativeConfig)
    expect(result.triggered).toBe(true)
    expect(result.breachCategories).toContain(Category.STOCKS)
  })

  it('should not trigger at exact band boundaries (inclusive)', () => {
    const weights: Record<Category, number> = {
      STOCKS: 0.35,
      LONG_BONDS: 0.15,
      GOLD: 0.25,
      CASH: 0.25,
    }
    const result = isRebalanceTriggered(weights, conservativeConfig)
    expect(result.triggered).toBe(false)
  })

  it('should trigger for multiple breached categories', () => {
    const weights: Record<Category, number> = {
      STOCKS: 0.40,
      LONG_BONDS: 0.10,
      GOLD: 0.25,
      CASH: 0.25,
    }
    const result = isRebalanceTriggered(weights, conservativeConfig)
    expect(result.triggered).toBe(true)
    expect(result.breachCategories).toHaveLength(2)
    expect(result.breachCategories).toContain(Category.STOCKS)
    expect(result.breachCategories).toContain(Category.LONG_BONDS)
  })

  it('should trigger on annual review date', () => {
    const weights: Record<Category, number> = {
      STOCKS: 0.25,
      LONG_BONDS: 0.25,
      GOLD: 0.25,
      CASH: 0.25,
    }
    const lastRebalance = '2023-01-15'
    const now = new Date('2024-02-01')
    const result = isRebalanceTriggered(weights, conservativeConfig, lastRebalance, now)
    expect(result.triggered).toBe(true)
    expect(result.reason).toContain('Annual review')
  })

  it('should not trigger annual review before review date', () => {
    const weights: Record<Category, number> = {
      STOCKS: 0.25,
      LONG_BONDS: 0.25,
      GOLD: 0.25,
      CASH: 0.25,
    }
    const lastRebalance = '2024-01-15'
    const now = new Date('2024-06-01')
    const result = isRebalanceTriggered(weights, conservativeConfig, lastRebalance, now)
    expect(result.triggered).toBe(false)
  })
})
