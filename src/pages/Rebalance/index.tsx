import { useState, useEffect, useMemo } from 'react'
import {
  Typography, Button, Table, Card, Alert, Drawer, Tag, Divider, Empty, Spin, message,
} from 'antd'
import { ThunderboltOutlined, CheckCircleOutlined, WarningOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useQuoteStore } from '../../stores/quoteStore'
import { useConfigStore } from '../../stores/configStore'
import { generateRebalancePlan } from '../../services/rebalanceService'
import { calculateCategoryWeights, isRebalanceTriggered } from '../../services/calcService'
import { createSnapshot } from '../../services/snapshotService'
import { formatCurrency } from '../../utils/formatters'
import { CATEGORY_LABELS, Category } from '../../types'
import type { Market, RebalancePlan, RebalanceTrade, DistributionConfig, HoldingWithQuote } from '../../types'
import type { TradeRecordFormData } from '../../components/forms/TradeRecordForm'
import WeightComparisonChart from '../../components/charts/WeightComparisonChart'
import TradeRecordForm from '../../components/forms/TradeRecordForm'
import DistributionConfigPanel from '../../components/forms/DistributionConfigPanel'

const { Title } = Typography

export default function Rebalance() {
  const { holdings, loadHoldings, addTransaction, updateHolding } = usePortfolioStore()
  const { quotes, fxRates, loading, refreshAll } = useQuoteStore()
  const { appConfig, rebalanceConfig } = useConfigStore()

  const [plan, setPlan] = useState<RebalancePlan | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [distributionConfig, setDistributionConfig] = useState<DistributionConfig>({})

  useEffect(() => {
    loadHoldings()
  }, [loadHoldings])

  useEffect(() => {
    if (holdings.length > 0) {
      const tickers = holdings.map(h => h.ticker)
      const currencies = holdings.map(h => h.currency)
      const markets: Record<string, Market> = {}
      for (const h of holdings) {
        if (h.market) markets[h.ticker.trim().toUpperCase()] = h.market
      }
      refreshAll(tickers, currencies, appConfig.baseCurrency, appConfig.apiKeys.fmp ?? '', markets)
    }
  }, [holdings, appConfig.baseCurrency, appConfig.apiKeys, refreshAll])

  const prices = useMemo(() => {
    const p: Record<string, number> = {}
    for (const [ticker, quote] of Object.entries(quotes)) {
      p[ticker] = quote.price
    }
    return p
  }, [quotes])

  const fxMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const [key, fx] of Object.entries(fxRates)) {
      m[key] = fx.rate
    }
    return m
  }, [fxRates])

  // 按类别分组的持仓（含市值信息）
  const holdingsByCategory = useMemo(() => {
    const map = new Map<Category, HoldingWithQuote[]>()
    for (const holding of holdings) {
      const price = prices[holding.ticker]
      if (price === undefined) continue
      const fxRate = holding.currency === appConfig.baseCurrency
        ? 1
        : (fxMap[`${holding.currency}-${appConfig.baseCurrency}`] ?? 1)
      const marketValue = holding.quantity * price * fxRate
      const h: HoldingWithQuote = {
        ...holding,
        currentPrice: price,
        marketValue,
        pnl: (price - holding.buyPrice) * holding.quantity,
        pnlPercent: holding.buyPrice > 0 ? ((price - holding.buyPrice) / holding.buyPrice) : 0,
      }
      const arr = map.get(holding.category) ?? []
      arr.push(h)
      map.set(holding.category, arr)
    }
    return map
  }, [holdings, prices, fxMap, appConfig.baseCurrency])

  // 校验自定义比例是否合法
  const isDistributionValid = useMemo(() => {
    for (const [cat, hList] of holdingsByCategory) {
      if (hList.length <= 1) continue
      const dist = distributionConfig[cat]
      if (dist?.mode === 'CUSTOM' && dist.customRatios) {
        const sum = Object.values(dist.customRatios).reduce((s, v) => s + v, 0)
        if (Math.abs(sum - 100) > 0.1) return false
      }
    }
    return true
  }, [distributionConfig, holdingsByCategory])

  // 分配方式变化时重置已生成的 plan
  useEffect(() => {
    setPlan(null)
  }, [distributionConfig])

  const weights = useMemo(
    () => calculateCategoryWeights(holdings, prices, fxMap, appConfig.baseCurrency),
    [holdings, prices, fxMap, appConfig.baseCurrency],
  )

  const rebalanceCheck = useMemo(
    () => isRebalanceTriggered(weights, rebalanceConfig),
    [weights, rebalanceConfig],
  )

  const handleGenerate = () => {
    setGenerating(true)
    try {
      const newPlan = generateRebalancePlan(
        holdings, prices, fxMap, rebalanceConfig, appConfig.baseCurrency, distributionConfig,
      )
      setPlan(newPlan)
      if (newPlan.trades.length === 0) {
        message.info('当前无需再平衡操作')
      }
    } catch (e) {
      message.error('生成建议失败: ' + String(e))
    } finally {
      setGenerating(false)
    }
  }

  const handleBatchRecord = async (data: TradeRecordFormData) => {
    if (!plan) return

    // 批量创建交易记录并更新持仓
    for (const item of data.items) {
      const trade = plan.trades.find(t => t.holdingId === item.holdingId)
      if (!trade) continue

      await addTransaction({
        holdingId: item.holdingId,
        type: trade.side === 'SELL' ? 'REBALANCE_OUT' : 'REBALANCE_IN',
        date: data.date,
        quantity: item.actualQuantity,
        price: item.actualPrice,
        fee: item.actualFee,
        totalAmount: item.actualQuantity * item.actualPrice + item.actualFee,
        notes: data.notes || `再平衡: ${trade.side === 'SELL' ? '卖出' : '买入'} ${trade.ticker}`,
      })

      const holding = usePortfolioStore.getState().holdings.find(h => h.id === item.holdingId)
      if (holding) {
        const delta = trade.side === 'SELL' ? -item.actualQuantity : item.actualQuantity
        const newQuantity = Math.max(0, holding.quantity + delta)
        await updateHolding(item.holdingId, { quantity: newQuantity })
      }
    }

    // 所有持仓更新完成后创建一次快照
    const latestHoldings = usePortfolioStore.getState().holdings
    await createSnapshot(latestHoldings, prices, fxMap, appConfig.baseCurrency, 'REBALANCE')

    setDrawerOpen(false)
    setPlan(null)
    message.success(`已批量记录 ${data.items.length} 笔交易`)
  }

  const columns = [
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80 },
    { title: '标的', dataIndex: 'ticker', key: 'ticker' },
    {
      title: '类别', dataIndex: 'category', key: 'category',
      render: (cat: Category) => <Tag>{CATEGORY_LABELS[cat]}</Tag>,
    },
    {
      title: '方向', dataIndex: 'side', key: 'side',
      render: (side: string) => (
        <Tag color={side === 'SELL' ? 'red' : 'green'}>{side === 'SELL' ? '卖出' : '买入'}</Tag>
      ),
    },
    {
      title: '数量', dataIndex: 'quantity', key: 'quantity',
      render: (q: number) => q.toFixed(4),
    },
    {
      title: '预估价格', dataIndex: 'estimatedPrice', key: 'estimatedPrice',
      render: (p: number) => formatCurrency(p, appConfig.baseCurrency),
    },
    {
      title: '预估金额', dataIndex: 'estimatedAmount', key: 'estimatedAmount',
      render: (a: number) => formatCurrency(a, appConfig.baseCurrency),
    },
    {
      title: '预估费用', dataIndex: 'estimatedFee', key: 'estimatedFee',
      render: (f: number) => formatCurrency(f, appConfig.baseCurrency),
    },
  ]

  if (holdings.length === 0) {
    return (
      <div>
        <Title level={3}>再平衡</Title>
        <Empty description="暂无持仓，请先前往「持仓管理」添加" />
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>再平衡</Title>

      <Card style={{ marginBottom: 16 }}>
        {rebalanceCheck.triggered ? (
          <Alert message="需要再平衡" description={rebalanceCheck.reason} type="warning" icon={<WarningOutlined />} showIcon />
        ) : (
          <Alert message="无需再平衡" description="所有资产类别权重在带宽范围内" type="success" icon={<CheckCircleOutlined />} showIcon />
        )}
      </Card>

      <Card title="分配方式" style={{ marginBottom: 16 }}>
        <DistributionConfigPanel
          holdingsByCategory={holdingsByCategory}
          value={distributionConfig}
          onChange={setDistributionConfig}
        />
      </Card>

      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        onClick={handleGenerate}
        loading={generating}
        disabled={!isDistributionValid}
        size="large"
        style={{ marginBottom: 24 }}
      >
        生成再平衡建议
      </Button>

      {plan && (
        <>
          {plan.trades.length === 0 ? (
            <Alert message="当前无需再平衡操作" description="所有资产类别权重在目标范围内" type="info" showIcon style={{ marginBottom: 24 }} />
          ) : (
            <>
              <Card title="交易建议列表" style={{ marginBottom: 16 }}>
                <Table
                  dataSource={plan.trades}
                  columns={columns}
                  rowKey={(r: RebalanceTrade) => `${r.holdingId}-${r.side}`}
                  pagination={false}
                  size="middle"
                />
              </Card>

              <Card title="权重对比" style={{ marginBottom: 16 }}>
                {loading ? <Spin /> : (
                  <WeightComparisonChart
                    currentWeights={plan.currentWeights}
                    targetWeights={plan.targetWeights}
                    postWeights={plan.postWeights}
                    config={rebalanceConfig}
                  />
                )}
              </Card>

              {plan.warnings.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {plan.warnings.map((w, i) => (
                    <Alert key={i} message={w} type="warning" showIcon icon={<ExclamationCircleOutlined />} style={{ marginBottom: 8 }} />
                  ))}
                </div>
              )}

              <Divider />

              <Alert
                message="风险免责声明"
                description="本建议仅供参考，不构成投资建议。请根据实际情况调整后在外部券商执行，然后点击下方按钮记录实际交易。"
                type="warning" showIcon style={{ marginBottom: 16 }}
              />

              <Button type="primary" onClick={() => setDrawerOpen(true)}>确认再平衡</Button>
            </>
          )}
        </>
      )}

      <Drawer title="记录再平衡交易" width={500} open={drawerOpen} onClose={() => setDrawerOpen(false)} destroyOnClose>
        {plan && plan.trades.length > 0 && (
          <TradeRecordForm trades={plan.trades} onSubmit={handleBatchRecord} onCancel={() => setDrawerOpen(false)} />
        )}
      </Drawer>
    </div>
  )
}
