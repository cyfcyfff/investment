import type { Quote } from '../types'

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/'

interface YahooMeta {
  regularMarketPrice: number
  previousClose: number
  currency: string
  regularMarketTime: number
}

function parseYahooQuote(ticker: string, meta: YahooMeta): Quote {
  return {
    ticker,
    price: meta.regularMarketPrice,
    currency: meta.currency,
    change: meta.regularMarketPrice - meta.previousClose,
    changePercent: meta.previousClose !== 0
      ? (meta.regularMarketPrice - meta.previousClose) / meta.previousClose
      : 0,
    asOf: new Date(meta.regularMarketTime * 1000).toISOString(),
    source: 'YAHOO',
  }
}

export async function fetchQuote(ticker: string): Promise<Quote> {
  const url = `${YAHOO_QUOTE_URL}${encodeURIComponent(ticker)}?interval=1d&range=1d`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch quote for ${ticker}: ${response.status}`)
  }
  const data = await response.json()
  const meta = data.chart.result[0].meta
  return parseYahooQuote(ticker, meta)
}

export async function fetchQuotes(tickers: string[]): Promise<Quote[]> {
  if (tickers.length === 0) return []

  const results = await Promise.allSettled(tickers.map(t => fetchQuote(t)))
  const quotes: Quote[] = []

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      quotes.push(results[i].value)
    } else {
      console.warn(
        `Failed to fetch quote for ${tickers[i]}:`,
        (results[i] as PromiseRejectedResult).reason,
      )
    }
  }

  return quotes
}
