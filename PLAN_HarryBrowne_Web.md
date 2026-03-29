# 哈利·布朗永久组合管理器：产品与技术实施计划

## 产品定位

**名称**: Permanent Portfolio Manager (PermPort)
**定位**: 开源的哈利·布朗永久组合投资管理工具
**用户**: 全球 HB 策略投资者（无地区偏见，用户自定义标的、币种和基准货币）
**核心价值**: 简单录入 → 自动追踪 → 智能再平衡建议 → 收益可视化

## 范围与目标

- 覆盖四类资产：股票、长期国债、黄金、现金/短债，**默认**目标权重各 25%（可配置）
- 支持手动录入持仓：买入价、数量、买入日期、币种、费用与备注
- 自动获取现价与汇率，计算市值与各类权重
- 基于可配置带宽（15/35、20/30、25±5）与年度校准生成再平衡提醒
- 纯前端应用，数据本地存储，离线可用
- 追踪组合收益（总收益、年化、最大回撤）

## 主要用户故事

### 基础管理
- 我可以录入多只资产并选择资产类别与币种
- 我可以在仪表盘查看总市值、四类占比与是否触发再平衡
- 我可以查看组合的累计收益率、年化收益率和最大回撤

### 行情与追踪
- 系统定期拉取价格并自动更新持仓市值
- 触发带宽阈值时高亮提醒

### 再平衡
- 系统提供可执行的买卖建议（考虑费用、最小交易额、滑点）
- 我可以微调建议参数并预览执行后的权重分布
- 我可以记录再平衡操作并追踪历史

### 配置与数据
- 我可以自定义带宽阈值、目标权重、费用参数
- 我可以导出/导入持仓数据（CSV）
- 我可以查看组合净值历史曲线

## 投资组合规则

### 目标配置
- 默认：四类各 25%
- 可配置：用户可自定义各类目标权重（如 30/20/25/25）
- 约束：四类权重之和必须为 100%

### 再平衡触发
- **带宽触发**: 任一类别权重超出带宽范围
- **年度触发**: 距上次再平衡/年度校准超过设定周期（默认 365 天）
- 年度校准日期由 `annualReviewDate` 配置（默认取首次投入日）

### 预设带宽选项
| 预设 | 下限 | 上限 | 说明 |
|------|------|------|------|
| 保守 | 15% | 35% | 经典 HB 建议，触发频率低 |
| 中等 | 20% | 30% | 平衡型，适度再平衡 |
| 积极 | 20% | 30% | 以目标权重 ±5% 为带宽 |

### 归类策略
- 同一类别可包含多个标的，按类别层面计算权重与生成建议
- 每个标的必须归属于四个类别之一

### 执行约束
- 最小成交额（低于此金额的交易被合并或忽略并提示）
- 费用率（按交易金额百分比计算）
- 滑点（预估买卖价差）
- 税费参数（可选）

### 再平衡执行顺序
1. 先计算各类别的超配/欠配金额
2. 优先卖出超配类别（释放资金）
3. 用所得资金买入欠配类别
4. 类内分配优先选择流动性高/费用低的标的
5. 检查所有建议是否满足最小成交额约束，不满足的合并或跳过

## 技术选型

### 前端
- **框架**: React 18+ + TypeScript 5+
- **构建**: Vite 6+
- **状态管理**: Zustand（轻量、简洁、TypeScript 友好）
- **UI 组件**: Ant Design 5+（中文生态好、表格/表单组件完善）
- **表单**: React Hook Form + Zod 验证
- **图表**: Recharts（轻量、React 原生）

### 样式
- CSS Modules 或 Emotion（组件级样式隔离）
- Ant Design Token 系统实现主题定制
- 响应式布局（移动端适配）

### 数据持久化
- **主存储**: IndexedDB（via Dexie.js，支持版本迁移）
- **配置**: localStorage（用户偏好、API Key）
- **导入导出**: CSV + JSON 备份

