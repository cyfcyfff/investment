import type {
  AssetHolding,
  Category,
  RebalanceConfig,
  RebalancePlan,
  RebalanceTrade,
} from '../types'
import { CATEGORIES } from '../types'
import { calculateCategoryWeights, isRebalanceTriggered } from './calcService'
import { generateId } from '../utils/formatters'

/**
 * Get the FX rate for converting a currency to the base currency.
 * Returns 1 if same currency, otherwise looks up the pair in fxRates.
 */
function getFxRate(
  currency: string,
  baseCurrency: string,
  fxRates: Record<string, number>,
): number {
  if (currency === baseCurrency) return 1
  return fxRates[`${currency}-${baseCurrency}`] ?? 1
}

/**
 * Calculate the total portfolio value in base currency.
 */
function calcTotalPortfolioValue(
  holdings: AssetHolding[],
  prices: Record<string, number>,
  fxRates: Record<string, number>,
  baseCurrency: string,
): number {
  let total = 0
  for (const holding of holdings) {
    const price = prices[holding.ticker]
    if (price === undefined) continue
    const fxRate = getFxRate(holding.currency, baseCurrency, fxRates)
    total += holding.quantity * price * fxRate
  }
  return total
}

/**
 * Calculate the current value of a single category in base currency.
 */
function calcCategoryValue(
  holdings: AssetHolding[],
  category: Category,
  prices: Record<string, number>,
  fxRates: Record<string, number>,
  baseCurrency: string,
): number {
  let total = 0
  for (const holding of holdings) {
    if (holding.category !== category) continue
    const price = prices[holding.ticker]
    if (price === undefined) continue
    const fxRate = getFxRate(holding.currency, baseCurrency, fxRates)
    total += holding.quantity * price * fxRate
  }
  return total
}

/**
 * Generate a rebalance plan for the portfolio.
 *
 * Algorithm:
 * 1. Calculate current category weights
 * 2. Check if rebalance is triggered
 * 3. Calculate deltas (target - current) sorted by |delta| descending
 * 4. SELL overweight categories first (lower priority numbers)
 * 5. BUY underweight categories second (higher priority numbers), budget from sells
 * 6. Within each category, distribute proportionally by market value
 * 7. Compute fees, slippage, post-weights, and warnings
 */
