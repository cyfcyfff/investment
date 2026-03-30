import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { PortfolioSnapshot } from '../../types'

interface NetValueChartProps {
  snapshots: PortfolioSnapshot[]
  baseCurrency: string
}

export default function NetValueChart({ snapshots, baseCurrency }: NetValueChartProps) {
  if (snapshots.length < 2) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>需要至少 2 个快照数据</div>
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const data = sorted.map(s => ({
    date: new Date(s.timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
    fullDate: new Date(s.timestamp).toLocaleDateString('zh-CN'),
    总市值: Math.round(s.totalValue * 100) / 100,
  }))

  const values = data.map(d => d['总市值'])
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
        <defs>
          <linearGradient id="netValueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis
          domain={[Math.floor(minVal * 0.98), Math.ceil(maxVal * 1.02)]}
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: unknown) => [`${Number(value).toLocaleString()} ${baseCurrency}`, '总市值']}
          labelFormatter={(label: unknown) => {
            const entry = data.find(d => d.date === label)
            return entry?.fullDate ?? String(label)
          }}
        />
        <ReferenceLine
          y={data[0]['总市值']}
          stroke="#999"
          strokeDasharray="5 5"
          label={{ value: '起始', position: 'right', fontSize: 11 }}
        />
        <Area
          type="monotone"
          dataKey="总市值"
          stroke="#1890ff"
          strokeWidth={2}
          fill="url(#netValueGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
