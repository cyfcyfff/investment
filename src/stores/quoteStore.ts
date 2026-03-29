import { create } from 'zustand'
import type { Quote, FxRate } from '../types'
import { fetchQuotes } from '../services/quoteService'
import { fetchFxRate } from '../services/fxService'

interface QuoteState {
  quotes: Record<string, Quote>
  fxRates: Record<string, FxRate>
  loading: boolean
  lastUpdated: string | null
  error: string | null
  refreshQuotes: (tickers: string[]) => Promise<void>
  refreshFxRates: (pairs: Array<{ base: string; quote: string }>) => Promise<void>
  refreshAll: (tickers: string[], currencies: string[], baseCurrency: string) => Promise<void>
}

export const useQuoteStore = create<QuoteState>((set, get) => ({
  quotes: {},
  fxRates: {},
  loading: false,
  lastUpdated: null,
  error: null,

  refreshQuotes: async (tickers) => {
    set({ loading: true, error: null })
    try {
      const results = await fetchQuotes(tickers)
      const quoteMap: Record<string, Quote> = {}
      for (const q of results) quoteMap[q.ticker] = q
      set(state => ({ quotes: { ...state.quotes, ...quoteMap }, lastUpdated: new Date().toISOString(), loading: false }))
    } catch (e) { set({ error: String(e), loading: false }) }
  },

  refreshFxRates: async (pairs) => {
    try {
      for (const { base, quote } of pairs) {
        if (base === quote) continue
        const rate = await fetchFxRate(base, quote)
        set(state => ({ fxRates: { ...state.fxRates, [`${base}-${quote}`]: rate } }))
      }
    } catch (e) { console.warn('FX rate fetch failed:', e) }
  },

  refreshAll: async (tickers, currencies, baseCurrency) => {
    const uniqueCurrencies = [...new Set(currencies.filter(c => c !== baseCurrency))]
    const pairs = uniqueCurrencies.map(c => ({ base: c, quote: baseCurrency }))
    await Promise.all([get().refreshQuotes(tickers), get().refreshFxRates(pairs)])
  },
}))
