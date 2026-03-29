export enum Category {
  STOCKS = 'STOCKS',
  LONG_BONDS = 'LONG_BONDS',
  GOLD = 'GOLD',
  CASH = 'CASH',
}

export const CATEGORY_LABELS: Record<Category, string> = {
  [Category.STOCKS]: '股票',
  [Category.LONG_BONDS]: '长期国债',
  [Category.GOLD]: '黄金',
  [Category.CASH]: '现金/短债',
}

export const CATEGORIES: Category[] = [
  Category.STOCKS,
  Category.LONG_BONDS,
  Category.GOLD,
  Category.CASH,
]

export interface AssetHolding {
  id: string
  name: string
  ticker: string
  category: Category
  currency: string
  buyPrice: number
  quantity: number
  fee: number
  buyDate: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type TransactionType = 'BUY' | 'SELL' | 'REBALANCE_IN' | 'REBALANCE_OUT' | 'DIVIDEND'

export interface Transaction {
  id: string
  holdingId: string
  type: TransactionType
  date: string
  quantity: number
  price: number
  fee: number
  totalAmount: number
  notes: string
  createdAt: string
}

export type SnapshotTrigger = 'DAILY' | 'TRADE' | 'REBALANCE' | 'MANUAL'

export interface PortfolioSnapshot {
  id: string
  timestamp: string
  trigger: SnapshotTrigger
  totalValue: number
  baseCurrency: string
  categoryWeights: Record<Category, number>
  holdings: {
    holdingId: string
    marketValue: number
    weight: number
  }[]
  fxRates: Record<string, number>
}

export interface HoldingWithQuote extends AssetHolding {
  currentPrice: number
  marketValue: number
  pnl: number
  pnlPercent: number
}

export interface CategorySummary {
  category: Category
  totalValue: number
  weight: number
  targetWeight: number
  holdings: HoldingWithQuote[]
  isOverweight: boolean
  isUnderweight: boolean
}
