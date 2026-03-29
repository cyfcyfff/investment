import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchQuote, fetchQuotes } from '../quoteService'

const FMP_API_KEY = 'test-api-key'

const mockFmpQuoteResponse = (overrides: Record<string, unknown> = {}) => [
  {
    symbol: 'SPY',
    price: 450.5,
    changesPercentage: 1.23,
    change: 5.5,
    previousClose: 445.0,
    timestamp: 1705312800,
    ...overrides,
  },
]

const mockYahooMeta = {
  regularMarketPrice: 200,
  previousClose: 198,
  currency: 'USD',
  regularMarketTime: 1705312800,
}

const mockYahooResponse = (overrides: Record<string, unknown> = {}) => ({
  chart: {
    result: [{ meta: { ...mockYahooMeta, ...overrides } }],
  },
})

describe('fetchQuote', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch from FMP when API key is provided and succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFmpQuoteResponse(),
    } as Response)

    const quote = await fetchQuote('SPY', FMP_API_KEY)
    expect(quote.ticker).toBe('SPY')
    expect(quote.price).toBe(450.5)
    expect(quote.source).toBe('FMP')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('should fallback to Yahoo when FMP fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => ({ 'Error Message': 'Premium' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooResponse({ regularMarketPrice: 414.7, previousClose: 400.64 }),
      } as Response)

    const quote = await fetchQuote('GLD', FMP_API_KEY)
    expect(quote.ticker).toBe('GLD')
    expect(quote.price).toBe(414.7)
    expect(quote.source).toBe('YAHOO')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('should use Yahoo directly when no API key', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockYahooResponse({ regularMarketPrice: 85.64, previousClose: 86 }),
    } as Response)

    const quote = await fetchQuote('TLT', '')
    expect(quote.ticker).toBe('TLT')
    expect(quote.price).toBe(85.64)
    expect(quote.source).toBe('YAHOO')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('should throw when both sources fail', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 402 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)

    await expect(fetchQuote('INVALID', FMP_API_KEY)).rejects.toThrow()
  })

  it('should fallback to Stooq when Yahoo is rate limited', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'XAUUSD,20260327,220004,4411.41,4553.99,4376.46,4494.04,,',
      } as Response)

    const quote = await fetchQuote('XAUUSD', '')
    expect(quote.ticker).toBe('XAUUSD')
    expect(quote.price).toBe(4494.04)
  })

  it('should fetch CN quote from Tencent for .SS ticker', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => 'v_sh510300="1~沪深300ETF~510300~4.508~4.488~4.450~5626908~3082705~2544203~4.508~11641~4.507~4721~4.506~13124~4.505~6251~4.504~1402~4.509~77~4.510~15548~4.511~4548~4.512~5253~4.513~4832~~20260327161454~0.020~0.45~%";',
    } as Response)

    const quote = await fetchQuote('510300.SS', '')
    expect(quote.ticker).toBe('510300.SS')
    expect(quote.price).toBe(4.508)
    expect(quote.currency).toBe('CNY')
    expect(quote.source).toBe('TENCENT')
  })
})

describe('fetchQuotes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return empty array for empty input', async () => {
    const quotes = await fetchQuotes([], FMP_API_KEY)
    expect(quotes).toEqual([])
  })

  it('should use Yahoo for all tickers when no API key', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooResponse({ regularMarketPrice: 450.5 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooResponse({ regularMarketPrice: 414.7 }),
      } as Response)

    const quotes = await fetchQuotes(['SPY', 'GLD'], '')
    expect(quotes).toHaveLength(2)
    expect(quotes[0].source).toBe('YAHOO')
    expect(quotes[1].source).toBe('YAHOO')
  })

  it('should use FMP for available tickers and fallback to Yahoo for premium ones', async () => {
    // FMP batch: SPY succeeds, GLD is Premium (empty array or error)
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockFmpQuoteResponse({ symbol: 'SPY' }),
      } as Response)
      // Yahoo fallback for GLD
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooResponse({ regularMarketPrice: 414.7 }),
      } as Response)

    const quotes = await fetchQuotes(['SPY', 'GLD'], FMP_API_KEY)
    expect(quotes).toHaveLength(2)
    const spyQuote = quotes.find(q => q.ticker === 'SPY')
    const gldQuote = quotes.find(q => q.ticker === 'GLD')
    expect(spyQuote?.source).toBe('FMP')
    expect(gldQuote?.source).toBe('YAHOO')
    expect(gldQuote?.price).toBe(414.7)
  })

  it('should fallback all to Yahoo when FMP batch fails entirely', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooResponse({ regularMarketPrice: 450.5 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooResponse({ regularMarketPrice: 414.7 }),
      } as Response)

    const quotes = await fetchQuotes(['SPY', 'GLD'], FMP_API_KEY)
    expect(quotes).toHaveLength(2)
    expect(quotes.every(q => q.source === 'YAHOO')).toBe(true)
  })

  it('should handle partial Yahoo failures gracefully', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooResponse({ regularMarketPrice: 414.7 }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const quotes = await fetchQuotes(['GLD', 'INVALID'], '')
    expect(quotes).toHaveLength(1)
    expect(quotes[0].ticker).toBe('GLD')
    warnSpy.mockRestore()
  })
})
