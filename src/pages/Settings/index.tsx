import { useCallback, useMemo } from 'react'
import {
  Card,
  Form,
  Select,
  InputNumber,
  Slider,
  Button,
  Alert,
  Space,
  Typography,
  Divider,
  Popconfirm,
  message,
} from 'antd'
import { UndoOutlined, WarningOutlined } from '@ant-design/icons'
import { useConfigStore } from '../../stores/configStore'
import { Category, CATEGORIES, CATEGORY_LABELS, BAND_PRESETS } from '../../types'
import type { BandPreset } from '../../types'

const { Title, Text } = Typography

const CURRENCY_OPTIONS = ['USD', 'CNY', 'EUR', 'JPY', 'GBP', 'HKD']

const BAND_PRESET_LABELS: Record<BandPreset, string> = {
  CONSERVATIVE: '保守 (15-35%)',
  MODERATE: '中等 (20-30%)',
  AGGRESSIVE: '积极 (20-30%)',
  CUSTOM: '自定义',
}

export default function Settings() {
  const { rebalanceConfig, appConfig, updateRebalanceConfig, updateAppConfig, resetToDefaults } =
    useConfigStore()

  // Calculate total target weight
  const totalWeight = useMemo(() => {
    return Object.values(rebalanceConfig.targets).reduce((sum, w) => sum + w, 0)
  }, [rebalanceConfig.targets])

  const handleCurrencyChange = useCallback(
    (value: string) => {
      updateAppConfig({ baseCurrency: value })
    },
    [updateAppConfig],
  )

  const handleRefreshIntervalChange = useCallback(
    (value: number | null) => {
      if (value !== null && value >= 1 && value <= 60) {
        updateAppConfig({ quoteRefreshInterval: value })
      }
    },
    [updateAppConfig],
  )

  const handleTargetWeightChange = useCallback(
    (category: Category, value: number) => {
      updateRebalanceConfig({
        targets: { ...rebalanceConfig.targets, [category]: value },
      })
    },
    [rebalanceConfig.targets, updateRebalanceConfig],
  )

  const handlePresetChange = useCallback(
    (preset: BandPreset) => {
      const bandConfig = BAND_PRESETS[preset]
      updateRebalanceConfig({
        bandPreset: preset,
        bands: { ...bandConfig },
      })
    },
    [updateRebalanceConfig],
  )

  const handleBandLowChange = useCallback(
    (value: number | null) => {
      if (value !== null) {
        updateRebalanceConfig({
          bandPreset: 'CUSTOM',
          bands: { ...rebalanceConfig.bands, low: value },
        })
      }
    },
    [rebalanceConfig.bands, updateRebalanceConfig],
  )

  const handleBandHighChange = useCallback(
    (value: number | null) => {
      if (value !== null) {
        updateRebalanceConfig({
          bandPreset: 'CUSTOM',
          bands: { ...rebalanceConfig.bands, high: value },
        }
        )
      }
    },
    [rebalanceConfig.bands, updateRebalanceConfig],
  )

  const handleMinTradeAmountChange = useCallback(
    (value: number | null) => {
      if (value !== null && value >= 0) {
        updateRebalanceConfig({ minTradeAmount: value })
      }
    },
    [updateRebalanceConfig],
  )

  const handleFeeRateChange = useCallback(
    (value: number | null) => {
      if (value !== null && value >= 0) {
        updateRebalanceConfig({ feeRate: value })
      }
    },
    [updateRebalanceConfig],
  )

  const handleSlippageChange = useCallback(
    (value: number | null) => {
      if (value !== null && value >= 0) {
        updateRebalanceConfig({ slippage: value })
      }
    },
    [updateRebalanceConfig],
  )

  const handleReset = useCallback(() => {
    resetToDefaults()
    message.success('已恢复默认设置')
  }, [resetToDefaults])

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>设置</Title>

      {/* Base Currency */}
      <Card title="基准货币" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="基准货币">
            <Select
              value={appConfig.baseCurrency}
              onChange={handleCurrencyChange}
              style={{ maxWidth: 200 }}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <Select.Option key={c} value={c}>
                  {c}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Card>

      {/* Quote Refresh Interval */}
      <Card title="行情刷新" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="行情刷新间隔 (分钟)">
            <InputNumber
              value={appConfig.quoteRefreshInterval}
              onChange={handleRefreshIntervalChange}
              min={1}
              max={60}
              style={{ width: 120 }}
              addonAfter="分钟"
            />
          </Form.Item>
        </Form>
      </Card>

      {/* Target Weights */}
      <Card title="目标权重" style={{ marginBottom: 16 }}>
        {totalWeight !== 1 && (
          <Alert
            type="warning"
            showIcon
            message={`目标权重总和为 ${Math.round(totalWeight * 100)}%，应为 100%`}
            style={{ marginBottom: 16 }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {CATEGORIES.map((cat) => (
            <div key={cat}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text>{CATEGORY_LABELS[cat]}</Text>
                <Text strong>{Math.round((rebalanceConfig.targets[cat] ?? 0) * 100)}%</Text>
              </div>
              <Slider
                value={Math.round((rebalanceConfig.targets[cat] ?? 0) * 100)}
                onChange={(val) => handleTargetWeightChange(cat, val / 100)}
                min={0}
                max={100}
                step={1}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Rebalance Bands */}
      <Card title="再平衡带宽" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="预设方案">
            <Select
              value={rebalanceConfig.bandPreset}
              onChange={handlePresetChange}
              style={{ maxWidth: 300 }}
            >
              {(Object.keys(BAND_PRESET_LABELS) as BandPreset[]).map((preset) => (
                <Select.Option key={preset} value={preset}>
                  {BAND_PRESET_LABELS[preset]}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="自定义带宽">
            <Space>
              <InputNumber
                value={Math.round(rebalanceConfig.bands.low * 100)}
                onChange={(v) => handleBandLowChange(v !== null ? v / 100 : null)}
                min={0}
                max={100}
                step={1}
                style={{ width: 100 }}
                addonAfter="%"
                placeholder="下限"
              />
              <span>-</span>
              <InputNumber
                value={Math.round(rebalanceConfig.bands.high * 100)}
                onChange={(v) => handleBandHighChange(v !== null ? v / 100 : null)}
                min={0}
                max={100}
                step={1}
                style={{ width: 100 }}
                addonAfter="%"
                placeholder="上限"
              />
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* Trading Parameters */}
      <Card title="交易参数" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="最小交易金额">
            <InputNumber
              value={rebalanceConfig.minTradeAmount}
              onChange={handleMinTradeAmountChange}
              min={0}
              step={10}
              style={{ width: 200 }}
              addonBefore="$"
            />
          </Form.Item>
          <Form.Item label="手续费率 (%)">
            <InputNumber
              value={rebalanceConfig.feeRate * 100}
              onChange={(v) => handleFeeRateChange(v !== null ? v / 100 : null)}
              min={0}
              max={100}
              step={0.01}
              precision={3}
              style={{ width: 200 }}
              addonAfter="%"
            />
          </Form.Item>
          <Form.Item label="滑点 (%)">
            <InputNumber
              value={rebalanceConfig.slippage * 100}
              onChange={(v) => handleSlippageChange(v !== null ? v / 100 : null)}
              min={0}
              max={100}
              step={0.01}
              precision={3}
              style={{ width: 200 }}
              addonAfter="%"
            />
          </Form.Item>
        </Form>
      </Card>

      {/* Reset */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Popconfirm
            title="确认恢复默认设置？"
            description="这将重置所有设置到默认值。"
            onConfirm={handleReset}
            okText="确认"
            cancelText="取消"
          >
            <Button icon={<UndoOutlined />} danger>
              恢复默认设置
            </Button>
          </Popconfirm>
        </Space>
      </Card>

      {/* Disclaimer */}
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        message="风险免责声明"
        description="PermPort 仅提供投资组合管理工具功能，不构成任何投资建议。投资有风险，过往表现不代表未来收益。请根据自身风险承受能力做出投资决策。哈利·布朗永久组合策略的回测表现不代表实际投资收益。使用本工具产生的任何投资决策由用户自行承担风险。"
        style={{ marginBottom: 16 }}
      />
    </div>
  )
}
