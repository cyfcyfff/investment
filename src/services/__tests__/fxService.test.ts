import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchFxRate, fetchFxRates } from '../fxService'

const mockYahooFxResponse = (rate: number) => ({
  chart: {
    result: [{
      meta: {
        regularMarketPrice: rate,
        regularMarketTime: 1705312800,
      },
    }],
  },
})

describe('fetchFxRate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return rate 1 for same currency pair', async () => {
    const result = await fetchFxRate('USD', 'USD')
    expect(result.rate).toBe(1)
    expect(result.base).toBe('USD')
    expect(result.quote).toBe('USD')
    expect(result.source).toBe('SAME_CURRENCY')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should fetch and parse FX rate from Yahoo', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockYahooFxResponse(0.85),
    } as Response)

    const result = await fetchFxRate('GBP', 'USD')
    expect(result.base).toBe('GBP')
    expect(result.quote).toBe('USD')
    expect(result.rate).toBe(0.85)
    expect(result.source).toBe('YAHOO')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('GBPUSD')
  })

  it('should throw on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    await expect(fetchFxRate('XXX', 'USD')).rejects.toThrow(
      'Failed to fetch FX rate XXX/USD: 404',
    )
  })
})

describe('fetchFxRates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return empty object for empty input', async () => {
    const rates = await fetchFxRates([])
    expect(rates).toEqual({})
  })

  it('should fetch multiple FX rates', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooFxResponse(0.85),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooFxResponse(110.5),
      } as Response)

    const rates = await fetchFxRates([
      { base: 'GBP', quote: 'USD' },
      { base: 'JPY', quote: 'USD' },
    ])
    expect(rates['GBP-USD']).toBe(0.85)
    expect(rates['JPY-USD']).toBe(110.5)
  })

  it('should skip failed pairs and return successful ones', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockYahooFxResponse(0.85),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

    const rates = await fetchFxRates([
      { base: 'GBP', quote: 'USD' },
      { base: 'INVALID', quote: 'USD' },
    ])
    expect(rates['GBP-USD']).toBe(0.85)
    expect(rates['INVALID-USD']).toBeUndefined()
  })

  it('should handle same-currency pair without fetch', async () => {
    const rates = await fetchFxRates([{ base: 'USD', quote: 'USD' }])
    expect(rates['USD-USD']).toBe(1)
    expect(fetch).not.toHaveBeenCalled()
  })
})