### 行情数据（纯前端直连）
- **首选**: Yahoo Finance 非官方端点（免费、无密钥、数据全）
- **备选 A**: Alpha Vantage（免费版 25 次/天，需 API Key）
- **备选 B**: Twelve Data（免费 800 次/天，需 API Key）
- **汇率**: ExchangeRate.host（免费，无密钥）或 Yahoo Finance 汇率
- **策略**: 优先无密钥源，失败自动回退，用户可配置 API Key 启用备选源

### 开发工具
- **代码质量**: ESLint + Prettier
- **类型检查**: TypeScript strict mode
- **测试**: Vitest（单元）+ Testing Library（组件）+ Playwright（E2E）
- **包管理**: pnpm

## 系统架构

### 整体架构（纯前端 SPA）

```
┌─────────────────────────────────────────────────────┐
│                    Browser (SPA)                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Pages    │  │  Stores  │  │  Services        │  │
│  │  (React)  │  │ (Zustand)│  │  ┌────────────┐  │  │
│  │           │  │          │  │  │ QuoteService│  │  │
│  │ Dashboard │  │ portfolio│  │  │ FxService   │  │  │
│  │ Holdings  │  │ quote    │  │  │ CalcService  │  │  │
│  │ Rebalance │  │ config   │  │  └────────────┘  │  │
│  │ Settings  │  │ history  │  │                   │  │
│  │ History   │  │          │  │                   │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │           Dexie.js (IndexedDB)               │   │
│  │  holdings | transactions | snapshots | configs│   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         External APIs (direct fetch)          │   │
│  │  Yahoo Finance | Alpha Vantage | Twelve Data  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 模块划分
```
src/
├── pages/                    # 页面组件
│   ├── Dashboard/            # 仪表盘
│   ├── Holdings/             # 持仓管理
│   ├── Rebalance/            # 再平衡
│   ├── History/              # 历史记录
│   └── Settings/             # 设置
├── stores/                   # Zustand stores
│   ├── portfolioStore.ts     # 持仓与组合状态
│   ├── quoteStore.ts         # 行情数据
│   └── configStore.ts        # 用户配置
├── services/                 # 业务逻辑
│   ├── quoteService.ts       # 行情获取与缓存
│   ├── fxService.ts          # 汇率获取
│   ├── calcService.ts        # 权重/再平衡计算
│   ├── historyService.ts     # 收益计算
│   └── exportService.ts      # 导入导出
├── db/                       # IndexedDB (Dexie)
│   ├── index.ts              # 数据库定义与版本迁移
│   └── migrations/           # Schema 迁移脚本
├── types/                    # TypeScript 类型定义
│   ├── portfolio.ts          # 组合相关类型
│   ├── quote.ts              # 行情相关类型
│   └── config.ts             # 配置相关类型
├── components/               # 通用组件
│   ├── charts/               # 图表组件
│   ├── tables/               # 表格组件
│   └── forms/                # 表单组件
└── utils/                    # 工具函数
    ├── formatters.ts         # 格式化（金额、百分比）
    └── validators.ts         # 校验函数
```

## 数据模型

### 核心模型

```typescript
// 资产类别枚举
enum Category {
  STOCKS = 'STOCKS',
  LONG_BONDS = 'LONG_BONDS',
  GOLD = 'GOLD',
  CASH = 'CASH',
}

// 持仓
interface AssetHolding {
  id: string;
  name: string;            // 如 "SPDR S&P 500 ETF"
  ticker: string;          // 如 "SPY"
  category: Category;
  currency: string;        // ISO 4217，如 "USD"
  buyPrice: number;        // 买入单价（原币）
  quantity: number;        // 持有数量
  fee: number;             // 买入时费用
  buyDate: string;         // ISO 日期
  notes: string;           // 备注
  createdAt: string;       // 创建时间
  updatedAt: string;       // 更新时间
}

