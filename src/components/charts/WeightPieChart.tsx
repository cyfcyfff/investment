import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Category, CATEGORIES, CATEGORY_LABELS } from '../../types'
import type { RebalanceConfig } from '../../types'

const CATEGORY_COLORS: Record<Category, string> = {
  [Category.STOCKS]: '#1677ff',
  [Category.LONG_BONDS]: '#52c41a',
  [Category.GOLD]: '#faad14',
  [Category.CASH]: '#ff4d4f',
}

interface WeightPieChartProps {
  weights: Record<Category, number>
  config: RebalanceConfig
}

interface PieDataItem {
  name: string
  value: number
  fill: string
}

export default function WeightPieChart({ weights, config }: WeightPieChartProps) {
  const data: PieDataItem[] = CATEGORIES.map((cat) => {
    const weight = weights[cat] ?? 0

    return {
      name: CATEGORY_LABELS[cat],
      value: Math.round(weight * 10000) / 100,
      fill: CATEGORY_COLORS[cat],
    }
  }).filter((d) => d.value > 0)

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }) => `${name} ${value}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`${value}%`, '权重']} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => {
          const weight = weights[cat] ?? 0
          const target = config.targets[cat] ?? 0
          const isOverweight = weight > config.bands.high
          const isUnderweight = weight < config.bands.low && weight > 0

          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: CATEGORY_COLORS[cat],
                }}
              />
              <span style={{ fontSize: 12 }}>
                {CATEGORY_LABELS[cat]} {Math.round(weight * 100)}% (目标 {Math.round(target * 100)}%)
                {isOverweight && <span style={{ color: '#ff4d4f' }}> ⚠</span>}
                {isUnderweight && <span style={{ color: '#fa8c16' }}> ⚠</span>}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
