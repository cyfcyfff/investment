const VALID_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD',
  'SGD', 'KRW', 'INR', 'TWD', 'BRL', 'MXN', 'ZAR', 'SEK', 'NOK',
  'DKK', 'NZD', 'THB', 'MYR', 'PHP', 'IDR', 'VND', 'RUB', 'TRY',
])

export function isValidTicker(ticker: string): boolean {
  return /^[A-Z0-9][A-Z0-9.\-]*[A-Z0-9]$|^[A-Z0-9]$/.test(ticker) && ticker.length >= 1
}

export function isValidCurrency(code: string): boolean {
  return VALID_CURRENCIES.has(code)
}

export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  return !isNaN(date.getTime()) && dateStr.match(/^\d{4}-\d{2}-\d{2}$/) !== null
}

export function isValidWeight(w: number): boolean {
  return typeof w === 'number' && !isNaN(w) && w >= 0 && w <= 1
}
