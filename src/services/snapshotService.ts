import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { db } from '../db'
import { calculateCategoryWeights, calcMarketValue } from './calcService'
import { generateId } from '../utils/formatters'
import type { AssetHolding, PortfolioSnapshot, SnapshotTrigger } from '../types'

dayjs.extend(utc)
dayjs.extend(timezone)

/** Get today's date key in YYYY-MM-DD format using Beijing timezone */
export function getTodayKeyBeijing(): string {
  return dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD')
}

/** Get FX rate for a currency pair, defaulting to 1 */
function getFxRate(currency: string, baseCurrency: string, fxRates: Record<string, number>): number {
  if (currency === baseCurrency) return 1
  return fxRates[`${currency}-${baseCurrency}`] ?? 1
}

/** Create a portfolio snapshot with the given trigger type */
export async function createSnapshot(
  holdings: AssetHolding[],
  prices: Record<string, number>,
  fxRates: Record<string, number>,
  baseCurrency: string,
  trigger: SnapshotTrigger,
): Promise<PortfolioSnapshot | null> {
  if (holdings.length === 0) return null

  const categoryWeights = calculateCategoryWeights(holdings, prices, fxRates, baseCurrency)

  // Calculate per-holding market values and total value
  const holdingEntries: { holdingId: string; marketValue: number; weight: number }[] = []
  let totalValue = 0

  for (const holding of holdings) {
    const price = prices[holding.ticker]
    if (price === undefined) continue

    const fxRate = getFxRate(holding.currency, baseCurrency, fxRates)
    const marketValue = calcMarketValue(holding.quantity, price, fxRate)

    totalValue += marketValue
    holdingEntries.push({
      holdingId: holding.id,
      marketValue,
      weight: 0, // will be computed below
    })
  }

  // Compute individual weights
  if (totalValue > 0) {
    for (const entry of holdingEntries) {
      entry.weight = entry.marketValue / totalValue
    }
  }

  const snapshot: PortfolioSnapshot = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    trigger,
    totalValue,
    baseCurrency,
    categoryWeights,
    holdings: holdingEntries,
    fxRates,
  }

  await db.snapshots.add(snapshot)
  return snapshot
}

/** Ensure a daily snapshot exists for today (Beijing time), creating one if needed */
export async function ensureDailySnapshot(
  holdings: AssetHolding[],
  prices: Record<string, number>,
  fxRates: Record<string, number>,
  baseCurrency: string,
): Promise<PortfolioSnapshot | null> {
  if (holdings.length === 0) return null

  const todayKey = getTodayKeyBeijing()
  const todayStart = dayjs.tz(todayKey, 'Asia/Shanghai').startOf('day').toISOString()
  const todayEnd = dayjs.tz(todayKey, 'Asia/Shanghai').endOf('day').toISOString()

  const existing = await db.snapshots
    .where('timestamp')
    .between(todayStart, todayEnd, true, true)
    .first()

  if (existing) return existing

  return createSnapshot(holdings, prices, fxRates, baseCurrency, 'DAILY')
}
