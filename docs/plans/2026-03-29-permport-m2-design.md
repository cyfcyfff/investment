# PermPort M2 Design: 再平衡建议 + 收益追踪

**Goal:** 用户可以生成再平衡建议（建议模式，不自动执行）、追踪组合收益（净值曲线 + 指标 + 交易记录）

**Approach:** 自底向上 — 先引擎后 UI，核心逻辑独立测试

---

## 1. 新增类型定义

在 `src/types/portfolio.ts` 中新增：

```typescript
// 再平衡建议
interface RebalancePlan {
  id: string
  generatedAt: string
  triggerReason: 'BAND_BREACH' | 'ANNUAL_REVIEW' | 'MANUAL'
  triggerDetails: string
  currentWeights: Record<Category, number>
  targetWeights: Record<Category, number>
  trades: RebalanceTrade[]
  postWeights: Record<Category, number>  // 预估执行后权重
  totalEstimatedFee: number
  warnings: string[]
}

interface RebalanceTrade {
  category: Category
  holdingId: string
  ticker: string
  side: 'BUY' | 'SELL'
  quantity: number
  estimatedPrice: number
  estimatedAmount: number  // 基准货币
  estimatedFee: number
  priority: number  // 1=最高
}

// 收益指标
interface PerformanceMetrics {
  totalReturn: number       // 总收益率
  totalReturnAmount: number // 总收益金额
  cagr: number              // 年化收益率
  maxDrawdown: number       // 最大回撤
  maxDrawdownDate: string   // 最大回撤发生日期
  currentDrawdown: number   // 当前回撤
  peakValue: number         // 历史峰值
  peakDate: string          // 峰值日期
  daysSincePeak: number
  snapshotsCount: number
  firstSnapshotDate: string
  lastSnapshotDate: string
}
```

---

## 2. 再平衡建议引擎

新建 `src/services/rebalanceService.ts`

### 核心函数: `generateRebalancePlan()`

```
输入: holdings, prices, fxRates, rebalanceConfig, baseCurrency
输出: RebalancePlan

算法:
1. 计算当前各类权重（复用 calculateCategoryWeights）
2. 判断是否触发再平衡（复用 isRebalanceTriggered）
3. 计算每类目标金额 vs 当前金额的差额 delta
4. 按偏离绝对值排序
5. 先生成 SELL trades（超配类别，释放资金）
6. 再生成 BUY trades（欠配类别，消耗资金）
7. 类内分配：按持仓市值比例分配
8. 费用计算: tradeAmount × feeRate
9. 滑点估算: tradeAmount × slippage
10. 检查最小成交额约束，不满足的标记 warning
11. 计算预估执行后权重 postWeights
```

### 执行顺序

- 超配类别 → SELL（priority 1, 2, ...）
- 欠配类别 → BUY（priority 紧接 SELL 之后）
- 卖出释放的资金优先用于买入，保证资金守恒

### 关键约束

- **建议模式**: 不自动修改持仓数量
- **资金守恒**: SELL 总额 ≈ BUY 总额（扣除费用）
- **最小成交额**: 低于 minTradeAmount 的 trade 标记 warning 但仍列出
- **类内分配**: 同类别多标的按市值比例分配

---

## 3. 快照服务

新建 `src/services/snapshotService.ts`

### 懒快照策略

```
ensureDailySnapshot(holdings, quotes, fxRates, config)
  → 查询 IndexedDB: 今天（北京时间）是否已有 snapshot?
  → 若无: 创建新 snapshot，trigger='DAILY'
  → 若有: 跳过
```

### 事件快照

```
createSnapshot(holdings, quotes, fxRates, config, trigger)
  → 用户手动触发或再平衡执行时调用
  → trigger: 'MANUAL' | 'REBALANCE' | 'TRADE'
```

### 时区

以北京时间为准（UTC+8），使用 `dayjs` utc offset 判断"今天"。

---

## 4. 收益计算

新建 `src/services/performanceService.ts`

```
calculatePerformance(snapshots: PortfolioSnapshot[]): PerformanceMetrics

总收益率 = (最新总市值 - 首次总市值) / 首次总市值
CAGR = (endValue / startValue) ^ (365 / days) - 1
最大回撤 = max(1 - value / peakValue) 遍历所有快照
当前回撤 = 1 - currentValue / peakValue
```

快照不足 2 个时返回零值指标，History 页面显示"数据不足"。

---

## 5. Store 增强

### portfolioStore.ts 新增

- `loadSnapshots()` — 从 IndexedDB 加载快照列表
- `recordSnapshot(trigger)` — 创建快照并存入 DB
- `ensureDailySnapshot()` — 检查并创建每日快照
- `loadTransactions()` — 从 IndexedDB 加载交易记录

---

## 6. Rebalance 页面

### 布局

1. **状态区**: 显示当前再平衡状态与触发原因
2. **操作区**: [生成再平衡建议] 按钮
3. **建议列表**: Table（操作、标的、方向、数量、金额、费用）
4. **权重对比图**: 柱状图（当前 vs 目标 vs 执行后）
5. **汇总区**: 预估总费用、警告信息、免责声明
6. **执行录入**: [记录执行结果] → Drawer 表单录入实际交易

### 关键交互

- 点击"生成建议" → 调用 `generateRebalancePlan()`
- 建议列表可排序
- "记录执行结果" → 打开 Drawer，用户录入实际交易
- 录入后自动创建 REBALANCE_IN/REBALANCE_OUT 交易 + 触发快照

---

## 7. History 页面

### 布局

1. **指标卡片**: 总收益、年化 CAGR、最大回撤（3-4 个 Statistic 卡片）
2. **净值曲线**: Recharts AreaChart（X 轴日期，Y 轴总市值）
3. **交易时间线**: Ant Design Timeline（日期 + 类型 + 标的 + 数量 + 金额）

### 数据来源

- 指标卡片: `calculatePerformance(snapshots)`
- 净值曲线: `snapshots` 数据按时间排序
- 交易时间线: `transactions` 按 createdAt 倒序

---

## 8. 新增文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/types/portfolio.ts` | 修改 | 新增 RebalancePlan, RebalanceTrade, PerformanceMetrics |
| `src/services/rebalanceService.ts` | 新建 | 再平衡建议生成算法 |
| `src/services/snapshotService.ts` | 新建 | 快照管理服务 |
| `src/services/performanceService.ts` | 新建 | 收益计算服务 |
| `src/services/__tests__/rebalanceService.test.ts` | 新建 | 再平衡引擎测试 |
| `src/services/__tests__/snapshotService.test.ts` | 新建 | 快照服务测试 |
| `src/services/__tests__/performanceService.test.ts` | 新建 | 收益计算测试 |
| `src/stores/portfolioStore.ts` | 修改 | 新增快照和交易加载方法 |
| `src/pages/Rebalance/index.tsx` | 修改 | 完整再平衡页面 |
| `src/pages/History/index.tsx` | 修改 | 完整历史页面 |
| `src/components/charts/WeightComparisonChart.tsx` | 新建 | 权重对比柱状图 |
| `src/components/charts/NetValueChart.tsx` | 新建 | 净值曲线面积图 |
| `src/components/forms/TradeRecordForm.tsx` | 新建 | 交易录入表单 |