// 交易记录（新增）
interface Transaction {
  id: string;
  holdingId: string;       // 关联持仓
  type: 'BUY' | 'SELL' | 'REBALANCE_IN' | 'REBALANCE_OUT' | 'DIVIDEND';
  date: string;            // ISO 日期
  quantity: number;        // 交易数量
  price: number;           // 交易单价（原币）
  fee: number;             // 交易费用
  totalAmount: number;     // 交易总额（原币）
  notes: string;           // 备注
  createdAt: string;
}

// 行情快照
interface Quote {
  ticker: string;
  price: number;
  currency: string;
  change: number;          // 涨跌额
  changePercent: number;   // 涨跌幅
  asOf: string;            // 数据时间戳
  source: string;          // 数据源标识
}

// 汇率
interface FxRate {
  base: string;            // 基准货币
  quote: string;           // 目标货币
  rate: number;
  asOf: string;
  source: string;
}
```

### 组合快照（用于收益追踪）

```typescript
interface PortfolioSnapshot {
  id: string;
  timestamp: string;       // 快照时间
  trigger: 'DAILY' | 'TRADE' | 'REBALANCE' | 'MANUAL';  // 触发方式
  totalValue: number;      // 组合总值（基准货币）
  baseCurrency: string;    // 基准货币
  categoryWeights: Record<Category, number>;  // 各类权重
  holdings: {
    holdingId: string;
    marketValue: number;   // 市值（基准货币）
    weight: number;        // 占比
  }[];
  fxRates: Record<string, number>;  // 涉及的汇率
}
```

快照触发时机：
- 每日收盘后自动（如果有行情数据）
- 每次交易操作后
- 每次再平衡后
- 用户手动触发

### 配置模型

```typescript
// 再平衡配置
interface RebalanceConfig {
  // 目标权重（可配置，不硬编码 25%）
  targets: Record<Category, number>;  // 默认 { STOCKS: 0.25, LONG_BONDS: 0.25, GOLD: 0.25, CASH: 0.25 }

  // 带宽设置
  bandPreset: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'CUSTOM';
  bands: {
    low: number;           // 默认 0.15
    high: number;          // 默认 0.35
  };

  // 年度校准
  annualReviewDate: string;  // 年度校准日期（MM-DD 格式，默认取首次投入日）

  // 执行约束
  minTradeAmount: number;  // 最小成交额（基准货币）
  feeRate: number;         // 交易费用率
  slippage: number;        // 滑点（百分比）
  taxRate: number;         // 税率（可选，0 表示不计算）
}

// 应用配置
interface AppConfig {
  baseCurrency: string;         // 基准货币（如 "USD"、"CNY"）
  quoteRefreshInterval: number; // 行情刷新间隔（分钟）
  priceBasis: 'REALTIME' | 'CLOSE';  // 价格基准
  apiKeys: Record<string, string>;    // 各行情源 API Key（加密存储）
  defaultTickers: Record<Category, string[]>;  // 各类别默认标的
}
```

### 再平衡建议

```typescript
interface RebalancePlan {
  id: string;
  generatedAt: string;
  triggerReason: 'BAND_BREACH' | 'ANNUAL_REVIEW' | 'MANUAL';
  triggerDetails: string;       // 触发原因描述
  currentWeights: Record<Category, number>;
  targetWeights: Record<Category, number>;
  trades: RebalanceTrade[];
  postWeights: Record<Category, number>;  // 预估执行后权重
  totalEstimatedFee: number;
  warnings: string[];           // 如不满足最小成交额等
}

