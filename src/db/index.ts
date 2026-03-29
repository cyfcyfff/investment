import Dexie, { type EntityTable } from 'dexie'
import type { AssetHolding, Transaction, PortfolioSnapshot } from '../types'

class PermPortDB extends Dexie {
  holdings!: EntityTable<AssetHolding, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  snapshots!: EntityTable<PortfolioSnapshot, 'id'>

  constructor() {
    super('PermPortDB')
    this.version(1).stores({
      holdings: 'id, ticker, category, currency, buyDate',
      transactions: 'id, holdingId, type, date',
      snapshots: 'id, timestamp, trigger',
    })
  }
}

export const db = new PermPortDB()

export async function initDb(): Promise<void> {
  await db.open()
}
