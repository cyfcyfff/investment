const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
  CNY: '\u00A5',
  JPY: '\u00A5',
}

export function formatCurrency(value: number, currency: string = 'USD', decimals: number = 2): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return value < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
