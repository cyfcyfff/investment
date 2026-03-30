export interface SearchResult {
  symbol: string
  name: string
  currency: string
  stockExchange: string
  exchangeShortName: string
}

// ─── 新浪财经搜索（主要源）──────────────────────────────────

const SINA_SEARCH_URL = '/api/sina/suggest'

async function searchFromSina(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    // 新浪 API 要求参数在路径中，不用 ? 查询字符串
    const url = `${SINA_SEARCH_URL}/type=&key=${encodeURIComponent(query.trim())}&name=suggestdata`
    const response = await fetch(url)
    if (!response.ok) return []

    // 新浪返回 GBK 编码，需要特殊处理
    const buffer = await response.arrayBuffer()
    const decoder = new TextDecoder('gbk')
    const text = decoder.decode(buffer)

    // 格式：var suggestdata="item1;item2;...";
    const match = text.match(/suggestdata="(.+?)"/)
    if (!match) return []

    const raw = match[1]
    if (!raw.trim()) return []

    const items = raw.split(';').filter(Boolean).slice(0, limit)

    return items
      .map((item) => {
        const fields = item.split(',')
        if (fields.length < 5) return null
        const code = fields[0]!   // sh600900, AAPL, 或中文(英伟达)
        const market = fields[1]!  // 11=A股, 103=美股, 41=其他
        const symbol = fields[2]!  // 600900, aapl, nvda (实际ticker)
        const nameCN = fields[4]!  // 长江电力, 英伟达
        const nameEN = fields[5] ?? ''

        // 用 code 判断交易所前缀，用 symbol 作为最终代码
        const normalizedSymbol = normalizeSinaSymbol(code, symbol)
        return {
          symbol: normalizedSymbol,
          name: nameCN || nameEN || symbol,
          currency: sinaCurrency(market),
          stockExchange: sinaExchange(code),
          exchangeShortName: sinaExchangeShort(market),
        }
      })
      .filter((r): r is SearchResult => r !== null)
  } catch {
    return []
  }
}

/** 新浪代码 → 标准代码：code 用于判断交易所，symbol 是实际 ticker */
function normalizeSinaSymbol(code: string, symbol: string): string {
  const c = code.toLowerCase()
  const s = symbol.toUpperCase()
  if (c.startsWith('sh')) return `${s}.SS`
  if (c.startsWith('sz')) return `${s}.SZ`
  if (c.startsWith('hk')) return `${s}.HK`
  // 美股和其他：直接用 symbol
  return s
}

function sinaCurrency(market: string): string {
  switch (market) {
    case '11': return 'CNY'   // A股
    case '103': return 'USD'  // 美股
    default: return 'USD'
  }
}

function sinaExchange(_code: string): string {
  const c = _code.toLowerCase()
  if (c.startsWith('sh')) return 'Shanghai'
  if (c.startsWith('sz')) return 'Shenzhen'
  if (c.startsWith('hk')) return 'Hong Kong'
  return 'US'
}

function sinaExchangeShort(market: string): string {
  switch (market) {
    case '11': return 'A股'
    case '103': return 'US'
    default: return ''
  }
}

// ─── Yahoo Finance 搜索（备用）──────────────────────────────

const YAHOO_SEARCH_URL = '/api/yahoo/v1/finance/search'

interface YahooQuote {
  symbol: string
  shortname?: string
  longname?: string
  exchDisp?: string
  exchange?: string
  quoteType?: string
}

async function searchFromYahoo(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({
      q: query.trim(),
      quotesCount: String(limit),
      newsCount: '0',
    })
    const response = await fetch(`${YAHOO_SEARCH_URL}?${params}`)
    if (!response.ok) return []
    const data = await response.json()
    const quotes: YahooQuote[] = data?.quotes
    if (!Array.isArray(quotes)) return []

    return quotes
      .filter(q => q?.symbol && (q?.shortname || q?.longname))
      .map(q => ({
        symbol: q.symbol.trim().toUpperCase(),
        name: (q.shortname || q.longname || '').trim(),
        currency: inferCurrency(q.symbol),
        stockExchange: q.exchange?.trim() ?? '',
        exchangeShortName: q.exchDisp?.trim() ?? '',
      }))
  } catch {
    return []
  }
}

function inferCurrency(symbol: string): string {
  const s = symbol.toUpperCase()
  if (s.endsWith('.SS') || s.endsWith('.SZ')) return 'CNY'
  if (s.endsWith('.HK')) return 'HKD'
  if (s.endsWith('.TO') || s.endsWith('.V')) return 'CAD'
  if (s.endsWith('.DE') || s.endsWith('.PA') || s.endsWith('.L')) return 'EUR'
  if (s.endsWith('.JP') || s.endsWith('.T')) return 'JPY'
  return 'USD'
}

// ─── 公开接口 ────────────────────────────────────────────────

/**
 * 搜索标的：新浪财经优先（免费、无限制、支持中英文），Yahoo 备用。
 */
export async function searchTickers(
  query: string,
  _fmpApiKey?: string,
  limit = 10,
): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 1) return []

  // 1) 新浪优先
  let results = await searchFromSina(trimmed, limit)
  if (results.length > 0) return results

  // 2) Yahoo 备用
  results = await searchFromYahoo(trimmed, limit)

  return results
}