interface RebalanceTrade {
  category: Category;
  holdingId?: string;           // 指定标的（可选，自动选择时为空）
  ticker: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  estimatedPrice: number;
  estimatedAmount: number;      // 估计金额（基准货币）
  estimatedFee: number;
  priority: number;             // 执行优先级（1 = 最高）
}
```

## 行情与汇率数据

### 数据源策略

| 优先级 | 数据源 | 密钥 | 免费额度 | 说明 |
|--------|--------|------|----------|------|
| 1 | Yahoo Finance（非官方） | 不需要 | 无限制 | 首选，数据全但可能变动 |
| 2 | Twelve Data | 需要 | 800 次/天 | 备选，API 稳定 |
| 3 | Alpha Vantage | 需要 | 25 次/天 | 最后备选，额度有限 |

| 优先级 | 汇率源 | 密钥 | 说明 |
|--------|--------|------|------|
| 1 | Yahoo Finance | 不需要 | 与行情同源 |
| 2 | ExchangeRate.host | 不需要 | 免费汇率 API |

### 获取策略
- 自动轮询：默认 15 分钟（可配置 5–60 分钟）
- 防抖：页面切换/聚焦时才触发
- 缓存：前端内存缓存（TTL 与轮询间隔一致）+ IndexedDB 持久化
- 失败回退：主源失败 → 尝试备选源 → 使用最后有效价格 → 标记"数据延迟"
- 限流处理：指数退避（1s → 2s → 4s → 最多 30s）
- 离线降级：无网络时使用缓存数据，UI 标记离线状态

### 价格基准
- 可切换"盘中延迟价"与"收盘价"
- 市场休市时自动使用收盘价并说明

## 核心计算

### 市值计算
```
positionValue = quantity × currentPrice × fxRate(toBaseCurrency)
categoryValue = Σ(positionValue) for holdings in category
totalValue = Σ(categoryValue)
weight = categoryValue / totalValue
```

### 再平衡触发判定
```
triggered = any(categoryWeight < bandLow OR categoryWeight > bandHigh)
OR daysSinceLastRebalance >= annualReviewDays
```

### 交易建议生成
```
targetValue(cat) = totalValue × targetWeight(cat)
delta(cat) = targetValue(cat) - categoryValue(cat)
// 正值 → 买入，负值 → 卖出

执行顺序：
1. 按绝对值排序（先处理最大偏离）
2. 卖出超配类别（side=SELL，priority 高优先）
3. 买入欠配类别（side=BUY）
4. 类内分配：按用户设定的优先级或流动性排序

费用与约束：
estimatedFee = tradeAmount × feeRate
estimatedSlippage = tradeAmount × slippage
跳过: if tradeAmount < minTradeAmount → 标记 warning
```

### 收益计算
```
// 总收益率
totalReturn = (currentTotalValue - totalInvested) / totalInvested

// 年化收益率 (CAGR)
cagr = (endValue / startValue) ^ (365 / days) - 1

// 最大回撤
maxDrawdown = max(1 - currentValue / peakValue) over all snapshots

// 夏普比率（简化，无风险利率默认 0）
sharpe = (annualReturn - riskFreeRate) / annualizedVolatility
```

## 界面与交互

### 页面结构

```
┌──────────────────────────────────────────────────┐
│  Header: Logo + Navigation + Settings Icon       │
├──────────────────────────────────────────────────┤
│                                                   │
│  Sidebar          Main Content Area               │
│  ┌─────────┐     ┌─────────────────────────┐     │
│  │ Dashboard│     │                         │     │
│  │ Holdings │     │     (Page Content)      │     │
│  │ Rebalance│     │                         │     │
│  │ History  │     │                         │     │
│  │ Settings │     └─────────────────────────┘     │
│  └─────────┘                                      │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Dashboard（仪表盘）
- 组合总市值（基准货币）+ 总收益率
- 四类资产占比饼图（超配红色、欠配蓝色、正常绿色）
- 带宽位置可视化（各类当前权重在带宽中的位置）
- 净值曲线（时间轴可缩放）
- 最近刷新时间 + 数据状态标识
- 再平衡状态指示（正常 / 即将触发 / 已触发）

### Holdings（持仓管理）
- 持仓列表表格：名称、Ticker、类别、数量、买入价、现价、市值、盈亏
- 新增/编辑/删除持仓（抽屉式表单）
- 按类别分组显示，支持排序和筛选
- 每行显示原币和基准货币双金额
- 交易记录查看（持仓维度）

### Rebalance（再平衡）
- 当前触发状态与原因说明
- 交易建议列表（可排序、可编辑数量）
- 执行后权重预览图（对比当前 vs 目标 vs 执行后）
- 参数微调面板（费用、滑点、最小交易额）
- 确认执行按钮（记录交易并更新持仓）
- 免责声明（每次生成建议时显示）

