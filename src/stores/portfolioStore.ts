import { create } from 'zustand'
import { db } from '../db'
import type { AssetHolding, Transaction, PortfolioSnapshot } from '../types'
import { generateId } from '../utils/formatters'

interface PortfolioState {
  holdings: AssetHolding[]
  transactions: Transaction[]
  snapshots: PortfolioSnapshot[]
  loading: boolean
  loadHoldings: () => Promise<void>
  addHolding: (holding: Omit<AssetHolding, 'id' | 'createdAt' | 'updatedAt' | 'fee'>) => Promise<void>
  updateHolding: (id: string, updates: Partial<AssetHolding>) => Promise<void>
  deleteHolding: (id: string) => Promise<void>
  mergeHoldings: (ids: string[]) => Promise<void>
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
  loadTransactions: () => Promise<void>
  loadSnapshots: () => Promise<void>
  addSnapshot: (snapshot: PortfolioSnapshot) => Promise<void>
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  holdings: [],
  transactions: [],
  snapshots: [],
  loading: false,

  loadHoldings: async () => {
    set({ loading: true })
    const holdings = await db.holdings.toArray()
    const transactions = await db.transactions.toArray()
    set({ holdings, transactions, loading: false })
  },

  addHolding: async (data) => {
    const now = new Date().toISOString()
    const normalizedTicker = data.ticker.trim().toUpperCase()
    const holding: AssetHolding = { ...data, ticker: normalizedTicker, fee: 0, id: generateId(), createdAt: now, updatedAt: now }
    await db.holdings.add(holding)
    const tx: Transaction = {
      id: generateId(),
      holdingId: holding.id,
      type: 'BUY',
      date: data.buyDate,
      quantity: data.quantity,
      price: data.buyPrice,
      fee: 0,
      totalAmount: data.quantity * data.buyPrice,
      notes: `初始买入 ${normalizedTicker}`,
      createdAt: now,
    }
    await db.transactions.add(tx)
    set(state => ({ holdings: [...state.holdings, holding], transactions: [...state.transactions, tx] }))
  },

  updateHolding: async (id, updates) => {
    const updatedAt = new Date().toISOString()
    const normalizedUpdates: Partial<AssetHolding> = updates.ticker != null
      ? { ...updates, ticker: updates.ticker.trim().toUpperCase() }
      : updates
    await db.holdings.update(id, { ...normalizedUpdates, updatedAt })
    set(state => ({ holdings: state.holdings.map(h => h.id === id ? { ...h, ...normalizedUpdates, updatedAt } : h) }))
  },

  deleteHolding: async (id) => {
    await db.holdings.delete(id)
    await db.transactions.where('holdingId').equals(id).delete()
    set(state => ({
      holdings: state.holdings.filter(h => h.id !== id),
      transactions: state.transactions.filter(t => t.holdingId !== id),
    }))
  },

  mergeHoldings: async (ids) => {
    const holdings = await db.holdings.where('id').anyOf(ids).toArray()
    if (holdings.length < 2) throw new Error('至少选择2个持仓')

    const tickers = new Set(holdings.map(h => h.ticker))
    if (tickers.size > 1) throw new Error('只能合并相同标的的持仓')

    const [primary, ...rest] = holdings
    const totalQty = rest.reduce((s, h) => s + h.quantity, primary.quantity)
    const totalCost = rest.reduce((s, h) => s + h.quantity * h.buyPrice, primary.quantity * primary.buyPrice)
    const avgPrice = totalCost / totalQty
    const totalFee = rest.reduce((s, h) => s + h.fee, primary.fee)
    const earliestDate = [...holdings].sort((a, b) => a.buyDate.localeCompare(b.buyDate))[0].buyDate
    const now = new Date().toISOString()

    await db.holdings.update(primary.id, {
      quantity: totalQty,
      buyPrice: avgPrice,
      fee: totalFee,
      buyDate: earliestDate,
      notes: primary.notes ? `${primary.notes}（已合并${rest.length}笔）` : `合并${rest.length}笔`,
      updatedAt: now,
    })

    const restIds = rest.map(h => h.id)
    await db.transactions.where('holdingId').anyOf(restIds).modify({ holdingId: primary.id })
    await db.holdings.bulkDelete(restIds)

    const mergeTx: Transaction = {
      id: generateId(),
      holdingId: primary.id,
      type: 'REBALANCE_IN',
      date: earliestDate,
      quantity: totalQty,
      price: avgPrice,
      fee: totalFee,
      totalAmount: totalCost + totalFee,
      notes: `合并${rest.length}笔持仓为${primary.ticker}`,
      createdAt: now,
    }
    await db.transactions.add(mergeTx)

    const allHoldings = await db.holdings.toArray()
    const allTransactions = await db.transactions.toArray()
    set({ holdings: allHoldings, transactions: allTransactions })
  },

  addTransaction: async (data) => {
    const tx: Transaction = { ...data, id: generateId(), createdAt: new Date().toISOString() }
    await db.transactions.add(tx)
    set(state => ({ transactions: [...state.transactions, tx] }))
  },

  loadTransactions: async () => {
    const transactions = await db.transactions.orderBy('date').reverse().toArray()
    set({ transactions })
  },

  loadSnapshots: async () => {
    const snapshots = await db.snapshots.orderBy('timestamp').reverse().toArray()
    set({ snapshots })
  },

  addSnapshot: async (snapshot) => {
    await db.snapshots.add(snapshot)
    set(state => ({ snapshots: [snapshot, ...state.snapshots] }))
  },
}))
