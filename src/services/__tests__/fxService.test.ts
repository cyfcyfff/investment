import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchFxRate, fetchFxRates } from '../fxService'

const mockErApiResponse = (rates: Record<string, number>) => ({
  result: 'success',
  provider: 'European Central Bank',
  documentation: 'https://open.er-api.com/v6/latest',
  terms_of_use: 'https://open.er-api.com/terms',
  time_last_update_unix: 1705312800,
  time_last_update_utc: '2024-01-15 12:00:00',
  time_next_update_unix: 1705399200,
  time_next_update_utc: '2024-01-16 12:00:00',
  time_eol_unix: 0,
  base_code: 'USD',
  rates,
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

  it('should fetch FX rate from open exchange rate API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockErApiResponse({ GBP: 0.85 }),
    } as Response)

    const result = await fetchFxRate('USD', 'GBP')
    expect(result.base).toBe('USD')
    expect(result.quote).toBe('GBP')
    expect(result.rate).toBe(0.85)
    expect(result.source).toBe('OPEN_ER_API')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('latest/USD')
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

  it('should throw when rate not found in response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockErApiResponse({ EUR: 0.9 }),
    } as Response)

    await expect(fetchFxRate('USD', 'GBP')).rejects.toThrow(
      'No FX rate found for USD/GBP',
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

  it('should fetch FX rates grouped by base currency', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockErApiResponse({ GBP: 0.85, JPY: 110.5 }),
    } as Response)

    const rates = await fetchFxRates([
      { base: 'USD', quote: 'GBP' },
      { base: 'USD', quote: 'JPY' },
    ])
    expect(rates['USD-GBP']).toBe(0.85)
    expect(rates['USD-JPY']).toBe(110.5)
    // One fetch call since both share the same base
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('should make separate requests for different base currencies', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockErApiResponse({ USD: 1.1 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockErApiResponse({ JPY: 160 }),
      } as Response)

    const rates = await fetchFxRates([
      { base: 'EUR', quote: 'USD' },
      { base: 'GBP', quote: 'JPY' },
    ])
    expect(rates['EUR-USD']).toBe(1.1)
    expect(rates['GBP-JPY']).toBe(160)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('should skip failed base requests and return successful ones', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockErApiResponse({ USD: 1.1 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

    const rates = await fetchFxRates([
      { base: 'EUR', quote: 'USD' },
      { base: 'INVALID', quote: 'USD' },
    ])
    expect(rates['EUR-USD']).toBe(1.1)
    expect(rates['INVALID-USD']).toBeUndefined()
  })

  it('should handle same-currency pair without fetch', async () => {
    const rates = await fetchFxRates([{ base: 'USD', quote: 'USD' }])
    // Same currency is skipped, so no fetch and empty result
    expect(rates).toEqual({})
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should filter out missing rates from response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockErApiResponse({ GBP: 0.85 }),
    } as Response)

    const rates = await fetchFxRates([
      { base: 'USD', quote: 'GBP' },
      { base: 'USD', quote: 'CNY' },
    ])
    expect(rates['USD-GBP']).toBe(0.85)
    expect(rates['USD-CNY']).toBeUndefined()
  })
})
