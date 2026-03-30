import { useCallback, useEffect } from 'react'
import { Form, Input, Select, InputNumber, DatePicker, Space } from 'antd'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import dayjs from 'dayjs'
import { CATEGORY_LABELS, Category, CATEGORIES } from '../../types'
import type { AssetHolding } from '../../types'

// 预设资产列表：每个类别下的可选资产
interface PresetAsset {
  ticker: string
  name: string
  currency: string
}

const PRESET_ASSETS: Record<Category, PresetAsset[]> = {
  [Category.STOCKS]: [
    { ticker: 'QQQ', name: '纳斯达克 100 ETF (Invesco QQQ Trust)', currency: 'USD' },
    { ticker: 'SPY', name: '标普 500 ETF (SPDR S&P 500)', currency: 'USD' },
    { ticker: '510300.SS', name: '沪深 300 ETF (华泰柏瑞)', currency: 'CNY' },
  ],
  [Category.LONG_BONDS]: [
    { ticker: 'TLT', name: '20年+ 美国国债 ETF (iShares)', currency: 'USD' },
    { ticker: 'EDV', name: '30年 美国国债 ETF (Vanguard)', currency: 'USD' },
  ],
  [Category.GOLD]: [
    { ticker: 'XAUUSD', name: '现货黄金 (XAU/USD)', currency: 'USD' },
    { ticker: 'GLD', name: '黄金 ETF (SPDR Gold Shares)', currency: 'USD' },
  ],
  [Category.CASH]: [
    { ticker: 'BIL', name: '美国超短债 ETF (SPDR 1-3 Month T-Bill)', currency: 'USD' },
  ],
}

const CURRENCY_OPTIONS = ['USD', 'CNY', 'EUR', 'JPY', 'GBP', 'HKD']

const holdingSchema = z.object({
  name: z.string().min(1, '请输入资产名称'),
  ticker: z.string().min(1, '请选择或输入代码').max(20, '代码最多20字符'),
  category: z.enum([Category.STOCKS, Category.LONG_BONDS, Category.GOLD, Category.CASH], {
    message: '请选择类别',
  }),
  currency: z.string().min(1, '请选择货币'),
  buyPrice: z.number({ message: '请输入买入价格' }).positive('价格必须大于0'),
  quantity: z.number({ message: '请输入数量' }).positive('数量必须大于0'),
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
    setValue,
    formState: { errors },
  } = useForm<HoldingFormData>({
    resolver: zodResolver(holdingSchema) as unknown as Resolver<HoldingFormData>,
    defaultValues: {
      name: '',
      ticker: '',
      category: Category.STOCKS,
      currency: 'USD',
      buyPrice: 0,
      quantity: 0,
      buyDate: dayjs().format('YYYY-MM-DD'),
      notes: '',
    },
  })

  // 监听 category 变化，重置 ticker 和 name
  const watchedCategory = useWatch({ control, name: 'category' })

  useEffect(() => {
    if (initialValues) {
      reset({
        name: initialValues.name ?? '',
        ticker: initialValues.ticker ?? '',
        category: initialValues.category ?? Category.STOCKS,
        currency: initialValues.currency ?? 'USD',
        buyPrice: initialValues.buyPrice ?? 0,
        quantity: initialValues.quantity ?? 0,
        buyDate: initialValues.buyDate ?? dayjs().format('YYYY-MM-DD'),
        notes: initialValues.notes ?? '',
      })
    }
  }, [initialValues, reset])

  // 切换类别时清空 ticker 和 name（编辑模式不触发）
  useEffect(() => {
    if (!initialValues) {
      setValue('ticker', '')
      setValue('name', '')
    }
  }, [watchedCategory, initialValues, setValue])

  const handlePresetSelect = (ticker: string) => {
    const assets = PRESET_ASSETS[watchedCategory]
    const selected = assets.find(a => a.ticker === ticker)
    if (selected) {
      setValue('ticker', selected.ticker)
      setValue('name', selected.name)
      setValue('currency', selected.currency)
    }
  }

  const watchedTicker = useWatch({ control, name: 'ticker' })
  const currentOptions = PRESET_ASSETS[watchedCategory] ?? []

  const handleFinish = useCallback(() => {
    void handleSubmit(onSubmit)()
  }, [handleSubmit, onSubmit])

  return (
    <Form layout="vertical" onFinish={handleFinish}>
      <Form.Item
        label="资产类别"
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
        label="选择资产"
        required
      >
        <Select
          placeholder="请选择预设资产"
          allowClear
          onChange={handlePresetSelect}
          value={
            currentOptions.find(a => a.ticker === watchedTicker)
              ?.ticker ?? undefined
          }
          options={currentOptions.map(a => ({
            value: a.ticker,
            label: `${a.name} (${a.ticker})`,
          }))}
          showSearch
          optionFilterProp="label"
        />
      </Form.Item>

      <Form.Item
        label="资产代码"
        required
        validateStatus={errors.ticker ? 'error' : ''}
        help={errors.ticker?.message}
      >
        <Controller
          name="ticker"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              placeholder="选择预设资产后自动填入，也可手动输入"
              style={{ textTransform: 'uppercase' }}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="资产名称"
        required
        validateStatus={errors.name ? 'error' : ''}
        help={errors.name?.message}
      >
        <Controller
          name="name"
          control={control}
          render={({ field }) => <Input {...field} placeholder="选择预设资产后自动填入，也可手动输入" />}
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
                <Select.Option key={c} value={c}>{c}</Select.Option>
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
