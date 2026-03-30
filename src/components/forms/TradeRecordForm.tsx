import { useState } from 'react'
import { InputNumber, Button, Typography, Space } from 'antd'
import type { RebalanceTrade } from '../../types'

const { Text } = Typography

export interface TradeRecordItem {
  holdingId: string
  actualQuantity: number
  actualPrice: number
  actualFee: number
}

export interface TradeRecordFormData {
  items: TradeRecordItem[]
  date: string
  notes: string
}

interface TradeRecordFormProps {
  trades: RebalanceTrade[]
  onSubmit: (data: TradeRecordFormData) => void
  onCancel: () => void
}

export default function TradeRecordForm({ trades, onSubmit, onCancel }: TradeRecordFormProps) {
  const [items, setItems] = useState<TradeRecordItem[]>(
    trades.map(t => ({
      holdingId: t.holdingId,
      actualQuantity: t.quantity,
      actualPrice: t.estimatedPrice,
      actualFee: t.estimatedFee,
    })),
  )
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const updateItem = (index: number, field: keyof Omit<TradeRecordItem, 'holdingId'>, value: number | null) => {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value ?? 0 }
      return updated
    })
  }

  const handleSubmit = () => {
    onSubmit({ items, date, notes })
  }

  return (
    <div>
      {trades.map((trade, index) => (
        <div key={trade.holdingId} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text strong>{trade.ticker}</Text>
            <Text
              style={{
                color: trade.side === 'SELL' ? '#ff4d4f' : '#52c41a',
                fontSize: 12,
              }}
            >
              {trade.side === 'SELL' ? '卖出' : '买入'}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              建议: {trade.quantity.toFixed(4)} 股 × {trade.estimatedPrice.toFixed(2)}
            </Text>
          </div>
          <Space size="middle">
            <InputNumber
              placeholder="实际数量"
              min={0}
              step={0.01}
              precision={4}
              value={items[index].actualQuantity}
              onChange={v => updateItem(index, 'actualQuantity', v)}
              style={{ width: 120 }}
              addonBefore="数量"
              size="small"
            />
            <InputNumber
              placeholder="实际价格"
              min={0}
              step={0.01}
              precision={4}
              value={items[index].actualPrice}
              onChange={v => updateItem(index, 'actualPrice', v)}
              style={{ width: 120 }}
              addonBefore="价格"
              size="small"
            />
            <InputNumber
              placeholder="费用"
              min={0}
              step={0.01}
              precision={2}
              value={items[index].actualFee}
              onChange={v => updateItem(index, 'actualFee', v)}
              style={{ width: 100 }}
              addonBefore="费用"
              size="small"
            />
          </Space>
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Text>交易日期</Text>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ marginLeft: 8, padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text>备注</Text>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="可选"
            style={{
              marginLeft: 8, width: '80%', padding: '4px 11px',
              border: '1px solid #d9d9d9', borderRadius: 6, verticalAlign: 'top',
            }}
          />
        </div>
      </div>

      <Space>
        <Button type="primary" onClick={handleSubmit}>一并提交</Button>
        <Button onClick={onCancel}>取消</Button>
      </Space>
    </div>
  )
}
