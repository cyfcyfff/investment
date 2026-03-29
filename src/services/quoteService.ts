import type { Quote } from '../types'

function getTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  const fn = (AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal }).timeout
  return typeof fn === 'function' ? fn(timeoutMs) : undefined
}

// ─── FMP 源 ───────────────────────────────────────────────

const FMP_QUOTE_URL = '/api/fmp/stable/quote'

interface FmpQuoteResponse {
  symbol: string
  price: number
  changesPercentage?: number
  change?: number
  previousClose?: number
  timestamp?: number
}

function parseFmpQuote(item: FmpQuoteResponse): Quote {
  const previousClose = Number(item.previousClose ?? 0)
  const change = Number(item.change ?? 0)
  const timestamp = Number(item.timestamp ?? 0)
  return {
    ticker: String(item.symbol ?? '').trim().toUpperCase(),
    price: Number(item.price),
    currency: 'USD',
    change,
    changePercent: previousClose !== 0 ? change / previousClose : 0,
    asOf: timestamp > 0 ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
    source: 'FMP',
  }
}

async function fetchFromFmp(symbols: string, apiKey: string): Promise<Quote[]> {
  const query = new URLSearchParams({ symbol: symbols, apikey: apiKey }).toString()
  const url = `${FMP_QUOTE_URL}?${query}`
  const response = await fetch(url, { signal: getTimeoutSignal(15000) })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const msg = payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)['Error Message'] ?? (payload as Record<string, unknown>).error ?? ''
      : ''
    throw new Error(`FMP HTTP ${response.status}: ${msg}`)
  }
  const data = await response.json()
  if (!Array.isArray(data)) return []
  return data.filter((item: FmpQuoteResponse) => item?.price != null).map(parseFmpQuote)
}

// ─── Yahoo Finance 源 ─────────────────────────────────────

const YAHOO_QUOTE_URL = '/api/yahoo/v8/finance/chart/'
const STOOQ_QUOTE_URL = '/api/stooq/q/l/'
const TENCENT_QUOTE_URL = '/api/tencent/q='

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

async function fetchFromYahoo(ticker: string): Promise<Quote> {
  const url = `${YAHOO_QUOTE_URL}${encodeURIComponent(ticker)}?interval=1d&range=1d`
  const response = await fetch(url, { signal: getTimeoutSignal(10000) })
  if (!response.ok) {
    throw new Error(`Yahoo HTTP ${response.status}`)
  }
  const data = await response.json()
  const meta = data.chart.result[0].meta
  return parseYahooQuote(ticker, meta)
}

function normalizeTencentSymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase()
  if (t.endsWith('.SS')) return `sh${t.slice(0, -3)}`
  if (t.endsWith('.SZ')) return `sz${t.slice(0, -3)}`
  return t.toLowerCase()
}