### History（历史记录）
- 净值曲线图（可叠加各类别曲线）
- 收益指标卡片：总收益、年化、最大回撤、夏普比率
- 交易历史时间线
- 组合快照浏览

### Settings（设置）
- 基准货币选择
- 目标权重配置（四类滑块，总和 100%）
- 带宽预设选择或自定义
- 年度校准日期设置
- 行情源配置（选择数据源、填入 API Key）
- 刷新频率设置
- 费用与约束参数
- CSV 导入/导出
- JSON 备份/恢复
- 风险免责声明

### 响应式设计
- 桌面：侧边栏 + 主内容区
- 平板：折叠侧边栏 + 主内容区
- 手机：底部导航 + 全屏内容区

## 异常与边界处理

### 行情异常
| 场景 | 处理 |
|------|------|
| 行情缺失 | 使用最后一次有效价格，UI 标记"数据延迟" |
| API 限流 | 指数退避重试，超过 3 次切换备选源 |
| 所有源不可用 | 使用缓存数据，显示"离线模式"标识 |
| 市场休市 | 使用收盘价，标注"休市中" |
| Ticker 无效 | 录入时校验，提示用户确认 |

### 数据边界
| 场景 | 处理 |
|------|------|
| 空组合 | 显示引导页面，推荐默认标的 |
| 单一资产 | 正常计算，提示分散风险 |
| 超小额交易 | 合并同类建议，低于最小额则跳过并提示 |
| 精度 | 金额 2 位小数，数量按标的最小单位 |
| 汇率不可用 | 使用上次汇率或暂停跨币种建议 |

### 数据安全
- API Key 使用浏览器原生的加密存储或简单混淆（非真正加密，纯前端无法做到绝对安全）
- 提醒用户：API Key 存在本地浏览器中
- 导出备份时可选择是否包含 API Key

## 安全与隐私

- 默认仅本地存储（IndexedDB），数据不离开用户浏览器
- 不上传任何持仓信息到第三方服务
- 明示风险免责声明：
  - 本工具仅提供信息参考，不构成投资建议
  - 不提供交易执行功能
  - 数据可能有延迟，投资决策请咨询专业人士
  - 每次生成再平衡建议时均附带免责声明
- CSV/JSON 导出数据由用户完全控制

## 测试计划

### 单元测试（Vitest）
- 权重计算（正常、边界、精度）
- 再平衡触发判定（各类带宽、年度触发）
- 交易建议生成（费用计算、最小额约束、执行顺序）
- 收益计算（总收益、年化、最大回撤）
- 汇率转换（多币种、精度）
- 目标覆盖率: ≥ 80%

### 集成测试（Testing Library）
- 行情获取与缓存（模拟 API 响应）
- 数据源回退逻辑
- IndexedDB 读写与迁移
- 表单提交流程

### E2E 测试（Playwright）
- 完整流程：录入 → 行情更新 → 触发判定 → 生成建议 → 执行
- 导入导出数据一致性
- 多币种场景

### 回测用例
- 构造历史快照验证带宽触发一致性
- 验证年度校准逻辑
- 验证费用计算准确性

## 部署与发布

### 部署方式
- **推荐**: GitHub Pages（免费、与开源项目集成好）
- **备选**: Vercel / Netlify（自动部署、CDN）
- 纯静态站点，无需服务器

### CI/CD
- GitHub Actions：PR 检查（lint + type check + test）
- 自动部署：main 分支推送后自动构建部署
- Release：GitHub Releases + CHANGELOG

### 监控
- 错误上报：Sentry（开源项目免费额度）
- 性能：Web Vitals 监控
- 用户反馈：GitHub Issues

## 里程碑

### M1: 核心功能（行情 + 计算 + 仪表盘）
**目标**: 用户可以录入持仓、看到实时权重、判断是否需要再平衡

