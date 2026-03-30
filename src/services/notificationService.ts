import { Category, CATEGORY_LABELS, CATEGORIES } from '../types'
import type { RebalanceConfig } from '../types'

/**
 * Send a message via Telegram Bot API.
 */
export async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  message: string,
): Promise<boolean> {
  if (!botToken || !chatId) return false
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      console.warn('[Telegram] 发送失败:', response.status, payload)
      return false
    }
    return true
  } catch (e) {
    console.warn('[Telegram] 请求异常:', e)
    return false
  }
}

/**
 * Build an HTML message for rebalance trigger notification.
 */
export function buildRebalanceMessage(
  weights: Record<Category, number>,
  config: RebalanceConfig,
  breachCategories: Category[],
  totalValue: number,
): string {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

  let lines = [
    `<b>PermPort 再平衡提醒</b>`,
    `<i>${now}</i>`,
    '',
    `<b>组合总市值:</b> ${totalValue.toLocaleString()}`,
    '',
    '<b>各类权重:</b>',
  ]

  for (const cat of CATEGORIES) {
    const w = (weights[cat] ?? 0) * 100
    const target = (config.targets[cat] ?? 0) * 100
    const isBreach = breachCategories.includes(cat)
    const icon = isBreach ? '⚠️' : '✅'
    lines.push(`${icon} ${CATEGORY_LABELS[cat]}: <b>${w.toFixed(1)}%</b> (目标 ${target.toFixed(0)}%)`)
  }

  lines.push('')
  lines.push('超出带宽的类别: ' + breachCategories.map(c => CATEGORY_LABELS[c]).join(', '))
  lines.push('')
  lines.push('请登录 PermPort 查看详细再平衡建议。')

  return lines.join('\n')
}

/**
 * Build a test message to verify Telegram config.
 */
export function buildTestMessage(): string {
  return [
    '<b>PermPort 测试通知</b>',
    '',
    'Telegram 通知配置成功！',
    `时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
  ].join('\n')
}

const LAST_NOTIFIED_KEY = 'permport_last_telegram_notified'

/**
 * Get the timestamp of the last Telegram notification.
 */
export function getLastNotifiedAt(): number {
  const raw = localStorage.getItem(LAST_NOTIFIED_KEY)
  return raw ? parseInt(raw, 10) : 0
}

/**
 * Record that a notification was sent at the given timestamp.
 */
export function setLastNotifiedAt(ts: number): void {
  localStorage.setItem(LAST_NOTIFIED_KEY, String(ts))
}
