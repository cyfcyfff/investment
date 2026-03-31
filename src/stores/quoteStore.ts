import { create } from 'zustand'
import type { Quote, FxRate, Market } from '../types'
import { fetchQuotes } from '../services/quoteService'
import { fetchFxRates } from '../services/fxService'

// 防抖：避免频繁触发请求
let refreshTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 1000

// 限流：两次请求之间最小间隔
let lastRefreshTime = 0
const MIN_INTERVAL_MS = 10000

interface QuoteState {
  quotes: Record<string, Quote>
  fxRates: Record<string, FxRate>
  loading: boolean
  lastUpdated: string | null
  error: string | null
  refreshQuotes: (tickers: string[], apiKey: string, markets?: Record<string, Market>) => Promise<void>
  refreshFxRates: (pairs: Array<{ base: string; quote: string }>) => Promise<void>
  refreshAll: (tickers: string[], currencies: string[], baseCurrency: string, apiKey: string, markets?: Record<string, Market>) => void
}

export const useQuoteStore = create<QuoteState>((set, get) => ({
  quotes: {},
  fxRates: {},
  loading: false,
  lastUpdated: null,
  error: null,

  refreshQuotes: async (tickers, apiKey, markets) => {
    const normalizedTickers = [...new Set(tickers.map(t => t.trim().toUpperCase()).filter(Boolean))]
    if (normalizedTickers.length === 0) return
    set({ loading: true, error: null })
    try {
      const results = await fetchQuotes(normalizedTickers, apiKey, markets)
      const quoteMap: Record<string, Quote> = {}
      for (const q of results) quoteMap[q.ticker.trim().toUpperCase()] = q
      set(state => ({
        quotes: { ...state.quotes, ...quoteMap },
        lastUpdated: new Date().toISOString(),
        loading: false,
      }))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      set({ error: message, loading: false })
    }
  },

  refreshFxRates: async (pairs) => {
    try {
      const rateMap = await fetchFxRates(pairs)
      for (const [key, rate] of Object.entries(rateMap)) {
        const [base, quote] = key.split('-')
        set(state => ({
          fxRates: { ...state.fxRates, [key]: { base, quote, rate, asOf: new Date().toISOString(), source: 'OPEN_ER_API' } },
        }))
      }
    } catch (e) {
      console.warn('FX rate fetch failed:', e)
    }
  },

  refreshAll: (tickers, currencies, baseCurrency, apiKey, markets) => {
    // 清除之前的定时器
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }

    // 防抖：等待一段时间再执行
    refreshTimer = setTimeout(async () => {
      const now = Date.now()
      const elapsed = now - lastRefreshTime

      // 限流：如果距离上次请求太近，等待
      if (elapsed < MIN_INTERVAL_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
      }

      lastRefreshTime = Date.now()

      const uniqueCurrencies = [...new Set(currencies.filter(c => c !== baseCurrency))]
      const pairs = uniqueCurrencies.map(c => ({ base: c, quote: baseCurrency }))

      set({ loading: true, error: null })
      try {
        await Promise.all([
          get().refreshQuotes(tickers, apiKey, markets),
          get().refreshFxRates(pairs),
        ])
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        set({ error: message, loading: false })
      }
    }, DEBOUNCE_MS)
  },
}))