export function generateRebalancePlan(
  holdings: AssetHolding[],
  prices: Record<string, number>,
  fxRates: Record<string, number>,
  config: RebalanceConfig,
  baseCurrency: string,
): RebalancePlan {
  const currentWeights = calculateCategoryWeights(
    holdings, prices, fxRates, baseCurrency,
  )

  const check = isRebalanceTriggered(currentWeights, config)
  const triggerReason = check.triggered ? 'BAND_BREACH' as const : 'MANUAL' as const

  const warnings: string[] = []
  const trades: RebalanceTrade[] = []

  const totalValue = calcTotalPortfolioValue(
    holdings, prices, fxRates, baseCurrency,
  )

  if (totalValue === 0 || holdings.length === 0) {
    return {
      id: generateId(),
      generatedAt: new Date().toISOString(),
      triggerReason,
      triggerDetails: check.reason || 'No holdings',
      currentWeights,
      targetWeights: config.targets,
      trades: [],
      postWeights: currentWeights,
      totalEstimatedFee: 0,
      totalEstimatedSlippage: 0,
      warnings: [],
    }
  }

  // Step 3: Calculate deltas per category
  interface CategoryDelta {
    category: Category
    delta: number        // targetValue - currentValue (positive = need to buy)
    currentValue: number
    targetValue: number
  }

  const deltas: CategoryDelta[] = CATEGORIES.map((cat) => {
    const currentValue = calcCategoryValue(
      holdings, cat, prices, fxRates, baseCurrency,
    )
    const targetValue = totalValue * config.targets[cat]
    return {
      category: cat,
      delta: targetValue - currentValue,
      currentValue,
      targetValue,
    }
  })

  // Step 4: Sort by |delta| descending
  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  // Separate into sell (overweight) and buy (underweight) categories
  const sellDeltas = deltas.filter(d => d.delta < 0)
  const buyDeltas = deltas.filter(d => d.delta > 0)

  // Step 5: SELL trades first
  let sellPriority = 1
  for (const sd of sellDeltas) {
    const sellAmount = Math.abs(sd.delta)

    // Get holdings in this category with valid prices
    const categoryHoldings = holdings.filter(h => {
      return h.category === sd.category && prices[h.ticker] !== undefined
    })
    if (categoryHoldings.length === 0) continue

    // Calculate each holding's share of the category
    const holdingValues = categoryHoldings.map(h => {
      const fxRate = getFxRate(h.currency, baseCurrency, fxRates)
      return h.quantity * prices[h.ticker]! * fxRate
    })
    const categoryTotalValue = holdingValues.reduce((s, v) => s + v, 0)
    if (categoryTotalValue === 0) continue

    for (let i = 0; i < categoryHoldings.length; i++) {
      const h = categoryHoldings[i]
      const proportion = holdingValues[i] / categoryTotalValue
      const tradeAmount = sellAmount * proportion
      const tradeQuantity = tradeAmount / (prices[h.ticker]! * getFxRate(h.currency, baseCurrency, fxRates))

      const trade: RebalanceTrade = {
        category: sd.category,
        holdingId: h.id,
        ticker: h.ticker,
        side: 'SELL',
        quantity: tradeQuantity,
        estimatedPrice: prices[h.ticker]!,
        estimatedAmount: tradeAmount,
        estimatedFee: tradeAmount * config.feeRate,
        priority: sellPriority,
      }
      trades.push(trade)

      if (tradeAmount > 0 && tradeAmount < config.minTradeAmount) {
        warnings.push(
          `SELL ${h.ticker}: amount $${tradeAmount.toFixed(2)} is below minimum $${config.minTradeAmount}`,
        )
      }
    }
    sellPriority++
  }

  // Calculate total sell proceeds (amount minus fees and slippage)
  const totalSellAmount = trades
    .filter(t => t.side === 'SELL')
    .reduce((s, t) => s + t.estimatedAmount, 0)
  const totalSellFees = trades
    .filter(t => t.side === 'SELL')
    .reduce((s, t) => s + t.estimatedFee, 0)
  const totalSellSlippage = trades
    .filter(t => t.side === 'SELL')
    .reduce((s, t) => s + t.estimatedAmount * config.slippage, 0)
  const buyBudget = totalSellAmount - totalSellFees - totalSellSlippage

  // Step 6: BUY trades second, within budget
  const buyAmounts: Record<Category, number> = {} as Record<Category, number>
  for (const bd of buyDeltas) {
    buyAmounts[bd.category] = Math.min(bd.delta, buyBudget)
  }

  // Scale down if total buy exceeds budget
  const totalBuyRequested = buyDeltas.reduce((s, d) => s + d.delta, 0)
  let scaleFactor = 1
  if (totalBuyRequested > buyBudget && totalBuyRequested > 0) {
    scaleFactor = buyBudget / totalBuyRequested
  }

  let buyPriority = sellPriority + 10 // Ensure BUY priority > SELL priority
  for (const bd of buyDeltas) {
    const rawAmount = bd.delta * scaleFactor
    const buyAmount = Math.max(0, rawAmount)

    const categoryHoldings = holdings.filter(h => {
      return h.category === bd.category && prices[h.ticker] !== undefined
    })
    if (categoryHoldings.length === 0) continue

    // Distribute proportionally by current market value
    const holdingValues = categoryHoldings.map(h => {
      const fxRate = getFxRate(h.currency, baseCurrency, fxRates)
      return h.quantity * prices[h.ticker]! * fxRate
    })
    const categoryTotalValue = holdingValues.reduce((s, v) => s + v, 0)
    if (categoryTotalValue === 0) continue

    for (let i = 0; i < categoryHoldings.length; i++) {
      const h = categoryHoldings[i]
      const proportion = holdingValues[i] / categoryTotalValue
      const tradeAmount = buyAmount * proportion
      const tradeQuantity = tradeAmount / (prices[h.ticker]! * getFxRate(h.currency, baseCurrency, fxRates))

      const trade: RebalanceTrade = {
        category: bd.category,
        holdingId: h.id,
        ticker: h.ticker,
        side: 'BUY',
        quantity: tradeQuantity,
        estimatedPrice: prices[h.ticker]!,
        estimatedAmount: tradeAmount,
        estimatedFee: tradeAmount * config.feeRate,
        priority: buyPriority,
      }
      trades.push(trade)

      if (tradeAmount > 0 && tradeAmount < config.minTradeAmount) {
        warnings.push(
          `BUY ${h.ticker}: amount $${tradeAmount.toFixed(2)} is below minimum $${config.minTradeAmount}`,
        )
      }
    }
    buyPriority++
  }

  // Step 8 & 9: Calculate totals
  const totalEstimatedFee = trades.reduce((s, t) => s + t.estimatedFee, 0)
  const totalEstimatedSlippage = trades.reduce(
    (s, t) => s + t.estimatedAmount * config.slippage, 0,
  )

  // Step 10: Calculate post-weights after simulated execution
  const postValues: Record<Category, number> = {} as Record<Category, number>
  for (const cat of CATEGORIES) {
    let postValue = calcCategoryValue(
      holdings, cat, prices, fxRates, baseCurrency,
    )

    // Apply SELL trades
    for (const trade of trades) {
      if (trade.side === 'SELL' && trade.category === cat) {
        const fxRate = getFxRate(
          holdings.find(h => h.id === trade.holdingId)?.currency ?? 'USD',
          baseCurrency, fxRates,
        )
        postValue -= trade.quantity * trade.estimatedPrice * fxRate
      }
    }

    // Apply BUY trades
    for (const trade of trades) {
      if (trade.side === 'BUY' && trade.category === cat) {
        const fxRate = getFxRate(
          holdings.find(h => h.id === trade.holdingId)?.currency ?? 'USD',
          baseCurrency, fxRates,
        )
        postValue += trade.quantity * trade.estimatedPrice * fxRate
      }
    }

    postValues[cat] = postValue
  }

  // Subtract total fees and slippage proportionally for post-weight calculation
  const totalPostValue = Object.values(postValues).reduce((s, v) => s + v, 0)
  const postWeights: Record<Category, number> = {} as Record<Category, number>
  for (const cat of CATEGORIES) {
    postWeights[cat] = totalPostValue > 0 ? postValues[cat] / totalPostValue : 0
  }

  return {
    id: generateId(),
    generatedAt: new Date().toISOString(),
    triggerReason,
    triggerDetails: check.reason || 'Manual rebalance',
    currentWeights,
    targetWeights: config.targets,
    trades,
    postWeights,
    totalEstimatedFee,
    totalEstimatedSlippage,
    warnings,
  }
}
