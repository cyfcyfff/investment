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
