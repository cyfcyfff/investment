import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { db } from '../../db'
import { Category, type AssetHolding } from '../../types'
import { getTodayKeyBeijing, createSnapshot, ensureDailySnapshot } from '../snapshotService'

dayjs.extend(utc)
dayjs.extend(timezone)

// --- Test fixtures ---

const mockHoldings: AssetHolding[] = [
  {
    id: 'h1',
    name: 'VOO',
    ticker: 'VOO',
    category: Category.STOCKS,
    currency: 'USD',
    buyPrice: 400,
    quantity: 10,
    fee: 5,
    buyDate: '2024-01-01',
    notes: '',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'h2',
    name: 'GLD',
    ticker: 'GLD',
    category: Category.GOLD,
    currency: 'USD',
    buyPrice: 180,
    quantity: 5,
    fee: 5,
    buyDate: '2024-01-01',
    notes: '',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
]

const mockPrices: Record<string, number> = {
  VOO: 500,
  GLD: 200,
}

const mockFxRates: Record<string, number> = {
  'EUR-USD': 1.1,
}

const baseCurrency = 'USD'

describe('snapshotService', () => {
  beforeEach(async () => {
    await db.snapshots.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getTodayKeyBeijing', () => {
    it('should return YYYY-MM-DD format string', () => {
      const result = getTodayKeyBeijing()
      // YYYY-MM-DD regex
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should return a date that corresponds to Beijing timezone', () => {
      const result = getTodayKeyBeijing()
      // Parse the result as a Beijing date and verify it matches
      const parsed = dayjs.tz(result, 'YYYY-MM-DD', 'Asia/Shanghai')
      expect(parsed.isValid()).toBe(true)
      expect(parsed.format('YYYY-MM-DD')).toBe(result)
    })
  })

  describe('ensureDailySnapshot', () => {
    it('should create snapshot when none exists for today', async () => {
      const snapshot = await ensureDailySnapshot(mockHoldings, mockPrices, mockFxRates, baseCurrency)

      expect(snapshot).not.toBeNull()
      expect(snapshot!.trigger).toBe('DAILY')
      expect(snapshot!.baseCurrency).toBe('USD')
      expect(snapshot!.totalValue).toBeGreaterThan(0)
      expect(snapshot!.id).toBeTruthy()

      // Verify it was saved to DB
      const saved = await db.snapshots.get(snapshot!.id)
      expect(saved).toEqual(snapshot)
    })

    it('should return existing snapshot without creating duplicate', async () => {
      // Create first snapshot
      const first = await ensureDailySnapshot(mockHoldings, mockPrices, mockFxRates, baseCurrency)
      expect(first).not.toBeNull()

      // Create second snapshot for same day
      const second = await ensureDailySnapshot(mockHoldings, mockPrices, mockFxRates, baseCurrency)

      expect(second).not.toBeNull()
      expect(second!.id).toBe(first!.id)

      // Only one snapshot in DB
      const allSnapshots = await db.snapshots.count()
      expect(allSnapshots).toBe(1)
    })

    it('should return null for empty holdings', async () => {
      const snapshot = await ensureDailySnapshot([], mockPrices, mockFxRates, baseCurrency)
      expect(snapshot).toBeNull()
    })
  })

  describe('createSnapshot', () => {
    it('should create snapshot with given trigger type', async () => {
      const snapshot = await createSnapshot(mockHoldings, mockPrices, mockFxRates, baseCurrency, 'MANUAL')

      expect(snapshot).not.toBeNull()
      expect(snapshot!.trigger).toBe('MANUAL')
      expect(snapshot!.timestamp).toBeTruthy()
      expect(snapshot!.id).toBeTruthy()
    })

    it('should record category weights in snapshot', async () => {
      const snapshot = await createSnapshot(mockHoldings, mockPrices, mockFxRates, baseCurrency, 'DAILY')

      expect(snapshot).not.toBeNull()

      // VOO: 10 * 500 = 5000 (STOCKS)
      // GLD: 5 * 200 = 1000 (GOLD)
      // Total: 6000
      expect(snapshot!.categoryWeights[Category.STOCKS]).toBeCloseTo(5000 / 6000)
      expect(snapshot!.categoryWeights[Category.GOLD]).toBeCloseTo(1000 / 6000)
      expect(snapshot!.categoryWeights[Category.LONG_BONDS]).toBe(0)
      expect(snapshot!.categoryWeights[Category.CASH]).toBe(0)
    })

    it('should store individual holding values', async () => {
      const snapshot = await createSnapshot(mockHoldings, mockPrices, mockFxRates, baseCurrency, 'TRADE')

      expect(snapshot).not.toBeNull()
      expect(snapshot!.holdings).toHaveLength(2)

      // VOO: 10 * 500 * 1 (same currency) = 5000
      const vooHolding = snapshot!.holdings.find(h => h.holdingId === 'h1')
      expect(vooHolding).toBeDefined()
      expect(vooHolding!.marketValue).toBe(5000)
      expect(vooHolding!.weight).toBeCloseTo(5000 / 6000)

      // GLD: 5 * 200 * 1 = 1000
      const gldHolding = snapshot!.holdings.find(h => h.holdingId === 'h2')
      expect(gldHolding).toBeDefined()
      expect(gldHolding!.marketValue).toBe(1000)
      expect(gldHolding!.weight).toBeCloseTo(1000 / 6000)
    })

    it('should record FX rates in snapshot', async () => {
      const snapshot = await createSnapshot(mockHoldings, mockPrices, mockFxRates, baseCurrency, 'REBALANCE')

      expect(snapshot).not.toBeNull()
      expect(snapshot!.fxRates).toEqual(mockFxRates)
    })

    it('should return null for empty holdings', async () => {
      const snapshot = await createSnapshot([], mockPrices, mockFxRates, baseCurrency, 'DAILY')
      expect(snapshot).toBeNull()
    })

    it('should calculate total value correctly', async () => {
      const snapshot = await createSnapshot(mockHoldings, mockPrices, mockFxRates, baseCurrency, 'DAILY')

      expect(snapshot).not.toBeNull()
      // VOO: 10 * 500 = 5000, GLD: 5 * 200 = 1000, Total: 6000
      expect(snapshot!.totalValue).toBe(6000)
    })
  })
})
