import { Radio, InputNumber, Button, Typography, Divider } from 'antd'
import { HolderOutlined } from '@ant-design/icons'
import { Category, CATEGORY_LABELS } from '../../types'
import type { AssetHolding, DistributionConfig, HoldingWithQuote } from '../../types'

const { Text } = Typography

interface DistributionConfigPanelProps {
  holdingsByCategory: Map<Category, HoldingWithQuote[]>
  value: DistributionConfig
  onChange: (config: DistributionConfig) => void
}

export default function DistributionConfigPanel({
  holdingsByCategory,
  value,
  onChange,
}: DistributionConfigPanelProps) {
  const multiHoldingCategories = Array.from(holdingsByCategory.entries())
    .filter(([, hList]) => hList.length > 1)

  if (multiHoldingCategories.length === 0) return null

  const handleModeChange = (category: Category, mode: string) => {
    const updated = { ...value }
    if (mode === 'PROPORTIONAL') {
      delete updated[category]
    } else {
      updated[category] = {
        mode: mode as 'EQUAL' | 'CUSTOM',
        ...(mode === 'CUSTOM' ? { customRatios: {} } : {}),
      }
    }
    onChange(updated)
  }

  const handleRatioChange = (category: Category, holdingId: string, ratio: number | null) => {
    const dist = value[category]
    if (!dist || dist.mode !== 'CUSTOM') return
    const ratios = { ...(dist.customRatios ?? {}), [holdingId]: ratio ?? 0 }
    onChange({ ...value, [category]: { ...dist, customRatios: ratios } })
  }

  const handleDistributeEvenly = (category: Category, holdings: AssetHolding[]) => {
    const n = holdings.length
    const evenRatio = Math.floor(10000 / n) / 100
    const ratios: Record<string, number> = {}
    holdings.forEach(h => { ratios[h.id] = evenRatio })
    // 修正舍入误差
    const firstId = holdings[0].id
    const total = evenRatio * n
    ratios[firstId] = +(ratios[firstId] + (100 - total)).toFixed(2)
    const dist = value[category]
    if (!dist) return
    onChange({ ...value, [category]: { ...dist, customRatios: ratios } })
  }

  return (
    <div>
      {multiHoldingCategories.map(([cat, hList], idx) => {
        const dist = value[cat]
        const mode = dist?.mode ?? 'PROPORTIONAL'
        const customRatios = dist?.customRatios ?? {}
        const ratioSum = Object.values(customRatios).reduce((s, v) => s + v, 0)
        const isValid = Math.abs(ratioSum - 100) < 0.1

        return (
          <div key={cat}>
            {idx > 0 && <Divider style={{ margin: '12px 0' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Text strong style={{ minWidth: 80 }}>{CATEGORY_LABELS[cat]}</Text>
              <Radio.Group
                value={mode}
                onChange={e => handleModeChange(cat, e.target.value)}
                size="small"
              >
                <Radio.Button value="PROPORTIONAL">按市值</Radio.Button>
                <Radio.Button value="EQUAL">等额</Radio.Button>
                <Radio.Button value="CUSTOM">自定义</Radio.Button>
              </Radio.Group>
            </div>
            {mode === 'CUSTOM' && (
              <div style={{ marginTop: 8, marginLeft: 92 }}>
                {hList.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ minWidth: 60 }}>{h.ticker}</Text>
                    <InputNumber
                      min={0}
                      max={100}
                      precision={1}
                      step={1}
                      value={customRatios[h.id] ?? 0}
                      onChange={v => handleRatioChange(cat, h.id, v)}
                      style={{ width: 100 }}
                      addonAfter="%"
                      size="small"
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {(customRatios[h.id] ?? 0) / 100 * 100 < 10
                        ? `${(h.quantity * h.currentPrice).toFixed(0)}`
                        : ''}
                    </Text>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <Text style={{ color: isValid ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
                    合计: {ratioSum.toFixed(1)}%
                  </Text>
                  <Button
                    size="small"
                    icon={<HolderOutlined />}
                    onClick={() => handleDistributeEvenly(cat, hList)}
                  >
                    均分
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
