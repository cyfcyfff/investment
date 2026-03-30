import type {
  AssetHolding,
  DistributionConfig,
  DistributionMode,
  RebalanceConfig,
  RebalancePlan,
  RebalanceTrade,
} from '../types'
import { Category, CATEGORIES, CATEGORY_LABELS } from '../types'
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
 * Calculate per-holding proportions within a category based on distribution mode.
 *
 * @returns Array of proportions (sum to 1.0), parallel to categoryHoldings
 */
function calcDistributionProportions(
  categoryHoldings: AssetHolding[],
  holdingValues: number[],
  mode: DistributionMode,
  customRatios?: Record<string, number>,
): number[] {
  if (categoryHoldings.length === 0) return []
  if (categoryHoldings.length === 1) return [1.0]

  switch (mode) {
    case 'EQUAL':
      return categoryHoldings.map(() => 1 / categoryHoldings.length)

    case 'CUSTOM': {
      if (!customRatios) return categoryHoldings.map(() => 1 / categoryHoldings.length)
      const total = Object.values(customRatios).reduce((s, v) => s + v, 0)
      if (total === 0) return categoryHoldings.map(() => 1 / categoryHoldings.length)
      return categoryHoldings.map(h => {
        const ratio = customRatios[h.id]
        return ratio !== undefined ? ratio / total : 0
      })
    }

    case 'PROPORTIONAL':
    default: {
      const categoryTotal = holdingValues.reduce((s, v) => s + v, 0)
      if (categoryTotal === 0) return categoryHoldings.map(() => 1 / categoryHoldings.length)
      return holdingValues.map(v => v / categoryTotal)
    }
  }
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
 * 6. Within each category, distribute according to distributionConfig (default: proportional by market value)
 * 7. Compute fees, slippage, post-weights, and warnings
 */
export function generateRebalancePlan(
  holdings: AssetHolding[],
  prices: Record<string, number>,
  fxRates: Record<string, number>,
  config: RebalanceConfig,
  baseCurrency: string,
  distributionConfig?: DistributionConfig,
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
  let priority = 1
  for (const sd of sellDeltas) {
    const sellAmount = Math.abs(sd.delta)

    const categoryHoldings = holdings.filter(h => {
      return h.category === sd.category && prices[h.ticker] !== undefined
    })
    if (categoryHoldings.length === 0) continue

    const holdingValues = categoryHoldings.map(h => {
      const fxRate = getFxRate(h.currency, baseCurrency, fxRates)
      return h.quantity * prices[h.ticker]! * fxRate
    })
    const categoryTotalValue = holdingValues.reduce((s, v) => s + v, 0)
    if (categoryTotalValue === 0) continue

    const distMode = distributionConfig?.[sd.category]?.mode ?? 'PROPORTIONAL'
    const customRatios = distributionConfig?.[sd.category]?.customRatios
    const proportions = calcDistributionProportions(categoryHoldings, holdingValues, distMode, customRatios)

    for (let i = 0; i < categoryHoldings.length; i++) {
      const h = categoryHoldings[i]
      const tradeAmount = sellAmount * proportions[i]
      const fxRate = getFxRate(h.currency, baseCurrency, fxRates)
      const tradeQuantity = Math.min(
        tradeAmount / (prices[h.ticker]! * fxRate),
        h.quantity,
      )

      const actualAmount = tradeQuantity * prices[h.ticker]! * fxRate

      const trade: RebalanceTrade = {
        category: sd.category,
        holdingId: h.id,
        ticker: h.ticker,
        side: 'SELL',
        quantity: tradeQuantity,
        estimatedPrice: prices[h.ticker]!,
        estimatedAmount: actualAmount,
        estimatedFee: actualAmount * config.feeRate,
        priority: priority++,
      }
      trades.push(trade)

      if (tradeAmount > 0 && tradeAmount < config.minTradeAmount) {
        warnings.push(
          `SELL ${h.ticker}: amount $${tradeAmount.toFixed(2)} is below minimum $${config.minTradeAmount}`,
        )
      }
    }
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

  for (const bd of buyDeltas) {
    const rawAmount = bd.delta * scaleFactor
    const buyAmount = Math.max(0, rawAmount)

    const categoryHoldings = holdings.filter(h => {
      return h.category === bd.category && prices[h.ticker] !== undefined
    })

    if (categoryHoldings.length === 0) {
      warnings.push(`${CATEGORY_LABELS[bd.category]} 无持仓，无法生成买入建议，请先手动添加该类别的持仓`)
      continue
    }

    const holdingValues = categoryHoldings.map(h => {
      const fxRate = getFxRate(h.currency, baseCurrency, fxRates)
      return h.quantity * prices[h.ticker]! * fxRate
    })
    const categoryTotalValue = holdingValues.reduce((s, v) => s + v, 0)
    if (categoryTotalValue === 0) continue

    const distMode = distributionConfig?.[bd.category]?.mode ?? 'PROPORTIONAL'
    const customRatios = distributionConfig?.[bd.category]?.customRatios
    const proportions = calcDistributionProportions(categoryHoldings, holdingValues, distMode, customRatios)

    for (let i = 0; i < categoryHoldings.length; i++) {
      const h = categoryHoldings[i]
      const tradeAmount = buyAmount * proportions[i]
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
        priority: priority++,
      }
      trades.push(trade)

      if (tradeAmount > 0 && tradeAmount < config.minTradeAmount) {
        warnings.push(
          `BUY ${h.ticker}: amount $${tradeAmount.toFixed(2)} is below minimum $${config.minTradeAmount}`,
        )
      }
    }
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
      if (trade.side === 'SELL' && trade.category === cat && trade.holdingId) {
        const h = holdings.find(h => h.id === trade.holdingId)
        if (!h) continue
        const fxRate = getFxRate(h.currency, baseCurrency, fxRates)
        postValue -= trade.quantity * trade.estimatedPrice * fxRate
      }
    }

    // Apply BUY trades
    for (const trade of trades) {
      if (trade.side === 'BUY' && trade.category === cat && trade.holdingId) {
        const h = holdings.find(h => h.id === trade.holdingId)
        if (!h) continue
        const fxRate = getFxRate(h.currency, baseCurrency, fxRates)
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
