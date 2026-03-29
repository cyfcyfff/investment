import type { AssetHolding, RebalanceConfig } from '../types'
import { Category, CATEGORIES, DEFAULT_REBALANCE_CONFIG } from '../types'

export function calcMarketValue(quantity: number, price: number, fxRate: number = 1): number {
  return quantity * price * fxRate
}

export function calculateCategoryWeights(
  holdings: AssetHolding[],
  prices: Record<string, number>,
  fxRates: Record<string, number> = { USD: 1 },
  baseCurrency: string = 'USD',
): Record<Category, number> {
  const weights: Record<Category, number> = {} as Record<Category, number>
  for (const cat of CATEGORIES) {
    weights[cat] = 0
  }

  if (holdings.length === 0) return weights

  const categoryValues: Record<string, number> = {}
  let totalValue = 0

  for (const holding of holdings) {
    const price = prices[holding.ticker]
    if (price === undefined) continue

    const fxRate = holding.currency === baseCurrency ? 1 : (fxRates[`${holding.currency}-${baseCurrency}`] ?? 1)
    const marketValue = calcMarketValue(holding.quantity, price, fxRate)

    categoryValues[holding.category] = (categoryValues[holding.category] ?? 0) + marketValue
    totalValue += marketValue
  }

  if (totalValue === 0) return weights

  for (const cat of CATEGORIES) {
    weights[cat] = (categoryValues[cat] ?? 0) / totalValue
  }

  return weights
}

export interface RebalanceCheckResult {
  triggered: boolean
  reason: string
  breachCategories: Category[]
}

export function isRebalanceTriggered(
  weights: Record<Category, number>,
  config: RebalanceConfig = DEFAULT_REBALANCE_CONFIG,
  lastRebalanceDate?: string,
  now: Date = new Date(),
): RebalanceCheckResult {
  const { bands, annualReviewDate } = config
  const breachCategories: Category[] = []

  for (const cat of CATEGORIES) {
    const weight = weights[cat] ?? 0
    if (weight < bands.low || weight > bands.high) {
      breachCategories.push(cat)
    }
  }

  if (breachCategories.length > 0) {
    const names = breachCategories.map(c => c).join(', ')
    return {
      triggered: true,
      reason: `Category bands breached: ${names}`,
      breachCategories,
    }
  }

  // Check annual review
  if (lastRebalanceDate) {
    const [month, day] = annualReviewDate.split('-').map(Number)
    const lastRebalance = new Date(lastRebalanceDate)
    const nextReviewDate = new Date(lastRebalance.getFullYear(), month - 1, day)
    if (nextReviewDate <= lastRebalance) {
      nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1)
    }
    if (now >= nextReviewDate) {
      return {
        triggered: true,
        reason: 'Annual review date reached',
        breachCategories: [],
      }
    }
  }

  return {
    triggered: false,
    reason: '',
    breachCategories: [],
  }
}
