import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Form, Input, Select, InputNumber, DatePicker, Space } from 'antd'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import dayjs from 'dayjs'
import { Market, MARKET_LABELS, CATEGORY_LABELS, Category, CATEGORIES } from '../../types'
import type { AssetHolding } from '../../types'
import { searchTickers, type SearchResult } from '../../services/searchService'
import { useConfigStore } from '../../stores/configStore'

// 预设资产列表：按 [category][market] 分组
interface PresetAsset {
  ticker: string
  name: string
  currency: string
  category: Category
  market?: Market
}

const PRESET_ASSETS: Record<Category, PresetAsset[]> = {
  [Category.STOCKS]: [
    { ticker: 'QQQ', name: '纳斯达克 100 ETF (Invesco QQQ Trust)', currency: 'USD', category: Category.STOCKS, market: Market.US },
    { ticker: 'VOO', name: '标普 500 ETF (Vanguard S&P 500)', currency: 'USD', category: Category.STOCKS, market: Market.US },
    { ticker: '510300.SS', name: '沪深 300 ETF (华泰柏瑞)', currency: 'CNY', category: Category.STOCKS, market: Market.CN },
  ],
  [Category.LONG_BONDS]: [
    { ticker: 'TLT', name: '20年+ 美国国债 ETF (iShares)', currency: 'USD', category: Category.LONG_BONDS, market: Market.US },
    { ticker: 'EDV', name: '30年 美国国债 ETF (Vanguard)', currency: 'USD', category: Category.LONG_BONDS, market: Market.US },
  ],
  [Category.GOLD]: [
    { ticker: 'XAUUSD', name: '现货黄金 (XAU/USD)', currency: 'USD', category: Category.GOLD, market: Market.COMMODITY },
    { ticker: 'GLD', name: '黄金 ETF (SPDR Gold Shares)', currency: 'USD', category: Category.GOLD, market: Market.US },
    { ticker: '518880.SS', name: '黄金 ETF (华安)', currency: 'CNY', category: Category.GOLD, market: Market.CN },
  ],
  [Category.CASH]: [
    { ticker: 'BIL', name: '美国超短债 ETF (SPDR 1-3 Month T-Bill)', currency: 'USD', category: Category.CASH, market: Market.US },
  ],
}

const CURRENCY_OPTIONS = ['USD', 'CNY', 'EUR', 'JPY', 'GBP', 'HKD']

const MARKET_DEFAULT_CURRENCY: Record<Market, string> = {
  [Market.US]: 'USD',
  [Market.CN]: 'CNY',
  [Market.HK]: 'HKD',
  [Market.COMMODITY]: 'USD',
}

// 可选市场（用于下拉）
const MARKET_OPTIONS = [
  Market.US,
  Market.CN,
  Market.HK,
].map(m => ({ value: m, label: MARKET_LABELS[m] }))

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
  market: z.nativeEnum(Market).optional(),
})

export type HoldingFormData = z.infer<typeof holdingSchema>

interface HoldingFormProps {
  initialValues?: Partial<AssetHolding>
  onSubmit: (data: HoldingFormData) => void
  onCancel: () => void
  loading?: boolean
}

export default function HoldingForm({ initialValues, onSubmit, onCancel, loading }: HoldingFormProps) {
  const { appConfig } = useConfigStore()
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
      market: undefined,
    },
  })

  // 监听 category 和 market 变化
  const watchedCategory = useWatch({ control, name: 'category' })
  const watchedMarket = useWatch({ control, name: 'market' })

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
        market: initialValues.market,
      })
    }
  }, [initialValues, reset])

  // 切换 category 时清空 ticker 和 name（编辑模式不触发）
  useEffect(() => {
    if (!initialValues) {
      setValue('ticker', '')
      setValue('name', '')
    }
  }, [watchedCategory, initialValues, setValue])

  // 切换 market 时清空 ticker、name，并设置默认货币（编辑模式不触发）
  useEffect(() => {
    if (!initialValues && watchedMarket) {
      setValue('ticker', '')
      setValue('name', '')
      setValue('currency', MARKET_DEFAULT_CURRENCY[watchedMarket] ?? 'USD')
    }
  }, [watchedMarket, initialValues, setValue])

  const watchedTicker = useWatch({ control, name: 'ticker' })
  // 预设资产：按 category 过滤，再按 market 过滤
  const currentPresets = useMemo(() => {
    const byCategory = PRESET_ASSETS[watchedCategory] ?? []
    if (!watchedMarket) return byCategory
    return byCategory.filter(a => a.market === watchedMarket || !a.market)
  }, [watchedCategory, watchedMarket])

  // --- 搜索功能 ---
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleAssetSelect = useCallback((value: string) => {
    // 先尝试搜索结果
    const found = searchResults.find(r => r.symbol === value)
    if (found) {
      setValue('ticker', found.symbol)
      setValue('name', found.name)
      setValue('currency', found.currency)
      setValue('market', found.market)
      return
    }
    // 回退到预设资产
    const preset = currentPresets.find(a => a.ticker === value)
    if (preset) {
      setValue('ticker', preset.ticker)
      setValue('name', preset.name)
      setValue('currency', preset.currency)
      if (preset.market) setValue('market', preset.market)
    }
  }, [searchResults, currentPresets, setValue])

  const handleSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    const apiKey = appConfig.apiKeys?.fmp ?? ''
    setSearchLoading(true)
    debounceRef.current = setTimeout(async () => {
      const results = await searchTickers(query, apiKey || undefined)
      // 按当前选中的市场过滤搜索结果
      const filtered = watchedMarket
        ? results.filter(r => r.market === watchedMarket)
        : results
      setSearchResults(filtered)
      setSearchLoading(false)
    }, 300)
  }, [appConfig.apiKeys?.fmp, watchedMarket])

  // 合并下拉选项：搜索结果 + 预设资产
  const dropdownOptions = useMemo(() => {
    const presetOpt = currentPresets.map(a => ({
      value: a.ticker,
      label: `${a.name} (${a.ticker})`,
    }))
    if (searchResults.length === 0) return presetOpt
    const searchOpt = searchResults.map(r => ({
      value: r.symbol,
      label: `${r.name} (${r.symbol})${r.exchangeShortName ? ` — ${r.exchangeShortName}` : ''}`,
    }))
    return searchOpt
  }, [currentPresets, searchResults])

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
        label="市场"
        help="选择交易市场，决定行情数据来源和搜索范围"
      >
        <Controller
          name="market"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              placeholder="选择市场..."
              allowClear
              options={MARKET_OPTIONS}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="搜索标的"
        extra="输入代码或名称搜索（如 AAPL、600900、黄金ETF），也可从下拉选择预设资产"
      >
        <Select
          placeholder="输入代码或名称搜索..."
          allowClear
          showSearch
          filterOption={false}
          onSearch={handleSearch}
          onChange={handleAssetSelect}
          loading={searchLoading}
          notFoundContent={searchLoading ? '搜索中...' : '未找到结果'}
          options={dropdownOptions}
          value={
            dropdownOptions.find(o => o.value === watchedTicker)
              ?.value ?? undefined
          }
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
              placeholder="选择资产后自动填入，也可手动输入"
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
          render={({ field }) => <Input {...field} placeholder="选择资产后自动填入，也可手动输入" />}
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
