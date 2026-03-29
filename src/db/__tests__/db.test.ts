import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../index'
import type { AssetHolding, Transaction, PortfolioSnapshot } from '../../types'
import { Category } from '../../types'

describe('Database Layer', () => {
  beforeEach(async () => {
    await db.holdings.clear()
    await db.transactions.clear()
    await db.snapshots.clear()
  })

  it('should add and retrieve a holding', async () => {
    const holding: AssetHolding = {
      id: 'test-1',
      name: 'SPY',
      ticker: 'SPY',
      category: Category.STOCKS,
      currency: 'USD',
      buyPrice: 450,
      quantity: 10,
      fee: 4.5,
      buyDate: '2024-01-15',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await db.holdings.add(holding)
    const result = await db.holdings.get('test-1')
    expect(result).toBeDefined()
    expect(result!.ticker).toBe('SPY')
    expect(result!.quantity).toBe(10)
  })

  it('should update a holding', async () => {
    const holding: AssetHolding = {
      id: 'test-2',
      name: 'TLT',
      ticker: 'TLT',
      category: Category.LONG_BONDS,
      currency: 'USD',
      buyPrice: 100,
      quantity: 50,
      fee: 2,
      buyDate: '2024-01-15',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await db.holdings.add(holding)
    await db.holdings.update('test-2', { quantity: 60 })
    const result = await db.holdings.get('test-2')
    expect(result!.quantity).toBe(60)
  })

  it('should delete a holding', async () => {
    const holding: AssetHolding = {
      id: 'test-3',
      name: 'GLD',
      ticker: 'GLD',
      category: Category.GOLD,
      currency: 'USD',
      buyPrice: 200,
      quantity: 20,
      fee: 3,
      buyDate: '2024-01-15',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await db.holdings.add(holding)
    await db.holdings.delete('test-3')
    const result = await db.holdings.get('test-3')
    expect(result).toBeUndefined()
  })

  it('should add and list all holdings', async () => {
    const holdings: AssetHolding[] = [
      {
        id: 'h1', name: 'SPY', ticker: 'SPY', category: Category.STOCKS,
        currency: 'USD', buyPrice: 450, quantity: 10, fee: 4.5, buyDate: '2024-01-15',
        notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
      {
        id: 'h2', name: 'GLD', ticker: 'GLD', category: Category.GOLD,
        currency: 'USD', buyPrice: 200, quantity: 20, fee: 3, buyDate: '2024-01-15',
        notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
    ]
    await db.holdings.bulkAdd(holdings)
    const all = await db.holdings.toArray()
    expect(all).toHaveLength(2)
  })

  it('should store and retrieve a transaction', async () => {
    const tx: Transaction = {
      id: 'tx-1',
      holdingId: 'test-1',
      type: 'BUY',
      date: '2024-01-15',
      quantity: 10,
      price: 450,
      fee: 4.5,
      totalAmount: 4504.5,
      notes: '',
      createdAt: new Date().toISOString(),
    }
    await db.transactions.add(tx)
    const result = await db.transactions.get('tx-1')
    expect(result).toBeDefined()
    expect(result!.type).toBe('BUY')
  })

  it('should store and retrieve a snapshot', async () => {
    const snapshot: PortfolioSnapshot = {
      id: 'snap-1',
      timestamp: new Date().toISOString(),
      trigger: 'MANUAL',
      totalValue: 100000,
      baseCurrency: 'USD',
      categoryWeights: { STOCKS: 0.25, LONG_BONDS: 0.25, GOLD: 0.25, CASH: 0.25 },
      holdings: [],
      fxRates: { USD: 1 },
    }
    await db.snapshots.add(snapshot)
    const result = await db.snapshots.get('snap-1')
    expect(result).toBeDefined()
    expect(result!.totalValue).toBe(100000)
  })
})
