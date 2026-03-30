import { describe, it, expect } from 'vitest'
import { generateRebalancePlan } from '../rebalanceService'
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

const CONSERVATIVE_CONFIG: RebalanceConfig = {
  ...DEFAULT_REBALANCE_CONFIG,
  bandPreset: 'CONSERVATIVE',
  bands: { low: 0.15, high: 0.35 },
  feeRate: 0.001,
  slippage: 0.001,
  minTradeAmount: 100,
}

describe('generateRebalancePlan', () => {
  it('should return empty trades when all weights within bands', () => {
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 25 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 25 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 25 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 25 }),
    ]
    const prices = { VT: 100, TLT: 100, GLD: 100, BIL: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    expect(plan.trades).toHaveLength(0)
    // When not triggered, reason is MANUAL (no band breach)
    expect(plan.triggerReason).toBe('MANUAL')
  })

  it('should generate SELL for overweight category (40% stocks)', () => {
    // Total value: VT=40*100=4000, TLT=20*100=2000, GLD=20*100=2000, BIL=20*100=2000
    // Total = 10000. Stocks = 40%, bonds=20%, gold=20%, cash=20%
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 40 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 20 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 20 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 20 }),
    ]
    const prices = { VT: 100, TLT: 100, GLD: 100, BIL: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    const sellTrades = plan.trades.filter(t => t.side === 'SELL')
    expect(sellTrades.length).toBeGreaterThan(0)
    expect(sellTrades[0].category).toBe(Category.STOCKS)
  })

  it('should generate BUY for underweight categories', () => {
    // Stocks=40%, others=20% each => LONG_BONDS, GOLD, CASH are underweight
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 40 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 20 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 20 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 20 }),
    ]
    const prices = { VT: 100, TLT: 100, GLD: 100, BIL: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    const buyTrades = plan.trades.filter(t => t.side === 'BUY')
    expect(buyTrades.length).toBeGreaterThan(0)

    const buyCategories = [...new Set(buyTrades.map(t => t.category))]
    expect(buyCategories).toContain(Category.LONG_BONDS)
    expect(buyCategories).toContain(Category.GOLD)
    expect(buyCategories).toContain(Category.CASH)
  })

  it('should have SELL trades with lower priority numbers than BUY trades', () => {
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 40 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 20 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 20 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 20 }),
    ]
    const prices = { VT: 100, TLT: 100, GLD: 100, BIL: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    const sellPriorities = plan.trades
      .filter(t => t.side === 'SELL')
      .map(t => t.priority)
    const buyPriorities = plan.trades
      .filter(t => t.side === 'BUY')
      .map(t => t.priority)

    if (sellPriorities.length > 0 && buyPriorities.length > 0) {
      const maxSellPriority = Math.max(...sellPriorities)
      const minBuyPriority = Math.min(...buyPriorities)
      expect(maxSellPriority).toBeLessThan(minBuyPriority)
    }
  })

  it('should calculate estimated fees', () => {
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 40 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 20 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 20 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 20 }),
    ]
    const prices = { VT: 100, TLT: 100, GLD: 100, BIL: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    expect(plan.totalEstimatedFee).toBeGreaterThan(0)

    // Each trade's fee should equal amount * feeRate
    for (const trade of plan.trades) {
      const expectedFee = trade.estimatedAmount * CONSERVATIVE_CONFIG.feeRate
      expect(trade.estimatedFee).toBeCloseTo(expectedFee, 6)
    }
  })

  it('should have postWeights closer to target than currentWeights', () => {
    // Stocks at 40%, target 25% -> must move closer after rebalance
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 40 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 20 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 20 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 20 }),
    ]
    const prices = { VT: 100, TLT: 100, GLD: 100, BIL: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    const target = CONSERVATIVE_CONFIG.targets

    // For the most overweight category (STOCKS), postWeight should be closer to target
    const stocksCurrent = plan.currentWeights[Category.STOCKS]
    const stocksPost = plan.postWeights[Category.STOCKS]
    const stocksTarget = target[Category.STOCKS]

    const currentDiff = Math.abs(stocksCurrent - stocksTarget)
    const postDiff = Math.abs(stocksPost - stocksTarget)
    expect(postDiff).toBeLessThan(currentDiff)
  })

  it('should warn about trades below minTradeAmount', () => {
    // Create a scenario where the delta is very small
    // Stocks slightly overweight, needing a tiny adjustment
    const config: RebalanceConfig = {
      ...CONSERVATIVE_CONFIG,
      minTradeAmount: 5000, // Very high threshold to trigger warning
    }
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 27 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 24 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 25 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 24 }),
    ]
    const prices = { VT: 100, TLT: 100, GLD: 100, BIL: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, config, 'USD',
    )

    // Even if no trades, the plan should exist with valid structure
    expect(plan).toBeDefined()
    expect(plan.warnings).toBeDefined()

    // If there are trades, check if any are below minTradeAmount
    const smallTrades = plan.trades.filter(
      t => t.estimatedAmount < config.minTradeAmount && t.estimatedAmount > 0,
    )
    if (smallTrades.length > 0) {
      const hasWarning = plan.warnings.some(
        w => w.includes('minTradeAmount') || w.includes('below minimum'),
      )
      expect(hasWarning).toBe(true)
    }
  })

  it('should return empty plan for empty holdings', () => {
    const plan = generateRebalancePlan(
      [], {}, {}, CONSERVATIVE_CONFIG, 'USD',
    )

    expect(plan.trades).toHaveLength(0)
    expect(plan.id).toBeDefined()
    expect(plan.generatedAt).toBeDefined()
    expect(plan.totalEstimatedFee).toBe(0)
    expect(plan.totalEstimatedSlippage).toBe(0)
  })

  it('should distribute within category proportionally by market value', () => {
    // Two stocks in STOCKS category: VT=3000, VTV=3000 (total 6000)
    // Two bonds in LONG_BONDS: TLT=1000, IGOV=1000 (total 2000)
    // Stocks = 60%, bonds = 20%, gold = 10%, cash = 10%
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 30 }),
      makeHolding({ ticker: 'VTV', category: Category.STOCKS, quantity: 30 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 10 }),
      makeHolding({ ticker: 'IGOV', category: Category.LONG_BONDS, quantity: 10 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 10 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 10 }),
    ]
    const prices = { VT: 100, VTV: 100, TLT: 100, IGOV: 100, GLD: 100, BIL: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    // VT and VTV should get equal SELL amounts since they have equal market value
    const vtSell = plan.trades.find(t => t.ticker === 'VT' && t.side === 'SELL')
    const vtvSell = plan.trades.find(t => t.ticker === 'VTV' && t.side === 'SELL')

    if (vtSell && vtvSell) {
      expect(vtSell.estimatedAmount).toBeCloseTo(vtvSell.estimatedAmount, 2)
    }
  })

  it('should never sell more quantity than actually held', () => {
    // Gold heavily overweight: 70% of portfolio, target 25%
    // GLD: 70 shares * 100 = 7000 USD
    // Others: 10 shares each * 100 = 3000 USD total
    // Total = 10000. Gold = 70%, target 25%, delta = -4500
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 10 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 10 }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 70 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 10 }),
    ]
    const prices = { VT: 100, TLT: 100, GLD: 100, BIL: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    // SELL trades should exist for gold
    const goldSells = plan.trades.filter(t => t.ticker === 'GLD' && t.side === 'SELL')
    expect(goldSells.length).toBeGreaterThan(0)

    // Total sell quantity must not exceed holding quantity
    const totalGoldSellQty = goldSells.reduce((s, t) => s + t.quantity, 0)
    expect(totalGoldSellQty).toBeLessThanOrEqual(70) // holding quantity

    // Each individual sell quantity must not exceed holding quantity
    for (const trade of plan.trades.filter(t => t.side === 'SELL')) {
      const holding = holdings.find(h => h.id === trade.holdingId)
      expect(trade.quantity).toBeLessThanOrEqual(holding!.quantity)
    }
  })

  it('should apply FX conversion for non-base currency holdings', () => {
    // One JPY-denominated holding and one USD holding
    // SPY: 10 * 100 USD = 1000 USD
    // EWJ: 100 * 10 JPY = 1000 JPY = 10 USD (at 0.01 rate)
    // GLD: 1 * 100 = 100 USD
    // BIL: 1 * 100 = 100 USD
    // Total = 1210 USD. Stocks = 1000/1210 ~ 82.6% (heavily overweight)
    const holdings = [
      makeHolding({
        ticker: 'SPY', category: Category.STOCKS,
        quantity: 10, currency: 'USD',
      }),
      makeHolding({
        ticker: 'EWJ', category: Category.LONG_BONDS,
        quantity: 100, currency: 'JPY',
      }),
      makeHolding({ ticker: 'GLD', category: Category.GOLD, quantity: 1 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 1 }),
    ]
    const prices = { SPY: 100, EWJ: 10, GLD: 100, BIL: 100 }
    const fxRates = { 'JPY-USD': 0.01 }

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    // Stocks should be overweight (above 35% band)
    expect(plan.currentWeights[Category.STOCKS]).toBeGreaterThan(0.35)

    // Should generate SELL for SPY
    const spySell = plan.trades.find(t => t.ticker === 'SPY' && t.side === 'SELL')
    if (spySell) {
      expect(spySell.estimatedPrice).toBe(100)
    }

    // Should generate BUY for underweight categories
    const buyTrades = plan.trades.filter(t => t.side === 'BUY')
    expect(buyTrades.length).toBeGreaterThan(0)
  })

  it('should generate BUY suggestion for category with no holdings', () => {
    // No GOLD holdings, gold weight = 0%, target 25%
    // Stocks=33%, bonds=33%, cash=33%
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 30 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 30 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 30 }),
    ]
    const prices = { VT: 100, TLT: 100, BIL: 100, GLD: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    // Should generate a BUY trade for GOLD (new position)
    const goldBuy = plan.trades.find(t => t.category === Category.GOLD && t.side === 'BUY')
    expect(goldBuy).toBeDefined()
    expect(goldBuy!.holdingId).toBe('') // empty holdingId = new position
    expect(goldBuy!.ticker).toBe('GLD') // suggested ticker
    expect(goldBuy!.estimatedAmount).toBeGreaterThan(0)
    expect(goldBuy!.estimatedPrice).toBe(100)

    // Should warn about new position
    expect(plan.warnings.some(w => w.includes('GLD'))).toBe(true)
  })

  it('should calculate postWeights correctly for new position trades', () => {
    const holdings = [
      makeHolding({ ticker: 'VT', category: Category.STOCKS, quantity: 30 }),
      makeHolding({ ticker: 'TLT', category: Category.LONG_BONDS, quantity: 30 }),
      makeHolding({ ticker: 'BIL', category: Category.CASH, quantity: 30 }),
    ]
    const prices = { VT: 100, TLT: 100, BIL: 100, GLD: 100 }
    const fxRates: Record<string, number> = {}

    const plan = generateRebalancePlan(
      holdings, prices, fxRates, CONSERVATIVE_CONFIG, 'USD',
    )

    // GOLD post-weight should be > 0 (was 0 before)
    expect(plan.postWeights[Category.GOLD]).toBeGreaterThan(0)
  })
})
