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

// --- M2: Rebalance Suggestion Types ---

export type RebalanceTriggerReason = 'BAND_BREACH' | 'ANNUAL_REVIEW' | 'MANUAL'

export interface RebalanceTrade {
  category: Category
  holdingId: string
  ticker: string
  side: 'BUY' | 'SELL'
  quantity: number
  estimatedPrice: number
  estimatedAmount: number
  estimatedFee: number
  priority: number
}

export interface RebalancePlan {
  id: string
  generatedAt: string
  triggerReason: RebalanceTriggerReason
  triggerDetails: string
  currentWeights: Record<Category, number>
  targetWeights: Record<Category, number>
  trades: RebalanceTrade[]
  postWeights: Record<Category, number>
  totalEstimatedFee: number
  totalEstimatedSlippage: number
  warnings: string[]
}

// --- M2: Performance Tracking Types ---

export interface PerformanceMetrics {
  totalReturn: number
  totalReturnAmount: number
  cagr: number
  maxDrawdown: number
  maxDrawdownDate: string
  currentDrawdown: number
  peakValue: number
  peakDate: string
  daysSincePeak: number
  snapshotsCount: number
  firstSnapshotDate: string
  lastSnapshotDate: string
}

export const EMPTY_PERFORMANCE: PerformanceMetrics = {
  totalReturn: 0,
  totalReturnAmount: 0,
  cagr: 0,
  maxDrawdown: 0,
  maxDrawdownDate: '',
  currentDrawdown: 0,
  peakValue: 0,
  peakDate: '',
  daysSincePeak: 0,
  snapshotsCount: 0,
  firstSnapshotDate: '',
  lastSnapshotDate: '',
}
