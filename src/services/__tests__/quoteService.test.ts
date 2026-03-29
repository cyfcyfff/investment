import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchQuote, fetchQuotes } from '../quoteService'

const mockMeta = {
  regularMarketPrice: 450.5,
  previousClose: 445.0,
  currency: 'USD',
  regularMarketTime: 1705312800,
}

const mockYahooResponse = (meta: Record<string, unknown> = mockMeta) => ({
  chart: {
    result: [{ meta }],
  },
})

describe('fetchQuote', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch and parse a single quote', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockYahooResponse(),
    } as Response)

    const quote = await fetchQuote('SPY')
    expect(quote.ticker).toBe('SPY')
    expect(quote.price).toBe(450.5)
    expect(quote.currency).toBe('USD')
    expect(quote.change).toBe(5.5)
    expect(quote.changePercent).toBeCloseTo(5.5 / 445)
    expect(quote.source).toBe('YAHOO')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain(encodeURIComponent('SPY'))
  })

  it('should handle zero previousClose gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockYahooResponse({ ...mockMeta, previousClose: 0 }),
    } as Response)

    const quote = await fetchQuote('SPY')
    expect(quote.changePercent).toBe(0)
  })

  it('should throw on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    await expect(fetchQuote('INVALID')).rejects.toThrow('Failed to fetch quote for INVALID: 404')
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
    const quotes = await fetchQuotes([])
    expect(quotes).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should fetch multiple quotes successfully', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooResponse(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooResponse({
          ...mockMeta,
          regularMarketPrice: 200,
          previousClose: 198,
        }),
      } as Response)

    const quotes = await fetchQuotes(['SPY', 'GLD'])
    expect(quotes).toHaveLength(2)
    expect(quotes[0].ticker).toBe('SPY')
    expect(quotes[1].ticker).toBe('GLD')
    expect(quotes[1].price).toBe(200)
  })

  it('should handle partial failures gracefully', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooResponse(),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const quotes = await fetchQuotes(['SPY', 'INVALID'])
    expect(quotes).toHaveLength(1)
    expect(quotes[0].ticker).toBe('SPY')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
