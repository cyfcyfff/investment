export interface Quote {
  ticker: string
  price: number
  currency: string
  change: number
  changePercent: number
  asOf: string
  source: string
}

export interface FxRate {
  base: string
  quote: string
  rate: number
  asOf: string
  source: string
}

export type QuoteSource = 'YAHOO' | 'FMP' | 'ALPHA_VANTAGE' | 'TWELVE_DATA' | 'CACHE'
export type FxSource = 'YAHOO' | 'FMP' | 'EXCHANGE_RATE_HOST' | 'OPEN_ER_API' | 'CACHE'

export interface QuoteCacheEntry {
  quote: Quote
  expiresAt: number
}

export interface FxCacheEntry {
  rate: FxRate
  expiresAt: number
}
