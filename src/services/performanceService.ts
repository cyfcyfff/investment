import type { PerformanceMetrics, PortfolioSnapshot } from '@/types/portfolio'
import { EMPTY_PERFORMANCE } from '@/types/portfolio'

/**
 * Calculate performance metrics from an ordered or unordered list of portfolio snapshots.
 *
 * @param snapshots - Array of PortfolioSnapshot objects (will be sorted by timestamp).
 * @returns PerformanceMetrics with all calculated fields.
 */
export function calculatePerformance(
  snapshots: PortfolioSnapshot[],
): PerformanceMetrics {
  if (snapshots.length < 2) {
    return {
      ...EMPTY_PERFORMANCE,
      snapshotsCount: snapshots.length,
      firstSnapshotDate: snapshots.length === 1 ? snapshots[0].timestamp : '',
      lastSnapshotDate: snapshots.length === 1 ? snapshots[0].timestamp : '',
    }
  }

  // Sort snapshots by timestamp ascending
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const startValue = sorted[0].totalValue
  const endValue = sorted[sorted.length - 1].totalValue
  const endMs = new Date(sorted[sorted.length - 1].timestamp).getTime()
  const startMs = new Date(sorted[0].timestamp).getTime()
  const days = (endMs - startMs) / 86400000

  // Total return
  const totalReturn = (endValue - startValue) / startValue
  const totalReturnAmount = endValue - startValue

  // CAGR: compound annual growth rate
  const cagr = Math.pow(endValue / startValue, 365 / days) - 1

  // Track peak, max drawdown, and drawdown date while iterating
  let peakValue = startValue
  let peakDate = sorted[0].timestamp
  let maxDrawdown = 0
  let maxDrawdownDate = ''

  for (const snapshot of sorted) {
    if (snapshot.totalValue > peakValue) {
      peakValue = snapshot.totalValue
      peakDate = snapshot.timestamp
    }

    const drawdown = 1 - snapshot.totalValue / peakValue
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
      maxDrawdownDate = snapshot.timestamp
    }
  }

  // Current drawdown relative to all-time peak
  const currentDrawdown = 1 - endValue / peakValue

  // Days since the all-time peak
  const peakMs = new Date(peakDate).getTime()
  const daysSincePeak = Math.max(0, Math.floor((endMs - peakMs) / 86400000))

  return {
    totalReturn,
    totalReturnAmount,
    cagr,
    maxDrawdown,
    maxDrawdownDate,
    currentDrawdown: Math.max(0, currentDrawdown),
    peakValue,
    peakDate,
    daysSincePeak,
    snapshotsCount: sorted.length,
    firstSnapshotDate: sorted[0].timestamp,
    lastSnapshotDate: sorted[sorted.length - 1].timestamp,
  }
}
