import { Category, CATEGORIES, CATEGORY_LABELS } from '../../types'
import type { RebalanceConfig } from '../../types'

const CATEGORY_COLORS: Record<Category, string> = {
  [Category.STOCKS]: '#1677ff',
  [Category.LONG_BONDS]: '#52c41a',
  [Category.GOLD]: '#faad14',
  [Category.CASH]: '#ff4d4f',
}

interface BandGaugeProps {
  weights: Record<Category, number>
  config: RebalanceConfig
}

export default function BandGauge({ weights, config }: BandGaugeProps) {
  const { bands, targets } = config

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {CATEGORIES.map((cat) => {
        const currentWeight = weights[cat] ?? 0
        const targetWeight = targets[cat] ?? 0
        const isOverweight = currentWeight > bands.high
        const isUnderweight = currentWeight < bands.low && currentWeight > 0

        const currentPercent = Math.max(0, Math.min(100, currentWeight * 100))
        const bandLowPercent = bands.low * 100
        const bandHighPercent = bands.high * 100
        const targetPercent = targetWeight * 100

        const barColor = isOverweight
          ? '#ff4d4f'
          : isUnderweight
            ? '#fa8c16'
            : CATEGORY_COLORS[cat]

        return (
          <div key={cat}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{CATEGORY_LABELS[cat]}</span>
              <span style={{ fontSize: 13 }}>
                <span style={{ color: barColor, fontWeight: 600 }}>
                  {Math.round(currentPercent)}%
                </span>
                <span style={{ color: '#999', marginLeft: 8 }}>
                  目标 {Math.round(targetPercent)}%
                </span>
              </span>
            </div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 24,
                backgroundColor: '#f5f5f5',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              {/* Band range (green shading) */}
              <div
                style={{
                  position: 'absolute',
                  left: `${bandLowPercent}%`,
                  width: `${bandHighPercent - bandLowPercent}%`,
                  height: '100%',
                  backgroundColor: 'rgba(82, 196, 26, 0.15)',
                  borderLeft: '1px dashed rgba(82, 196, 26, 0.5)',
                  borderRight: '1px dashed rgba(82, 196, 26, 0.5)',
                }}
              />
              {/* Target line (blue vertical) */}
              <div
                style={{
                  position: 'absolute',
                  left: `${targetPercent}%`,
                  top: 0,
                  width: 2,
                  height: '100%',
                  backgroundColor: '#1677ff',
                  zIndex: 2,
                }}
              />
              {/* Current weight bar */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  width: `${currentPercent}%`,
                  height: '100%',
                  backgroundColor: barColor,
                  opacity: 0.7,
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            {/* Scale labels */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: '#bbb',
                marginTop: 2,
              }}
            >
              <span>0%</span>
              <span>{Math.round(bandLowPercent)}%</span>
              <span>{Math.round(bandHighPercent)}%</span>
              <span>100%</span>
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#999' }}>
        <span>
          <span style={{ display: 'inline-block', width: 12, height: 8, backgroundColor: 'rgba(82, 196, 26, 0.15)', border: '1px dashed rgba(82, 196, 26, 0.5)', marginRight: 4, verticalAlign: 'middle' }} />
          带宽范围
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 2, height: 12, backgroundColor: '#1677ff', marginRight: 4, verticalAlign: 'middle' }} />
          目标权重
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 12, height: 8, backgroundColor: '#ff4d4f', opacity: 0.7, marginRight: 4, verticalAlign: 'middle' }} />
          超重
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 12, height: 8, backgroundColor: '#fa8c16', opacity: 0.7, marginRight: 4, verticalAlign: 'middle' }} />
          偏轻
        </span>
      </div>
    </div>
  )
}
