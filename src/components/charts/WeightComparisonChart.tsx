import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Category, CATEGORY_LABELS, CATEGORIES } from '../../types'
import type { RebalanceConfig } from '../../types'

interface WeightComparisonChartProps {
  currentWeights: Record<Category, number>
  targetWeights: Record<Category, number>
  postWeights: Record<Category, number>
  config: RebalanceConfig
}

export default function WeightComparisonChart({ currentWeights, targetWeights, postWeights }: WeightComparisonChartProps) {
  const data = CATEGORIES.map(cat => ({
    name: CATEGORY_LABELS[cat],
    当前: Math.round(currentWeights[cat] * 1000) / 10,
    目标: Math.round(targetWeights[cat] * 1000) / 10,
    执行后: Math.round(postWeights[cat] * 1000) / 10,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis unit="%" domain={[0, 50]} />
        <Tooltip formatter={(value: unknown) => `${value}%`} />
        <Legend />
        <Bar dataKey="当前" fill="#ff7875" />
        <Bar dataKey="目标" fill="#1890ff" />
        <Bar dataKey="执行后" fill="#52c41a" />
      </BarChart>
    </ResponsiveContainer>
  )
}
