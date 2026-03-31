import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import MainLayout from './components/Layout/MainLayout'
import Dashboard from './pages/Dashboard'
import Holdings from './pages/Holdings'
import Rebalance from './pages/Rebalance'
import History from './pages/History'
import Settings from './pages/Settings'
import { usePortfolioStore } from './stores/portfolioStore'
import { useQuoteStore } from './stores/quoteStore'
import { useConfigStore } from './stores/configStore'
import type { Market } from './types'
import { calculateCategoryWeights, isRebalanceTriggered } from './services/calcService'
import {
  sendTelegramNotification,
  buildRebalanceMessage,
  getLastNotifiedAt,
  setLastNotifiedAt,
} from './services/notificationService'

function useTelegramNotification() {
  const { appConfig } = useConfigStore()

  useEffect(() => {
    if (!appConfig.telegramEnabled || !appConfig.telegramBotToken || !appConfig.telegramChatId) return

    const checkAndNotify = async () => {
      // 用 getState() 读取最新状态，避免依赖响应式数据导致无限循环
      const { holdings } = usePortfolioStore.getState()
      const { refreshAll } = useQuoteStore.getState()

      if (holdings.length === 0) return

      const tickers = holdings.map(h => h.ticker)
      const currencies = holdings.map(h => h.currency)
      const { baseCurrency, apiKeys } = useConfigStore.getState().appConfig

      const markets: Record<string, Market> = {}
      for (const h of holdings) {
        if (h.market) markets[h.ticker.trim().toUpperCase()] = h.market
      }

      refreshAll(tickers, currencies, baseCurrency, apiKeys.fmp ?? '', markets)

      await new Promise(r => setTimeout(r, 3000))

      // 再次获取最新行情
      const { quotes: latestQuotes, fxRates: latestFx } = useQuoteStore.getState()
      const prices: Record<string, number> = {}
      for (const [ticker, quote] of Object.entries(latestQuotes)) {
        prices[ticker] = quote.price
      }
      const fxMap: Record<string, number> = {}
      for (const [key, fx] of Object.entries(latestFx)) {
        fxMap[key] = fx.rate
      }

      const latestHoldings = usePortfolioStore.getState().holdings
      const latestRebalanceConfig = useConfigStore.getState().rebalanceConfig

      const weights = calculateCategoryWeights(latestHoldings, prices, fxMap, baseCurrency)
      const check = isRebalanceTriggered(weights, latestRebalanceConfig)

      if (!check.triggered) return

      const lastNotified = getLastNotifiedAt()
      const now = Date.now()
      const intervalMs = appConfig.telegramCheckInterval * 60 * 1000
      if (now - lastNotified < intervalMs) return

      let totalValue = 0
      for (const h of latestHoldings) {
        const price = prices[h.ticker]
        if (price === undefined) continue
        const fxRate = h.currency === baseCurrency ? 1 : (fxMap[`${h.currency}-${baseCurrency}`] ?? 1)
        totalValue += h.quantity * price * fxRate
      }

      const message = buildRebalanceMessage(weights, latestRebalanceConfig, check.breachCategories, totalValue)
      const ok = await sendTelegramNotification(appConfig.telegramBotToken, appConfig.telegramChatId, message)
      if (ok) {
        setLastNotifiedAt(now)
      }
    }

    usePortfolioStore.getState().loadHoldings()

    const initialTimer = setTimeout(() => {
      checkAndNotify()
    }, 5000)

    const intervalMs = appConfig.telegramCheckInterval * 60 * 1000
    const interval = setInterval(() => {
      checkAndNotify()
    }, intervalMs)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [
    appConfig.telegramEnabled,
    appConfig.telegramBotToken,
    appConfig.telegramChatId,
    appConfig.telegramCheckInterval,
  ])
}

export default function App() {
  useTelegramNotification()

  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/rebalance" element={<Rebalance />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
