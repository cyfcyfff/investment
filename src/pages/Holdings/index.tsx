import { useCallback, useEffect, useMemo, useState } from 'react'
import { Table, Button, Drawer, Space, Empty, Popconfirm, message, Tag, Spin, Typography, Alert } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, MergeOutlined } from '@ant-design/icons'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useQuoteStore } from '../../stores/quoteStore'
import { CATEGORY_LABELS, Category } from '../../types'
import type { Market } from '../../types'
import type { AssetHolding } from '../../types'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import HoldingForm from '../../components/forms/HoldingForm'
import type { HoldingFormData } from '../../components/forms/HoldingForm'
import { useConfigStore } from '../../stores/configStore'

const { Title } = Typography

const CATEGORY_COLORS: Record<Category, string> = {
  [Category.STOCKS]: 'blue',
  [Category.LONG_BONDS]: 'green',
  [Category.GOLD]: 'gold',
  [Category.CASH]: 'default',
}

export default function Holdings() {
  const { holdings, loading, loadHoldings, addHolding, updateHolding, deleteHolding, mergeHoldings } = usePortfolioStore()
  const { quotes, refreshAll, loading: quoteLoading, error: quoteError } = useQuoteStore()
  const { appConfig } = useConfigStore()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingHolding, setEditingHolding] = useState<AssetHolding | undefined>(undefined)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [mergeLoading, setMergeLoading] = useState(false)

  useEffect(() => {
    loadHoldings()
  }, [loadHoldings])

  // Refresh quotes when holdings change
  useEffect(() => {
    if (holdings.length > 0) {
      const tickers = holdings.map((h) => h.ticker.trim().toUpperCase())
      const currencies = holdings.map((h) => h.currency)
      const markets: Record<string, Market> = {}
      for (const h of holdings) {
        if (h.market) markets[h.ticker.trim().toUpperCase()] = h.market
      }
      const apiKey = appConfig.apiKeys?.fmp ?? ''
      refreshAll(tickers, currencies, appConfig.baseCurrency, apiKey, markets)
    }
  }, [holdings, appConfig.baseCurrency, appConfig.apiKeys, refreshAll])

  const handleAdd = useCallback(async (data: HoldingFormData) => {
    setSubmitLoading(true)
    try {
      await addHolding(data)
      message.success('持仓添加成功')
      setDrawerOpen(false)
    } catch {
      message.error('添加失败，请重试')
    } finally {
      setSubmitLoading(false)
    }
  }, [addHolding])

  const handleEdit = useCallback(async (data: HoldingFormData) => {
    if (!editingHolding) return
    setSubmitLoading(true)
    try {
      await updateHolding(editingHolding.id, data)
      message.success('持仓更新成功')
      setDrawerOpen(false)
      setEditingHolding(undefined)
    } catch {
      message.error('更新失败，请重试')
    } finally {
      setSubmitLoading(false)
    }
  }, [editingHolding, updateHolding])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteHolding(id)
      message.success('持仓已删除')
    } catch {
      message.error('删除失败，请重试')
    }
  }, [deleteHolding])

  const openAddDrawer = useCallback(() => {
    setEditingHolding(undefined)
    setDrawerOpen(true)
  }, [])

  const openEditDrawer = useCallback((holding: AssetHolding) => {
    setEditingHolding(holding)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setEditingHolding(undefined)
  }, [])

  const canMerge = useMemo(() => {
    if (selectedRowKeys.length < 2) return false
    const selected = holdings.filter(h => selectedRowKeys.includes(h.id))
    const tickers = new Set(selected.map(h => h.ticker))
    return tickers.size === 1
  }, [selectedRowKeys, holdings])

  const handleMerge = useCallback(async () => {
    if (!canMerge) return
    setMergeLoading(true)
    try {
      await mergeHoldings(selectedRowKeys)
      message.success('持仓合并成功')
      setSelectedRowKeys([])
    } catch (e) {
      message.error(String(e))
    } finally {
      setMergeLoading(false)
    }
  }, [canMerge, mergeHoldings, selectedRowKeys])

  const columns = [
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '代码',
      dataIndex: 'ticker',
      key: 'ticker',
      render: (ticker: string) => <Typography.Text code>{ticker}</Typography.Text>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      render: (category: Category) => (
        <Tag color={CATEGORY_COLORS[category]}>{CATEGORY_LABELS[category]}</Tag>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty: number) => formatNumber(qty),
    },
    {
      title: '买入价格',
      dataIndex: 'buyPrice',
      key: 'buyPrice',
      render: (price: number, record: AssetHolding) => formatCurrency(price, record.currency),
    },
    {
      title: '当前价格',
      key: 'currentPrice',
      render: (_: unknown, record: AssetHolding) => {
        const quote = quotes[record.ticker.trim().toUpperCase()]
        if (!quote) return '-'
        return formatCurrency(quote.price, record.currency)
      },
    },
    {
      title: '市值',
      key: 'marketValue',
      render: (_: unknown, record: AssetHolding) => {
        const quote = quotes[record.ticker.trim().toUpperCase()]
        if (!quote) return '-'
        const fxKey = `${record.currency}-${appConfig.baseCurrency}`
        const fxRate = record.currency === appConfig.baseCurrency ? 1 : (useQuoteStore.getState().fxRates[fxKey]?.rate ?? 1)
        const mv = record.quantity * quote.price * fxRate
        return formatCurrency(mv, appConfig.baseCurrency)
      },
    },
    {
      title: '买入日期',
      dataIndex: 'buyDate',
      key: 'buyDate',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: AssetHolding) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditDrawer(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除 ${record.name} (${record.ticker}) 吗？`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const drawerTitle = editingHolding ? '编辑持仓' : '添加持仓'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>持仓管理</Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadHoldings()
              if (holdings.length > 0) {
                const tickers = holdings.map((h) => h.ticker.trim().toUpperCase())
                const currencies = holdings.map((h) => h.currency)
                const markets: Record<string, Market> = {}
                for (const h of holdings) {
                  if (h.market) markets[h.ticker.trim().toUpperCase()] = h.market
                }
                const apiKey = appConfig.apiKeys?.fmp ?? ''
                refreshAll(tickers, currencies, appConfig.baseCurrency, apiKey, markets)
              }
            }}
            loading={loading || quoteLoading}
          >
            刷新
          </Button>
          <Popconfirm
            title="确认合并持仓？"
            description={`将合并 ${selectedRowKeys.length} 笔持仓，买入价格将按加权平均重新计算`}
            onConfirm={handleMerge}
            okText="确认合并"
            cancelText="取消"
            disabled={!canMerge}
          >
            <Button
              icon={<MergeOutlined />}
              disabled={!canMerge}
              loading={mergeLoading}
            >
              合并持仓
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddDrawer}>
            添加持仓
          </Button>
        </Space>
      </div>

      {quoteError && (
        <Alert
          type="error"
          message="行情数据获取失败"
          description={quoteError}
          showIcon
          closable
          onClose={() => useQuoteStore.setState({ error: null })}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading}>
        {holdings.length === 0 ? (
          <Empty
            description="暂无持仓，点击上方按钮添加"
            style={{ padding: 60 }}
          />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={holdings}
            pagination={false}
            size="middle"
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys as string[]),
            }}
          />
        )}
      </Spin>

      <Drawer
        title={drawerTitle}
        open={drawerOpen}
        onClose={closeDrawer}
        width={480}
        destroyOnClose
      >
        <HoldingForm
          initialValues={editingHolding}
          onSubmit={editingHolding ? handleEdit : handleAdd}
          onCancel={closeDrawer}
          loading={submitLoading}
        />
      </Drawer>
    </div>
  )
}