function parseTencentAsOf(raw: string): string {
  if (!/^\d{14}$/.test(raw)) return new Date().toISOString()
  const y = raw.slice(0, 4)
  const m = raw.slice(4, 6)
  const d = raw.slice(6, 8)
  const hh = raw.slice(8, 10)
  const mm = raw.slice(10, 12)
  const ss = raw.slice(12, 14)
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+08:00`).toISOString()
}

async function fetchFromTencent(ticker: string): Promise<Quote> {
  const symbol = normalizeTencentSymbol(ticker)
  const url = `${TENCENT_QUOTE_URL}${encodeURIComponent(symbol)}`
  const response = await fetch(url, { signal: getTimeoutSignal(10000) })
  if (!response.ok) {
    throw new Error(`Tencent HTTP ${response.status}`)
  }
  const text = await response.text()
  const raw = text.trim()
  if (!raw || !raw.includes('~')) throw new Error('Tencent invalid response')
  const payload = raw.replace(/^[^"]*"/, '').replace(/";?$/, '')
  const parts = payload.split('~')
  if (parts.length < 32) throw new Error('Tencent invalid payload')
  const price = Number(parts[3] ?? 0)
  const previousClose = Number(parts[4] ?? 0)
  if (!Number.isFinite(price) || price <= 0) throw new Error('Tencent invalid price')
  const asOf = parseTencentAsOf(parts[30] ?? '')
  return {
    ticker,
    price,
    currency: ticker.endsWith('.SS') || ticker.endsWith('.SZ') ? 'CNY' : 'USD',
    change: Number.isFinite(previousClose) ? price - previousClose : 0,
    changePercent: previousClose > 0 ? (price - previousClose) / previousClose : 0,
    asOf,
    source: 'TENCENT',
  }
}

function toStooqSymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase()
  if (t === 'XAUUSD' || t === 'XAGUSD') return t
  if (t.endsWith('.SS')) return `${t.slice(0, -3)}.CN`
  if (t.endsWith('.SZ')) return `${t.slice(0, -3)}.CN`
  return `${t}.US`
}

function parseStooqQuote(ticker: string, csv: string): Quote {
  const lines = csv
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length === 0) throw new Error('Stooq empty response')
  const dataLine = /^symbol,/i.test(lines[0]) ? lines[1] : lines[0]
  if (!dataLine) throw new Error('Stooq empty response')
  const values = dataLine.split(',')
  if (values.length < 7) throw new Error('Stooq invalid response')
  const closeRaw = values[6]?.trim() ?? ''
  if (!closeRaw || closeRaw === 'N/D') throw new Error('Stooq no price')
  const price = Number(closeRaw)
  if (!Number.isFinite(price) || price <= 0) throw new Error('Stooq invalid price')
  const date = values[1]?.trim() ?? ''
  const time = values[2]?.trim() ?? ''
  const formattedDate = /^\d{8}$/.test(date)
    ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
    : ''
  const formattedTime = /^\d{6}$/.test(time)
    ? `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`
    : ''
  const asOf = formattedDate && formattedTime
    ? new Date(`${formattedDate}T${formattedTime}Z`).toISOString()
    : new Date().toISOString()
  return {
    ticker,
    price,
    currency: 'USD',
    change: 0,
    changePercent: 0,
    asOf,
    source: 'YAHOO',
  }
}

async function fetchFromStooq(ticker: string): Promise<Quote> {
  const symbol = toStooqSymbol(ticker)
  const query = new URLSearchParams({ s: symbol.toLowerCase(), i: 'd' }).toString()
  const url = `${STOOQ_QUOTE_URL}?${query}`
  const response = await fetch(url, { signal: getTimeoutSignal(10000) })
  if (!response.ok) {
    throw new Error(`Stooq HTTP ${response.status}`)
  }
  const text = await response.text()
  return parseStooqQuote(ticker, text)
}

async function fetchFromPublicSources(ticker: string): Promise<Quote> {
  if (ticker.endsWith('.SS') || ticker.endsWith('.SZ')) {
    try {
      return await fetchFromTencent(ticker)
    } catch {
      return fetchFromStooq(ticker)
    }
  }
  try {
    return await fetchFromYahoo(ticker)
  } catch {
    return fetchFromStooq(ticker)
  }
}

// ─── 公开接口：双源自动回退 ───────────────────────────────

export async function fetchQuote(ticker: string, apiKey: string): Promise<Quote> {
  const t = ticker.trim().toUpperCase()

  // 1) 有 API Key 时先尝试 FMP
  if (apiKey.trim()) {
    try {
      const results = await fetchFromFmp(t, apiKey.trim())
      if (results.length > 0) return results[0]
    } catch {
      // FMP 失败，回退到 Yahoo
    }
  }

  // 2) 回退到 Yahoo Finance
  return fetchFromPublicSources(t)
}

export async function fetchQuotes(tickers: string[], apiKey: string): Promise<Quote[]> {
  const normalizedTickers = [...new Set(tickers.map(t => t.trim().toUpperCase()).filter(Boolean))]
  if (normalizedTickers.length === 0) return []

  const hasKey = apiKey.trim().length > 0
  const fmpSuccesses = new Set<string>()
  const fmpFailures = new Set<string>()
  let fmpQuotes: Quote[] = []

  // 1) 有 Key 时先尝试 FMP 批量请求
  if (hasKey) {
    try {
      fmpQuotes = await fetchFromFmp(normalizedTickers.join(','), apiKey.trim())
      for (const q of fmpQuotes) fmpSuccesses.add(q.ticker)
    } catch (e) {
      // 批量失败，标记所有为失败，后续逐个尝试
      for (const t of normalizedTickers) fmpFailures.add(t)
      console.warn('FMP batch fetch failed, falling back to Yahoo:', e)
    }
  }

  // 2) 确定需要回退到 Yahoo 的 tickers
  const yahooTickers = hasKey
    ? normalizedTickers.filter(t => !fmpSuccesses.has(t))
    : normalizedTickers

  // 3) 对 FMP 未覆盖的逐个通过 Yahoo 获取
  const yahooResults = await Promise.allSettled(
    yahooTickers.map(t => fetchFromPublicSources(t)),
  )
  const yahooQuotes: Quote[] = []
  for (let i = 0; i < yahooResults.length; i++) {
    const result = yahooResults[i]
    if (result.status === 'fulfilled') {
      yahooQuotes.push(result.value)
    } else {
      console.warn(`Failed to fetch quote for ${yahooTickers[i]}:`, result.reason)
    }
  }

  // 4) FMP 逐个重试失败的（批量请求可能返回 Premium 错误但单个可以）
  if (hasKey && fmpFailures.size > 0) {
    const retryResults = await Promise.allSettled(
      Array.from(fmpFailures).map(t => fetchFromFmp(t, apiKey.trim()).then(r => r[0])),
    )
    for (let i = 0; i < retryResults.length; i++) {
      const result = retryResults[i]
      if (result.status === 'fulfilled' && result.value) {
        // 去重：如果 Yahoo 已经获取了就跳过
        if (!yahooQuotes.some(q => q.ticker === result.value!.ticker)) {
          yahooQuotes.push(result.value)
        }
      }
    }
  }

  return [...fmpQuotes, ...yahooQuotes]
}
