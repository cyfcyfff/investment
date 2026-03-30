import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, Select, Input, InputNumber, Button, Space } from 'antd'
import type { RebalanceTrade } from '../../types'

const tradeRecordSchema = z.object({
  holdingId: z.string().min(1, '请选择标的'),
  actualQuantity: z.number().positive('数量必须大于 0'),
  actualPrice: z.number().positive('价格必须大于 0'),
  actualFee: z.number().min(0, '费用不能为负'),
  date: z.string().min(1, '请选择日期'),
  notes: z.string(),
})

export type TradeRecordFormData = z.infer<typeof tradeRecordSchema>

interface TradeRecordFormProps {
  trades: RebalanceTrade[]
  onSubmit: (data: TradeRecordFormData) => void
  onCancel: () => void
}

export default function TradeRecordForm({ trades, onSubmit, onCancel }: TradeRecordFormProps) {
  const { control, handleSubmit, watch } = useForm<TradeRecordFormData>({
    resolver: zodResolver(tradeRecordSchema) as any,
    defaultValues: {
      holdingId: trades.length > 0 ? trades[0].holdingId : '',
      actualQuantity: trades.length > 0 ? trades[0].quantity : 0,
      actualPrice: trades.length > 0 ? trades[0].estimatedPrice : 0,
      actualFee: trades.length > 0 ? trades[0].estimatedFee : 0,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  })

  const selectedHoldingId = watch('holdingId')
  const selectedTrade = trades.find(t => t.holdingId === selectedHoldingId)

  const tickerOptions = trades.map(t => ({
    value: t.holdingId,
    label: `${t.ticker} (${t.side === 'SELL' ? '卖出' : '买入'})`,
  }))

  return (
    <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
      <Controller
        name="holdingId"
        control={control}
        render={({ field }) => (
          <Form.Item label="标的">
            <Select {...field} options={tickerOptions} />
          </Form.Item>
        )}
      />
      {selectedTrade && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f6f6f6', borderRadius: 8 }}>
          <div>建议方向: {selectedTrade.side === 'SELL' ? '卖出' : '买入'}</div>
          <div>建议数量: {selectedTrade.quantity}</div>
          <div>建议金额: {selectedTrade.estimatedAmount.toFixed(2)}</div>
        </div>
      )}
      <Space size="large">
        <Controller
          name="actualQuantity"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <Form.Item label="实际数量" validateStatus={error ? 'error' : ''} help={error?.message}>
              <InputNumber {...field} min={0} step={0.01} precision={4} style={{ width: 140 }} />
            </Form.Item>
          )}
        />
        <Controller
          name="actualPrice"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <Form.Item label="实际价格" validateStatus={error ? 'error' : ''} help={error?.message}>
              <InputNumber {...field} min={0} step={0.01} precision={4} style={{ width: 140 }} />
            </Form.Item>
          )}
        />
        <Controller
          name="actualFee"
          control={control}
          render={({ field }) => (
            <Form.Item label="实际费用">
              <InputNumber {...field} min={0} step={0.01} precision={2} style={{ width: 120 }} />
            </Form.Item>
          )}
        />
      </Space>
      <Controller
        name="date"
        control={control}
        render={({ field }) => (
          <Form.Item label="交易日期">
            <input
              type="date"
              value={field.value}
              onChange={e => field.onChange(e.target.value)}
              style={{ padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6 }}
            />
          </Form.Item>
        )}
      />
      <Controller
        name="notes"
        control={control}
        render={({ field }) => (
          <Form.Item label="备注">
            <Input.TextArea {...field} rows={2} />
          </Form.Item>
        )}
      />
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">记录交易</Button>
          <Button onClick={onCancel}>取消</Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
