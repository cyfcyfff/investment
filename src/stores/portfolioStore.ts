import { create } from 'zustand'
import { db } from '../db'
import type { AssetHolding, Transaction } from '../types'
import { generateId } from '../utils/formatters'

interface PortfolioState {
  holdings: AssetHolding[]
  transactions: Transaction[]
  loading: boolean
  loadHoldings: () => Promise<void>
  addHolding: (holding: Omit<AssetHolding, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateHolding: (id: string, updates: Partial<AssetHolding>) => Promise<void>
  deleteHolding: (id: string) => Promise<void>
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  holdings: [],
  transactions: [],
  loading: false,

  loadHoldings: async () => {
    set({ loading: true })
    const holdings = await db.holdings.toArray()
    const transactions = await db.transactions.toArray()
    set({ holdings, transactions, loading: false })
  },

  addHolding: async (data) => {
    const now = new Date().toISOString()
    const holding: AssetHolding = { ...data, id: generateId(), createdAt: now, updatedAt: now }
    await db.holdings.add(holding)
    const tx: Transaction = {
      id: generateId(),
      holdingId: holding.id,
      type: 'BUY',
      date: data.buyDate,
      quantity: data.quantity,
      price: data.buyPrice,
      fee: data.fee,
      totalAmount: data.quantity * data.buyPrice + data.fee,
      notes: `初始买入 ${data.ticker}`,
      createdAt: now,
    }
    await db.transactions.add(tx)
    set(state => ({ holdings: [...state.holdings, holding], transactions: [...state.transactions, tx] }))
  },

  updateHolding: async (id, updates) => {
    const updatedAt = new Date().toISOString()
    await db.holdings.update(id, { ...updates, updatedAt })
    set(state => ({ holdings: state.holdings.map(h => h.id === id ? { ...h, ...updates, updatedAt } : h) }))
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
}))
