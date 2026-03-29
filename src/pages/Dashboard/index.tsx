import { useEffect, useMemo } from 'react'
import { Row, Col, Card, Statistic, Alert, Spin, Typography } from 'antd'
import {
  FundOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useQuoteStore } from '../../stores/quoteStore'
import { useConfigStore } from '../../stores/configStore'
import { calculateCategoryWeights, calcMarketValue, isRebalanceTriggered } from '../../services/calcService'
import { formatCurrency } from '../../utils/formatters'
import WeightPieChart from '../../components/charts/WeightPieChart'
import BandGauge from '../../components/charts/BandGauge'

const { Title } = Typography

export default function Dashboard() {
  const navigate = useNavigate()
  const { holdings, loading, loadHoldings } = usePortfolioStore()
  const { quotes, fxRates, loading: quoteLoading, refreshAll, lastUpdated } = useQuoteStore()
  const { rebalanceConfig, appConfig } = useConfigStore()

  useEffect(() => {
    loadHoldings()
  }, [loadHoldings])

  useEffect(() => {
    if (holdings.length > 0) {
      const tickers = holdings.map((h) => h.ticker)
      const currencies = holdings.map((h) => h.currency)
      refreshAll(tickers, currencies, appConfig.baseCurrency)
    }
  }, [holdings, refreshAll, appConfig.baseCurrency])

  // Calculate prices map for calcService
  const pricesMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [ticker, quote] of Object.entries(quotes)) {
      map[ticker] = quote.price
    }
    return map
  }, [quotes])

  // Calculate FX rates map for calcService
  const fxRatesMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [key, rate] of Object.entries(fxRates)) {
      map[key] = rate.rate
    }
    return map
  }, [fxRates])

  const weights = useMemo(
    () => calculateCategoryWeights(holdings, pricesMap, fxRatesMap, appConfig.baseCurrency),
    [holdings, pricesMap, fxRatesMap, appConfig.baseCurrency],
  )

  // Calculate total portfolio value
  const totalValue = useMemo(() => {
    let total = 0
    for (const holding of holdings) {
      const price = pricesMap[holding.ticker]
      if (price === undefined) continue
      const fxKey = `${holding.currency}-${appConfig.baseCurrency}`
      const fxRate = holding.currency === appConfig.baseCurrency ? 1 : (fxRatesMap[fxKey] ?? 1)
      total += calcMarketValue(holding.quantity, price, fxRate)
    }
    return total
  }, [holdings, pricesMap, fxRatesMap, appConfig.baseCurrency])

  const rebalanceCheck = useMemo(
    () => isRebalanceTriggered(weights, rebalanceConfig),
    [weights, rebalanceConfig],
  )

  const isLoading = loading || quoteLoading

  // Empty state
  if (!loading && holdings.length === 0) {
    return (
      <div>
        <Title level={4}>仪表盘</Title>
        <Alert
          type="info"
          showIcon
          message="暂无持仓数据"
          description="请先前往持仓管理页面添加您的投资组合持仓，仪表盘将自动显示组合概览。"
          action={
            <button
              className="ant-btn ant-btn-primary"
              onClick={() => navigate('/holdings')}
            >
              前往添加
            </button>
          }
          style={{ marginTop: 16 }}
        />
      </div>
    )
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>仪表盘</Title>

      <Spin spinning={isLoading}>
        {/* Rebalance warning */}
        {rebalanceCheck.triggered && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message="再平衡提醒"
            description={rebalanceCheck.reason}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Summary cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="组合总市值"
                value={totalValue}
                prefix={<DollarOutlined />}
                formatter={(value) => formatCurrency(value as number, appConfig.baseCurrency)}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="持仓数量"
                value={holdings.length}
                prefix={<FundOutlined />}
                suffix="个"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="数据更新时间"
                value={lastUpdated ? new Date(lastUpdated).getTime() : undefined}
                prefix={<ClockCircleOutlined />}
                formatter={() =>
                  lastUpdated
                    ? new Date(lastUpdated).toLocaleString('zh-CN')
                    : '暂无数据'
                }
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="再平衡状态"
                value={rebalanceCheck.triggered ? '需再平衡' : '正常'}
                prefix={
                  rebalanceCheck.triggered ? (
                    <WarningOutlined style={{ color: '#ff4d4f' }} />
                  ) : (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  )
                }
                valueStyle={{
                  color: rebalanceCheck.triggered ? '#ff4d4f' : '#52c41a',
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Charts */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="资产配比">
              <WeightPieChart weights={weights} config={rebalanceConfig} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="带宽位置">
              <BandGauge weights={weights} config={rebalanceConfig} />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
