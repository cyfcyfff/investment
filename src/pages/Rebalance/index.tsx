import { useState, useEffect, useMemo } from 'react'
import {
  Typography, Button, Table, Card, Alert, Space, Drawer, Tag, Divider, Statistic, Empty, Spin, message,
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
import type { RebalancePlan, RebalanceTrade } from '../../types'
import type { TradeRecordFormData } from '../../components/forms/TradeRecordForm'
import WeightComparisonChart from '../../components/charts/WeightComparisonChart'
import TradeRecordForm from '../../components/forms/TradeRecordForm'

const { Title } = Typography

export default function Rebalance() {
  const { holdings, loadHoldings, addTransaction } = usePortfolioStore()
  const { quotes, fxRates, loading, refreshAll } = useQuoteStore()
  const { appConfig, rebalanceConfig } = useConfigStore()

  const [plan, setPlan] = useState<RebalancePlan | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadHoldings()
  }, [loadHoldings])

  useEffect(() => {
    if (holdings.length > 0) {
      const tickers = holdings.map(h => h.ticker)
      const currencies = holdings.map(h => h.currency)
      refreshAll(tickers, currencies, appConfig.baseCurrency, appConfig.apiKeys.fmp ?? '')
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
      const newPlan = generateRebalancePlan(holdings, prices, fxMap, rebalanceConfig, appConfig.baseCurrency)
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

  const handleRecordTrade = async (data: TradeRecordFormData) => {
    if (!plan) return
    const trade = plan.trades.find(t => t.holdingId === data.holdingId)
    if (!trade) return

    await addTransaction({
      holdingId: data.holdingId,
      type: trade.side === 'SELL' ? 'REBALANCE_OUT' : 'REBALANCE_IN',
      date: data.date,
      quantity: data.actualQuantity,
      price: data.actualPrice,
      fee: data.actualFee,
      totalAmount: data.actualQuantity * data.actualPrice + data.actualFee,
      notes: data.notes || `再平衡: ${trade.side === 'SELL' ? '卖出' : '买入'} ${trade.ticker}`,
    })

    await createSnapshot(holdings, prices, fxMap, appConfig.baseCurrency, 'REBALANCE')

    setDrawerOpen(false)
    message.success('交易记录已保存')
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

      <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate} loading={generating} size="large" style={{ marginBottom: 24 }}>
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

              <Card title="汇总" style={{ marginBottom: 16 }}>
                <Space size="large">
                  <Statistic title="预估总费用" value={plan.totalEstimatedFee} formatter={v => formatCurrency(Number(v), appConfig.baseCurrency)} />
                  <Statistic title="预估滑点" value={plan.totalEstimatedSlippage} formatter={v => formatCurrency(Number(v), appConfig.baseCurrency)} />
                </Space>
                {plan.warnings.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    {plan.warnings.map((w, i) => (
                      <Alert key={i} message={w} type="warning" showIcon icon={<ExclamationCircleOutlined />} style={{ marginBottom: 8 }} />
                    ))}
                  </div>
                )}
              </Card>

              <Divider />

              <Alert
                message="风险免责声明"
                description="本建议仅供参考，不构成投资建议。请根据实际情况调整后在外部券商执行，然后点击下方按钮记录实际交易。"
                type="warning" showIcon style={{ marginBottom: 16 }}
              />

              <Button type="primary" onClick={() => setDrawerOpen(true)}>记录执行结果</Button>
            </>
          )}
        </>
      )}

      <Drawer title="记录再平衡交易" width={500} open={drawerOpen} onClose={() => setDrawerOpen(false)} destroyOnClose>
        {plan && plan.trades.length > 0 && (
          <TradeRecordForm trades={plan.trades} onSubmit={handleRecordTrade} onCancel={() => setDrawerOpen(false)} />
        )}
      </Drawer>
    </div>
  )
}
