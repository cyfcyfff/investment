import type { Category } from './portfolio'

export type BandPreset = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'CUSTOM'

export interface BandConfig {
  low: number
  high: number
}

export const BAND_PRESETS: Record<BandPreset, BandConfig> = {
  CONSERVATIVE: { low: 0.15, high: 0.35 },
  MODERATE: { low: 0.20, high: 0.30 },
  AGGRESSIVE: { low: 0.20, high: 0.30 },
  CUSTOM: { low: 0.20, high: 0.30 },
}

export interface RebalanceConfig {
  targets: Record<Category, number>
  bandPreset: BandPreset
  bands: BandConfig
  annualReviewDate: string
  minTradeAmount: number
  feeRate: number
  slippage: number
  taxRate: number
}

export type PriceBasis = 'REALTIME' | 'CLOSE'

export interface AppConfig {
  baseCurrency: string
  quoteRefreshInterval: number
  priceBasis: PriceBasis
  apiKeys: Record<string, string>
  defaultTickers: Record<Category, string[]>
}

export const DEFAULT_REBALANCE_CONFIG: RebalanceConfig = {
  targets: {
    STOCKS: 0.25,
    LONG_BONDS: 0.25,
    GOLD: 0.25,
    CASH: 0.25,
  },
  bandPreset: 'CONSERVATIVE',
  bands: { low: 0.15, high: 0.35 },
  annualReviewDate: '01-01',
  minTradeAmount: 100,
  feeRate: 0.001,
  slippage: 0.001,
  taxRate: 0,
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  baseCurrency: 'USD',
  quoteRefreshInterval: 15,
  priceBasis: 'CLOSE',
  apiKeys: {},
  defaultTickers: {
    STOCKS: ['VT'],
    LONG_BONDS: ['IGOV'],
    GOLD: ['GLD'],
    CASH: ['BIL'],
  },
}
