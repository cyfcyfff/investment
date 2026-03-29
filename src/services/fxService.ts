import type { FxRate } from '../types'

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

  const pair = `${base}${quote}=X`
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(pair)}?interval=1d&range=1d`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch FX rate ${base}/${quote}: ${response.status}`)
  }
  const data = await response.json()
  const meta = data.chart.result[0].meta
  return {
    base,
    quote,
    rate: meta.regularMarketPrice,
    asOf: new Date(meta.regularMarketTime * 1000).toISOString(),
    source: 'YAHOO',
  }
}

export async function fetchFxRates(
  pairs: Array<{ base: string; quote: string }>,
): Promise<Record<string, number>> {
  const rates: Record<string, number> = {}
  const results = await Promise.allSettled(
    pairs.map(async ({ base, quote }) => {
      const fx = await fetchFxRate(base, quote)
      return { key: `${base}-${quote}`, rate: fx.rate }
    }),
  )

  for (const r of results) {
    if (r.status === 'fulfilled') {
      rates[r.value.key] = r.value.rate
    }
  }

  return rates
}
