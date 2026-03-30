import { useEffect, useMemo } from 'react'
import { Row, Col, Card, Statistic, Empty, Spin, Typography, Timeline, Tag, Divider } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, FundOutlined, LineChartOutlined, WarningOutlined } from '@ant-design/icons'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useQuoteStore } from '../../stores/quoteStore'
import { useConfigStore } from '../../stores/configStore'
import { calculatePerformance } from '../../services/performanceService'
import { ensureDailySnapshot } from '../../services/snapshotService'
import NetValueChart from '../../components/charts/NetValueChart'

const { Title } = Typography

const TRANSACTION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  BUY: { label: '买入', color: 'green' },
  SELL: { label: '卖出', color: 'red' },
  REBALANCE_IN: { label: '再平衡买入', color: 'blue' },
  REBALANCE_OUT: { label: '再平衡卖出', color: 'orange' },
  DIVIDEND: { label: '股息', color: 'gold' },
}

export default function History() {
  const { holdings, transactions, snapshots, loadHoldings, loadSnapshots } = usePortfolioStore()
  const { quotes, fxRates, loading } = useQuoteStore()
  const { appConfig } = useConfigStore()

  useEffect(() => {
    loadHoldings()
    loadSnapshots()
  }, [loadHoldings, loadSnapshots])

  // Ensure daily snapshot on page load
  useEffect(() => {
    if (holdings.length > 0 && Object.keys(quotes).length > 0) {
      const prices: Record<string, number> = {}
      for (const [ticker, quote] of Object.entries(quotes)) {
        prices[ticker] = quote.price
      }
      const fxMap: Record<string, number> = {}
      for (const [key, fx] of Object.entries(fxRates)) {
        fxMap[key] = fx.rate
      }
      ensureDailySnapshot(holdings, prices, fxMap, appConfig.baseCurrency)
        .then(() => loadSnapshots())
        .catch(() => {})
    }
  }, [holdings, quotes, fxRates, appConfig.baseCurrency, loadSnapshots])

  const performance = useMemo(
    () => calculatePerformance(snapshots),
    [snapshots],
  )

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions],
  )

  if (holdings.length === 0) {
    return (
      <div>
        <Title level={3}>历史记录</Title>
        <Empty description="暂无持仓，请先添加持仓以开始追踪" />
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>历史记录</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总收益率"
              value={performance.totalReturn * 100}
              precision={2}
              suffix="%"
              valueStyle={{ color: performance.totalReturn >= 0 ? '#3f8600' : '#cf1322' }}
              prefix={performance.totalReturn >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="年化收益率 (CAGR)"
              value={performance.cagr * 100}
              precision={2}
              suffix="%"
              valueStyle={{ color: performance.cagr >= 0 ? '#3f8600' : '#cf1322' }}
              prefix={<FundOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="最大回撤"
              value={performance.maxDrawdown * 100}
              precision={2}
              suffix="%"
              valueStyle={{ color: '#cf1322' }}
              prefix={<WarningOutlined />}
            />
            {performance.maxDrawdownDate && (
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {new Date(performance.maxDrawdownDate).toLocaleDateString('zh-CN')}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="快照数量" value={performance.snapshotsCount} suffix={performance.snapshotsCount > 0 ? '个' : ''} prefix={<LineChartOutlined />} />
            {performance.firstSnapshotDate && (
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {new Date(performance.firstSnapshotDate).toLocaleDateString('zh-CN')} ~ {new Date(performance.lastSnapshotDate).toLocaleDateString('zh-CN')}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {performance.snapshotsCount < 2 && (
        <Empty description="快照数据不足，无法显示收益指标。持续使用应用后将自动积累每日快照。" style={{ marginBottom: 24 }} />
      )}

      <Card title="净值曲线" style={{ marginBottom: 24 }}>
        {loading ? <Spin /> : <NetValueChart snapshots={snapshots} baseCurrency={appConfig.baseCurrency} />}
      </Card>

      <Divider />

      <Card title="交易记录">
        {sortedTransactions.length === 0 ? (
          <Empty description="暂无交易记录" />
        ) : (
          <Timeline
            items={sortedTransactions.map(tx => {
              const typeInfo = TRANSACTION_TYPE_LABELS[tx.type] ?? { label: tx.type, color: 'default' }
              return {
                color: typeInfo.color,
                children: (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                      <span style={{ fontWeight: 500 }}>{tx.holdingId}</span>
                      <span style={{ color: '#999', fontSize: 13 }}>{new Date(tx.date).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      数量: {tx.quantity} | 价格: {tx.price} | 费用: {tx.fee} | 总额: {tx.totalAmount}
                    </div>
                    {tx.notes && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{tx.notes}</div>}
                  </div>
                ),
              }
            })}
          />
        )}
      </Card>
    </div>
  )
}
