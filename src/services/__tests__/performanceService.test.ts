import { describe, it, expect } from 'vitest'
import { calculatePerformance } from '../performanceService'
import type { PortfolioSnapshot } from '@/types/portfolio'
import { EMPTY_PERFORMANCE } from '@/types/portfolio'

// Helper to create a minimal snapshot for testing
function makeSnapshot(
  overrides: Partial<PortfolioSnapshot> & Pick<PortfolioSnapshot, 'id' | 'timestamp' | 'totalValue'>,
): PortfolioSnapshot {
  return {
    trigger: 'DAILY',
    baseCurrency: 'USD',
    categoryWeights: {
      STOCKS: 0.25,
      LONG_BONDS: 0.25,
      GOLD: 0.25,
      CASH: 0.25,
    },
    holdings: [],
    fxRates: {},
    ...overrides,
  }
}

describe('calculatePerformance', () => {
  it('should return empty metrics for empty snapshots array', () => {
    const result = calculatePerformance([])
    expect(result).toEqual({ ...EMPTY_PERFORMANCE, snapshotsCount: 0 })
  })

  it('should return empty metrics (except count=1) for single snapshot', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    expect(result).toEqual({
      ...EMPTY_PERFORMANCE,
      snapshotsCount: 1,
      firstSnapshotDate: '2025-01-01T00:00:00Z',
      lastSnapshotDate: '2025-01-01T00:00:00Z',
    })
  })

  it('should calculate total return correctly (100k -> 110k = 10%)', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2026-01-01T00:00:00Z',
        totalValue: 110_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    expect(result.totalReturn).toBeCloseTo(0.1, 6)
    expect(result.totalReturnAmount).toBeCloseTo(10_000, 2)
  })

  it('should calculate negative total return (100k -> 90k = -10%)', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2025-06-01T00:00:00Z',
        totalValue: 90_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    expect(result.totalReturn).toBeCloseTo(-0.1, 6)
    expect(result.totalReturnAmount).toBeCloseTo(-10_000, 2)
  })

  it('should calculate CAGR (~10% for 100k->110k over 365 days)', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2026-01-01T00:00:00Z',
        totalValue: 110_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    // CAGR = (110000/100000)^(365/365) - 1 = 1.1 - 1 = 0.1
    expect(result.cagr).toBeCloseTo(0.1, 6)
  })

  it('should calculate max drawdown (peak 120k, trough 90k = 25%)', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2025-02-01T00:00:00Z',
        totalValue: 120_000,
      }),
      makeSnapshot({
        id: '3',
        timestamp: '2025-03-01T00:00:00Z',
        totalValue: 90_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    // maxDrawdown = max(1 - 90_000/120_000) = 0.25
    expect(result.maxDrawdown).toBeCloseTo(0.25, 6)
    expect(result.maxDrawdownDate).toBe('2025-03-01T00:00:00Z')
  })

  it('should calculate current drawdown', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2025-02-01T00:00:00Z',
        totalValue: 120_000,
      }),
      makeSnapshot({
        id: '3',
        timestamp: '2025-03-01T00:00:00Z',
        totalValue: 96_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    // peak = 120_000, endValue = 96_000
    // currentDrawdown = 1 - 96_000/120_000 = 0.2
    expect(result.currentDrawdown).toBeCloseTo(0.2, 6)
  })

  it('should return zero current drawdown when at peak', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2025-02-01T00:00:00Z',
        totalValue: 120_000,
      }),
      makeSnapshot({
        id: '3',
        timestamp: '2025-03-01T00:00:00Z',
        totalValue: 130_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    // peak = 130_000 (last snapshot is the peak)
    expect(result.currentDrawdown).toBe(0)
    expect(result.peakValue).toBe(130_000)
  })

  it('should record peak value and date', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2025-02-01T00:00:00Z',
        totalValue: 120_000,
      }),
      makeSnapshot({
        id: '3',
        timestamp: '2025-03-01T00:00:00Z',
        totalValue: 110_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    expect(result.peakValue).toBe(120_000)
    expect(result.peakDate).toBe('2025-02-01T00:00:00Z')
  })

  it('should record snapshot count and date range', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-15T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2025-03-20T00:00:00Z',
        totalValue: 105_000,
      }),
      makeSnapshot({
        id: '3',
        timestamp: '2025-06-10T00:00:00Z',
        totalValue: 108_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    expect(result.snapshotsCount).toBe(3)
    expect(result.firstSnapshotDate).toBe('2025-01-15T00:00:00Z')
    expect(result.lastSnapshotDate).toBe('2025-06-10T00:00:00Z')
  })

  it('should handle unsorted input (sorts by timestamp internally)', () => {
    const snapshots = [
      makeSnapshot({
        id: '3',
        timestamp: '2025-06-01T00:00:00Z',
        totalValue: 108_000,
      }),
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2025-03-01T00:00:00Z',
        totalValue: 95_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    // After sorting: 100k -> 95k -> 108k
    expect(result.firstSnapshotDate).toBe('2025-01-01T00:00:00Z')
    expect(result.lastSnapshotDate).toBe('2025-06-01T00:00:00Z')
    expect(result.totalReturn).toBeCloseTo(0.08, 6)
    expect(result.totalReturnAmount).toBeCloseTo(8_000, 2)
    // Peak = 100k (first), maxDrawdown at 95k = 1 - 95/100 = 0.05
    expect(result.maxDrawdown).toBeCloseTo(0.05, 6)
  })

  it('should calculate daysSincePeak correctly', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2025-02-01T00:00:00Z',
        totalValue: 120_000,
      }),
      makeSnapshot({
        id: '3',
        timestamp: '2025-03-01T00:00:00Z',
        totalValue: 110_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    // Peak at 2025-02-01, end at 2025-03-01 = 28 days (in 2025, Feb has 28 days)
    expect(result.daysSincePeak).toBe(28)
  })

  it('should return zero daysSincePeak when at peak', () => {
    const snapshots = [
      makeSnapshot({
        id: '1',
        timestamp: '2025-01-01T00:00:00Z',
        totalValue: 100_000,
      }),
      makeSnapshot({
        id: '2',
        timestamp: '2025-02-01T00:00:00Z',
        totalValue: 120_000,
      }),
      makeSnapshot({
        id: '3',
        timestamp: '2025-03-01T00:00:00Z',
        totalValue: 130_000,
      }),
    ]
    const result = calculatePerformance(snapshots)
    // Last snapshot IS the peak
    expect(result.daysSincePeak).toBe(0)
  })
})
