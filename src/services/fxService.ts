import type { FxRate } from '../types'

const FX_RATE_URL = '/api/fxrates/v6/latest'

export async function fetchFxRate(base: string, quote: string): Promise<FxRate> {
  if (base === quote) {
    return {
      base,
      quote,
      rate: 1,
      asOf: new Date().toISOString(),
      source: 'SAME_CURRENCY',
    }
  }

  const url = `${FX_RATE_URL}/${encodeURIComponent(base)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!response.ok) {
    throw new Error(`Failed to fetch FX rate ${base}/${quote}: ${response.status}`)
  }
  const data = await response.json()
  const rate = data?.rates?.[quote]
  if (rate == null) {
    throw new Error(`No FX rate found for ${base}/${quote}`)
  }
  const timeStr = data?.time_last_update_utc ?? new Date().toISOString()
  return {
    base,
    quote,
    rate,
    asOf: new Date(timeStr).toISOString(),
    source: 'OPEN_ER_API',
  }
}

export async function fetchFxRates(
  pairs: Array<{ base: string; quote: string }>,
): Promise<Record<string, number>> {
  if (pairs.length === 0) return {}

  // Group by base currency to minimize API calls
  const byBase = new Map<string, Set<string>>()
  for (const { base, quote: to } of pairs) {
    if (base === to) {
      continue
    }
    if (!byBase.has(base)) {
      byBase.set(base, new Set())
    }
    byBase.get(base)!.add(to)
  }

  const rates: Record<string, number> = {}
  const results = await Promise.allSettled(
    Array.from(byBase.entries()).map(async ([base, targets]) => {
      const targetArr = Array.from(targets)
      const url = `${FX_RATE_URL}/${encodeURIComponent(base)}`
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) return {}
      const data = await response.json()
      const fetched: Record<string, number> = {}
      for (const to of targetArr) {
        const rate = data?.rates?.[to]
        if (rate != null) {
          fetched[`${base}-${to}`] = rate
        }
      }
      return fetched
    }),
  )

  for (const r of results) {
    if (r.status === 'fulfilled') {
      Object.assign(rates, r.value)
    }
  }

  return rates
}