功能清单：
- [ ] 项目初始化（Vite + React + TS + Zustand + Ant Design）
- [ ] IndexedDB 数据层（Dexie.js）
- [ ] 持仓 CRUD（录入/编辑/删除）
- [ ] 行情接入（Yahoo Finance 非官方端点）
- [ ] 汇率接入
- [ ] 权重计算与带宽判定
- [ ] 仪表盘页面（总市值、饼图、带宽可视化）
- [ ] 基础设置（基准货币、数据源配置）
- [ ] 响应式布局骨架

### M2: 再平衡 + 收益追踪
**目标**: 用户可以生成再平衡建议、追踪组合收益

功能清单：
- [ ] 再平衡建议生成（含执行顺序、费用计算）
- [ ] 再平衡页面（建议列表、预览图、参数微调）
- [ ] 执行确认（记录交易、更新持仓）
- [ ] 交易记录模型与页面
- [ ] 组合快照自动记录
- [ ] 收益计算（总收益、年化、最大回撤）
- [ ] 历史页面（净值曲线、收益指标、交易时间线）
- [ ] 带宽预设选择（保守/中等/积极）
- [ ] 目标权重可配置
- [ ] 年度校准日期设置

### M3: 数据管理与通知
**目标**: 完善数据导入导出、通知推送

功能清单：
- [ ] CSV 导入/导出
- [ ] JSON 备份/恢复
- [ ] 浏览器通知（带宽触发时）
- [ ] 组合净值历史图表（可缩放时间轴）
- [ ] 类别级别收益对比图
- [ ] 默认标的预设模板（按地区）
- [ ] 免责声明组件

### M4: 高级功能
**目标**: 云同步、多组合、国际化

功能清单：
- [ ] PWA 离线支持（Service Worker）
- [ ] 多组合管理（如不同账户的 HB 组合）
- [ ] 云同步（Supabase，可选）
- [ ] 国际化 i18n（中/英/日等）
- [ ] 暗色主题
- [ ] 股息/利息收入记录与再投资追踪
- [ ] 打包为桌面应用（Tauri / Electron，可选）

## 成功指标

| 指标 | 目标 |
|------|------|
| 计算正确性 | 回测用例再平衡判定一致率 ≥ 99% |
| 首屏加载 | 核心页面 < 2s（缓存命中时） |
| 行情可用性 | 调用成功率 ≥ 95%（含回退） |
| 建议可执行性 | 建议满足最小交易额/费用约束 |
| 测试覆盖 | 核心计算逻辑 ≥ 90% |
| 可访问性 | Lighthouse Accessibility ≥ 90 |

## 风险与对策

| 风险 | 概率 | 对策 |
|------|------|------|
| Yahoo 非官方 API 变动 | 高 | 多源备选 + 社区快速响应 + 抽象数据源层 |
| 免费额度用尽 | 中 | 主用无密钥源 + 用户可配置付费 Key |
| 多币种精度误差 | 低 | 统一以基准货币计算，显示汇率来源与时间戳 |
| 离线数据丢失 | 低 | 提醒定期备份 + 自动 localStorage 副本 |
| 监管合规 | 低 | 仅信息工具，不执行交易，每次建议附免责声明 |

## 默认标的预设（用户可完全自定义）

| 类别 | 全球通用 | 美国市场 | 中国市场 |
|------|----------|----------|----------|
| 股票 | VT (全球股票) | SPY (S&P 500) | 510300 (沪深300ETF) |
| 长债 | IGOV (全球债) | TLT (20年美债) | 511260 (十年国债ETF) |
| 黄金 | GLD / IAU | GLD | 518880 (黄金ETF) |
| 现金 | BIL | BIL / SHV | 511880 (银华日利) |

> 注：预设仅为示例，用户应根据自己的市场和投资环境选择合适标的。

## 下一步

1. 初始化项目（Vite + React + TS + pnpm）
2. 搭建基础骨架（路由、布局、IndexedDB）
3. 实现 M1 核心功能
4. 发布 v0.1.0 alpha 到 GitHub
