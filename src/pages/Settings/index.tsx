import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Card,
  Form,
  Select,
  InputNumber,
  Slider,
  Button,
  Alert,
  Space,
  Typography,
  Popconfirm,
  Input,
  Switch,
  message,
} from 'antd'
import { UndoOutlined, WarningOutlined, KeyOutlined, SendOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import {
  sendTelegramNotification,
  buildTestMessage,
} from '../../services/notificationService'
import {
  exportAllToJson,
  saveToFile,
  loadFromFile,
  importFromData,
  requestBackupFileHandle,
  writeToExistingHandle,
} from '../../services/backupService'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useConfigStore } from '../../stores/configStore'
import { Category, CATEGORIES, CATEGORY_LABELS, BAND_PRESETS } from '../../types'
import type { BandPreset } from '../../types'

const { Title, Text } = Typography

const CURRENCY_OPTIONS = ['USD', 'CNY', 'EUR', 'JPY', 'GBP', 'HKD']

const BAND_PRESET_LABELS: Record<BandPreset, string> = {
  CONSERVATIVE: '保守 (15-35%)',
  MODERATE: '中等 (20-30%)',
  AGGRESSIVE: '积极 (20-30%)',
  CUSTOM: '自定义',
}

export default function Settings() {
  const { rebalanceConfig, appConfig, updateRebalanceConfig, updateAppConfig, resetToDefaults } =
    useConfigStore()
  const { loadHoldings, loadTransactions, loadSnapshots } = usePortfolioStore()

  // Calculate total target weight
  const totalWeight = useMemo(() => {
    return Object.values(rebalanceConfig.targets).reduce((sum, w) => sum + w, 0)
  }, [rebalanceConfig.targets])

  const handleCurrencyChange = useCallback(
    (value: string) => {
      updateAppConfig({ baseCurrency: value })
    },
    [updateAppConfig],
  )

  const handleApiKeyChange = useCallback(
    (value: string) => {
      updateAppConfig({ apiKeys: { ...appConfig.apiKeys, fmp: value } })
    },
    [appConfig.apiKeys, updateAppConfig],
  )

  const handleRefreshIntervalChange = useCallback(
    (value: number | null) => {
      if (value !== null && value >= 1 && value <= 60) {
        updateAppConfig({ quoteRefreshInterval: value })
      }
    },
    [updateAppConfig],
  )

  const handleTargetWeightChange = useCallback(
    (category: Category, value: number) => {
      updateRebalanceConfig({
        targets: { ...rebalanceConfig.targets, [category]: value },
      })
    },
    [rebalanceConfig.targets, updateRebalanceConfig],
  )

  const handlePresetChange = useCallback(
    (preset: BandPreset) => {
      const bandConfig = BAND_PRESETS[preset]
      updateRebalanceConfig({
        bandPreset: preset,
        bands: { ...bandConfig },
      })
    },
    [updateRebalanceConfig],
  )

  const handleBandLowChange = useCallback(
    (value: number | null) => {
      if (value !== null) {
        updateRebalanceConfig({
          bandPreset: 'CUSTOM',
          bands: { ...rebalanceConfig.bands, low: value },
        })
      }
    },
    [rebalanceConfig.bands, updateRebalanceConfig],
  )

  const handleBandHighChange = useCallback(
    (value: number | null) => {
      if (value !== null) {
        updateRebalanceConfig({
          bandPreset: 'CUSTOM',
          bands: { ...rebalanceConfig.bands, high: value },
        }
        )
      }
    },
    [rebalanceConfig.bands, updateRebalanceConfig],
  )

  const handleMinTradeAmountChange = useCallback(
    (value: number | null) => {
      if (value !== null && value >= 0) {
        updateRebalanceConfig({ minTradeAmount: value })
      }
    },
    [updateRebalanceConfig],
  )

  const handleFeeRateChange = useCallback(
    (value: number | null) => {
      if (value !== null && value >= 0) {
        updateRebalanceConfig({ feeRate: value })
      }
    },
    [updateRebalanceConfig],
  )

  const handleSlippageChange = useCallback(
    (value: number | null) => {
      if (value !== null && value >= 0) {
        updateRebalanceConfig({ slippage: value })
      }
    },
    [updateRebalanceConfig],
  )

  const handleReset = useCallback(() => {
    resetToDefaults()
    message.success('已恢复默认设置')
  }, [resetToDefaults])

  const [testingTelegram, setTestingTelegram] = useState(false)

  const handleTelegramToggle = useCallback(
    (checked: boolean) => {
      updateAppConfig({ telegramEnabled: checked })
    },
    [updateAppConfig],
  )

  const handleTelegramTokenChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAppConfig({ telegramBotToken: e.target.value.trim() })
    },
    [updateAppConfig],
  )

  const handleTelegramChatIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAppConfig({ telegramChatId: e.target.value.trim() })
    },
    [updateAppConfig],
  )

  const handleTelegramIntervalChange = useCallback(
    (value: number | null) => {
      if (value !== null && value >= 1) {
        updateAppConfig({ telegramCheckInterval: value })
      }
    },
    [updateAppConfig],
  )

  const handleTestTelegram = useCallback(async () => {
    const { telegramBotToken, telegramChatId } = appConfig
    if (!telegramBotToken || !telegramChatId) {
      message.warning('请先填写 Bot Token 和 Chat ID')
      return
    }
    setTestingTelegram(true)
    const ok = await sendTelegramNotification(telegramBotToken, telegramChatId, buildTestMessage())
    setTestingTelegram(false)
    if (ok) {
      message.success('测试通知已发送，请检查 Telegram')
    } else {
      message.error('发送失败，请检查 Bot Token 和 Chat ID')
    }
  }, [appConfig.telegramBotToken, appConfig.telegramChatId])

  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const handleBackup = useCallback(async () => {
    setBackingUp(true)
    try {
      const data = await exportAllToJson()
      const ok = await saveToFile(data)
      if (ok) {
        message.success('备份成功')
      } else {
        message.warning('备份已取消或不支持文件选择，数据已导出为下载')
      }
    } catch (e) {
      message.error('备份失败: ' + String(e))
    } finally {
      setBackingUp(false)
    }
  }, [])

  const handleRestore = useCallback(async () => {
    setRestoring(true)
    try {
      const data = await loadFromFile()
      if (!data) {
        message.warning('未选择文件')
        return
      }
      if (!data.version) {
        message.error('无效的备份文件')
        return
      }
      await importFromData(data)
      await loadHoldings()
      await loadTransactions()
      await loadSnapshots()
      // 刷新页面以重新加载配置
      window.location.reload()
    } catch (e) {
      message.error('恢复失败: ' + String(e))
      setRestoring(false)
    }
  }, [loadHoldings, loadTransactions, loadSnapshots])

  // 自动备份：监听 portfolioStore 数据变更
  const backupHandleRef = useRef<FileSystemFileHandle | null>(null)
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)

  const handleAutoBackupToggle = useCallback(
    (checked: boolean) => {
      setAutoBackupEnabled(checked)
      if (!checked) {
        backupHandleRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    if (!autoBackupEnabled) return

    let active = true

    const doAutoBackup = async () => {
      if (!active) return
      try {
        const data = await exportAllToJson()
        const handle = backupHandleRef.current
        if (handle) {
          await writeToExistingHandle(handle, data)
        }
      } catch {
        // 静默失败
      }
    }

    // 订阅 portfolio store 变更
    const unsub = usePortfolioStore.subscribe(async (state, prevState) => {
      const holdingsChanged = state.holdings !== prevState.holdings
      const txChanged = state.transactions !== prevState.transactions
      if (holdingsChanged || txChanged) {
        await doAutoBackup()
      }
    })

    // 订阅 config store 变更
    const unsubConfig = useConfigStore.subscribe(async (state, prevState) => {
      if (state.appConfig !== prevState.appConfig || state.rebalanceConfig !== prevState.rebalanceConfig) {
        await doAutoBackup()
      }
    })

    return () => {
      active = false
      unsub()
      unsubConfig()
    }
  }, [autoBackupEnabled])

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>设置</Title>

      {/* Base Currency */}
      <Card title="基准货币" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="基准货币">
            <Select
              value={appConfig.baseCurrency}
              onChange={handleCurrencyChange}
              style={{ maxWidth: 200 }}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <Select.Option key={c} value={c}>
                  {c}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Card>

      {/* API Keys */}
      <Card
        title={
          <Space>
            <KeyOutlined />
            API 密钥
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Form layout="vertical">
          <Form.Item
            label="Financial Modeling Prep (FMP) API Key"
            extra={
              <span>
                用于获取实时股票行情数据。
                请在 <a href="https://financialmodelingprep.com/developer/docs" target="_blank" rel="noopener noreferrer">FMP 官网</a> 注册获取免费 API Key。
              </span>
            }
          >
            <Input.Password
              value={appConfig.apiKeys?.fmp ?? ''}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="请输入 FMP API Key"
              style={{ maxWidth: 400 }}
            />
          </Form.Item>
        </Form>
      </Card>

      {/* Telegram Notifications */}
      <Card title="Telegram 通知" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="启用通知">
            <Switch
              checked={appConfig.telegramEnabled}
              onChange={handleTelegramToggle}
            />
          </Form.Item>
          <Form.Item
            label="Bot Token"
            extra="通过 @BotFather 创建机器人后获取"
          >
            <Input.Password
              value={appConfig.telegramBotToken}
              onChange={handleTelegramTokenChange}
              placeholder="123456:ABC-DEF..."
              style={{ maxWidth: 400 }}
            />
          </Form.Item>
          <Form.Item
            label="Chat ID"
            extra="向机器人发送 /start 后，通过 api.telegram.org/bot{token}/getUpdates 获取"
          >
            <Input
              value={appConfig.telegramChatId}
              onChange={handleTelegramChatIdChange}
              placeholder="123456789"
              style={{ maxWidth: 200 }}
            />
          </Form.Item>
          <Form.Item label="检查间隔">
            <InputNumber
              value={appConfig.telegramCheckInterval}
              onChange={handleTelegramIntervalChange}
              min={1}
              max={1440}
              style={{ width: 120 }}
              addonAfter="分钟"
            />
          </Form.Item>
          <Form.Item>
            <Button
              icon={<SendOutlined />}
              onClick={handleTestTelegram}
              loading={testingTelegram}
            >
              发送测试通知
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Data Backup */}
      <Card title="数据备份" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item
            extra="备份包含持仓、交易记录、快照和所有配置，保存为本地 JSON 文件"
          >
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleBackup}
                loading={backingUp}
              >
                备份到文件
              </Button>
              <Popconfirm
                title="确认恢复数据？"
                description="恢复操作将覆盖当前所有数据（持仓、交易记录、快照和配置）。"
                onConfirm={handleRestore}
                okText="确认恢复"
                cancelText="取消"
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={restoring}
                  danger
                >
                  从文件恢复
                </Button>
              </Popconfirm>
            </Space>
          </Form.Item>
          <Form.Item label="自动备份">
            <Space align="center">
              <Switch checked={autoBackupEnabled} onChange={handleAutoBackupToggle} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {autoBackupEnabled ? '已启用' : '未启用'}
              </Text>
              {autoBackupEnabled && (
                <Button
                  size="small"
                  onClick={async () => {
                    const handle = await requestBackupFileHandle()
                    if (handle) {
                      backupHandleRef.current = handle
                      message.success('已选择备份文件')
                    }
                  }}
                >
                  选择文件位置
                </Button>
              )}
            </Space>
            {autoBackupEnabled && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                开启后，持仓或配置变更时自动写入备份文件（需先选择文件位置，文件句柄仅在当前浏览器会话内有效）
              </Text>
            )}
          </Form.Item>
        </Form>
      </Card>

      {/* Quote Refresh Interval */}
      <Card title="行情刷新" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="行情刷新间隔 (分钟)">
            <InputNumber
              value={appConfig.quoteRefreshInterval}
              onChange={handleRefreshIntervalChange}
              min={1}
              max={60}
              style={{ width: 120 }}
              addonAfter="分钟"
            />
          </Form.Item>
        </Form>
      </Card>

      {/* Target Weights */}
      <Card title="目标权重" style={{ marginBottom: 16 }}>
        {totalWeight !== 1 && (
          <Alert
            type="warning"
            showIcon
            message={`目标权重总和为 ${Math.round(totalWeight * 100)}%，应为 100%`}
            style={{ marginBottom: 16 }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {CATEGORIES.map((cat) => (
            <div key={cat}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text>{CATEGORY_LABELS[cat]}</Text>
                <Text strong>{Math.round((rebalanceConfig.targets[cat] ?? 0) * 100)}%</Text>
              </div>
              <Slider
                value={Math.round((rebalanceConfig.targets[cat] ?? 0) * 100)}
                onChange={(val) => handleTargetWeightChange(cat, val / 100)}
                min={0}
                max={100}
                step={1}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Rebalance Bands */}
      <Card title="再平衡带宽" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="预设方案">
            <Select
              value={rebalanceConfig.bandPreset}
              onChange={handlePresetChange}
              style={{ maxWidth: 300 }}
            >
              {(Object.keys(BAND_PRESET_LABELS) as BandPreset[]).map((preset) => (
                <Select.Option key={preset} value={preset}>
                  {BAND_PRESET_LABELS[preset]}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="自定义带宽">
            <Space>
              <InputNumber
                value={Math.round(rebalanceConfig.bands.low * 100)}
                onChange={(v) => handleBandLowChange(v !== null ? v / 100 : null)}
                min={0}
                max={100}
                step={1}
                style={{ width: 100 }}
                addonAfter="%"
                placeholder="下限"
              />
              <span>-</span>
              <InputNumber
                value={Math.round(rebalanceConfig.bands.high * 100)}
                onChange={(v) => handleBandHighChange(v !== null ? v / 100 : null)}
                min={0}
                max={100}
                step={1}
                style={{ width: 100 }}
                addonAfter="%"
                placeholder="上限"
              />
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* Trading Parameters */}
      <Card title="交易参数" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="最小交易金额">
            <InputNumber
              value={rebalanceConfig.minTradeAmount}
              onChange={handleMinTradeAmountChange}
              min={0}
              step={10}
              style={{ width: 200 }}
              addonBefore="$"
            />
          </Form.Item>
          <Form.Item label="手续费率 (%)">
            <InputNumber
              value={rebalanceConfig.feeRate * 100}
              onChange={(v) => handleFeeRateChange(v !== null ? v / 100 : null)}
              min={0}
              max={100}
              step={0.01}
              precision={3}
              style={{ width: 200 }}
              addonAfter="%"
            />
          </Form.Item>
          <Form.Item label="滑点 (%)">
            <InputNumber
              value={rebalanceConfig.slippage * 100}
              onChange={(v) => handleSlippageChange(v !== null ? v / 100 : null)}
              min={0}
              max={100}
              step={0.01}
              precision={3}
              style={{ width: 200 }}
              addonAfter="%"
            />
          </Form.Item>
        </Form>
      </Card>

      {/* Reset */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Popconfirm
            title="确认恢复默认设置？"
            description="这将重置所有设置到默认值。"
            onConfirm={handleReset}
            okText="确认"
            cancelText="取消"
          >
            <Button icon={<UndoOutlined />} danger>
              恢复默认设置
            </Button>
          </Popconfirm>
        </Space>
      </Card>

      {/* Disclaimer */}
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        message="风险免责声明"
        description="PermPort 仅提供投资组合管理工具功能，不构成任何投资建议。投资有风险，过往表现不代表未来收益。请根据自身风险承受能力做出投资决策。哈利·布朗永久组合策略的回测表现不代表实际投资收益。使用本工具产生的任何投资决策由用户自行承担风险。"
        style={{ marginBottom: 16 }}
      />
    </div>
  )
}
