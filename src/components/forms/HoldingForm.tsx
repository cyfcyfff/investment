import { useEffect } from 'react'
import { Form, Input, Select, InputNumber, DatePicker, Space } from 'antd'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import dayjs from 'dayjs'
import { CATEGORY_LABELS, Category, CATEGORIES } from '../../types'
import type { AssetHolding } from '../../types'

const CURRENCY_OPTIONS = ['USD', 'CNY', 'EUR', 'JPY', 'GBP', 'HKD']

const holdingSchema = z.object({
  name: z.string().min(1, '请输入资产名称'),
  ticker: z.string().min(1, '请输入代码').max(20, '代码最多20字符'),
  category: z.enum([Category.STOCKS, Category.LONG_BONDS, Category.GOLD, Category.CASH], {
    message: '请选择类别',
  }),
  currency: z.string().min(1, '请选择货币'),
  buyPrice: z.number({ message: '请输入买入价格' }).positive('价格必须大于0'),
  quantity: z.number({ message: '请输入数量' }).positive('数量必须大于0'),
  fee: z.number({ message: '请输入手续费' }).min(0, '手续费不能为负'),
  buyDate: z.string().min(1, '请选择买入日期'),
  notes: z.string().default(''),
})

export type HoldingFormData = z.infer<typeof holdingSchema>

interface HoldingFormProps {
  initialValues?: Partial<AssetHolding>
  onSubmit: (data: HoldingFormData) => void
  onCancel: () => void
  loading?: boolean
}

export default function HoldingForm({ initialValues, onSubmit, onCancel, loading }: HoldingFormProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HoldingFormData>({
    resolver: zodResolver(holdingSchema) as any,
    defaultValues: {
      name: '',
      ticker: '',
      category: Category.STOCKS,
      currency: 'USD',
      buyPrice: 0,
      quantity: 0,
      fee: 0,
      buyDate: dayjs().format('YYYY-MM-DD'),
      notes: '',
    },
  })

  useEffect(() => {
    if (initialValues) {
      reset({
        name: initialValues.name ?? '',
        ticker: initialValues.ticker ?? '',
        category: initialValues.category ?? Category.STOCKS,
        currency: initialValues.currency ?? 'USD',
        buyPrice: initialValues.buyPrice ?? 0,
        quantity: initialValues.quantity ?? 0,
        fee: initialValues.fee ?? 0,
        buyDate: initialValues.buyDate ?? dayjs().format('YYYY-MM-DD'),
        notes: initialValues.notes ?? '',
      })
    }
  }, [initialValues, reset])

  return (
    <Form layout="vertical" onFinish={handleSubmit(onSubmit as any)}>
      <Form.Item
        label="资产名称"
        required
        validateStatus={errors.name ? 'error' : ''}
        help={errors.name?.message}
      >
        <Controller
          name="name"
          control={control}
          render={({ field }) => <Input {...field} placeholder="如：Vanguard Total World Stock ETF" />}
        />
      </Form.Item>

      <Form.Item
        label="代码"
        required
        validateStatus={errors.ticker ? 'error' : ''}
        help={errors.ticker?.message}
      >
        <Controller
          name="ticker"
          control={control}
          render={({ field }) => <Input {...field} placeholder="如：VT" style={{ textTransform: 'uppercase' }} />}
        />
      </Form.Item>

      <Form.Item
        label="类别"
        required
        validateStatus={errors.category ? 'error' : ''}
        help={errors.category?.message}
      >
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select {...field}>
              {CATEGORIES.map((cat) => (
                <Select.Option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </Select.Option>
              ))}
            </Select>
          )}
        />
      </Form.Item>

      <Form.Item
        label="货币"
        required
        validateStatus={errors.currency ? 'error' : ''}
        help={errors.currency?.message}
      >
        <Controller
          name="currency"
          control={control}
          render={({ field }) => (
            <Select {...field}>
              {CURRENCY_OPTIONS.map((c) => (
                <Select.Option key={c} value={c}>
                  {c}
                </Select.Option>
              ))}
            </Select>
          )}
        />
      </Form.Item>

      <Form.Item
        label="买入价格"
        required
        validateStatus={errors.buyPrice ? 'error' : ''}
        help={errors.buyPrice?.message}
      >
        <Controller
          name="buyPrice"
          control={control}
          render={({ field }) => (
            <InputNumber
              {...field}
              min={0}
              step={0.01}
              precision={4}
              style={{ width: '100%' }}
              onChange={(v) => field.onChange(v ?? 0)}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="数量"
        required
        validateStatus={errors.quantity ? 'error' : ''}
        help={errors.quantity?.message}
      >
        <Controller
          name="quantity"
          control={control}
          render={({ field }) => (
            <InputNumber
              {...field}
              min={0}
              step={1}
              precision={4}
              style={{ width: '100%' }}
              onChange={(v) => field.onChange(v ?? 0)}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="手续费"
        validateStatus={errors.fee ? 'error' : ''}
        help={errors.fee?.message}
      >
        <Controller
          name="fee"
          control={control}
          render={({ field }) => (
            <InputNumber
              {...field}
              min={0}
              step={0.01}
              precision={2}
              style={{ width: '100%' }}
              onChange={(v) => field.onChange(v ?? 0)}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="买入日期"
        required
        validateStatus={errors.buyDate ? 'error' : ''}
        help={errors.buyDate?.message}
      >
        <Controller
          name="buyDate"
          control={control}
          render={({ field }) => (
            <DatePicker
              value={field.value ? dayjs(field.value) : null}
              onChange={(date) => field.onChange(date ? date.format('YYYY-MM-DD') : '')}
              style={{ width: '100%' }}
            />
          )}
        />
      </Form.Item>

      <Form.Item label="备注">
        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <Input.TextArea {...field} rows={3} placeholder="可选备注" />
          )}
        />
      </Form.Item>

      <Form.Item>
        <Space>
          <button type="submit" className="ant-btn ant-btn-primary" disabled={loading}>
            {loading ? '保存中...' : initialValues ? '更新' : '添加'}
          </button>
          <button type="button" className="ant-btn" onClick={onCancel}>
            取消
          </button>
        </Space>
      </Form.Item>
    </Form>
  )
}
