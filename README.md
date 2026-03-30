# PermPort — 哈利·布朗永久组合管理工具

基于哈利·布朗永久组合（Permanent Portfolio）策略的投资组合管理工具。支持实时行情监控、自动再平衡建议、绩效追踪、Telegram 通知提醒和数据备份恢复。

> **仅供个人投资组合管理参考，不构成任何投资建议。**

## 功能特性

| 模块 | 功能 |
|------|------|
| **仪表盘** | 资产配比饼图、各类权重仪表、组合总市值、涨跌概览 |
| **持仓管理** | 添加/编辑/删除持仓、标的模糊搜索（支持中英文）、同标的持仓合并 |
| **再平衡** | 带宽偏离检测、再平衡方案生成、分配模式选择（等额/按市值/自定义）、批量确认执行 |
| **历史记录** | 交易流水、净值曲线（3小时采样）、绩效指标（CAGR、最大回撤等） |
| **设置** | 基准货币、API 密钥、目标权重/带宽/交易参数、Telegram 通知、数据备份 |

### 四大资产类别

| 类别 | 默认标的 | 说明 |
|------|---------|------|
| 股票 (STOCKS) | VT / QQQ / SPY | 追求增长 |
| 长期国债 (LONG_BONDS) | TLT / EDV / IGOV | 经济衰退对冲 |
| 黄金 (GOLD) | GLD / XAUUSD | 通胀对冲 |
| 现金/短债 (CASH) | BIL | 通缩/流动性对冲 |

## 技术栈

- **前端**: React 19 + TypeScript + Ant Design 6
- **状态管理**: Zustand
- **数据库**: Dexie (IndexedDB)，数据持久化在浏览器本地
- **图表**: Recharts
- **构建**: Vite
- **测试**: Vitest

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build

# 运行测试
npm run test
```

## API 配置

应用使用多个行情数据源，通过 Vite 代理转发请求。**无需配置任何 API Key 即可使用基础功能**（行情数据会通过公开源获取）。

配置 FMP API Key 可获得更稳定的行情数据。

### FMP API Key（可选）

1. 访问 [Financial Modeling Prep](https://financialmodelingprep.com/developer/docs) 注册账号
2. 在 [API Keys](https://site.financialmodelingprep.com/developer/docs#api-key) 页面获取免费 API Key
3. 在应用的 **设置 → API 密钥** 中填入 Key

> 免费版有调用频率限制，建议仅用于个人少量持仓的行情获取。

### 行情数据源优先级

应用按以下优先级获取行情数据，任一源失败会自动切换到下一源：

```
FMP API（需 API Key）→ Yahoo Finance → 腾讯财经（A 股）→ Stooq
```

### 标的搜索

- 搜索使用新浪财经 API，支持中文关键词和股票代码
- 无需额外配置，开箱即用
- 示例：输入 `600900` 搜索长江电力，输入 `AAPL` 搜索苹果，输入 `英伟达` 搜索 NVIDIA

## Telegram 通知配置

应用支持通过 Telegram 机器人推送再平衡提醒。当资产配比偏离目标带宽时，自动发送通知。

### 第一步：创建 Telegram 机器人

1. 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`
3. 按提示输入机器人名称（显示名），例如：`PermPort 通知`
4. 按提示输入机器人用户名，必须以 `bot` 结尾，例如：`permport_notifier_bot`
5. BotFather 会返回一个 **Bot Token**，格式类似：
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
   **保存好这个 Token**

### 第二步：获取 Chat ID

1. 在 Telegram 中搜索你刚创建的机器人并发送 `/start`
2. 在浏览器中访问以下地址（将 `<BOT_TOKEN>` 替换为你的 Token）：
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
   ```
3. 在返回的 JSON 中找到 `"chat":{"id":` 后面的数字，这就是你的 **Chat ID**
4. 例如：
   ```json
   {
     "ok": true,
     "result": [{
       "message": {
         "chat": {
           "id": 123456789,
           "first_name": "Your Name"
         },
         "text": "/start"
       }
     }]
   }
   ```
   **Chat ID 就是 `123456789`**

> 如果 `getUpdates` 返回空结果，尝试先给机器人发一条消息后再刷新。

### 第三步：在应用中配置

1. 打开应用 **设置 → Telegram 通知**
2. 开启 **启用通知** 开关
3. 填入 **Bot Token**（第一步获取的）
4. 填入 **Chat ID**（第二步获取的）
5. 设置 **检查间隔**（分钟），默认 60 分钟
6. 点击 **发送测试通知** 验证配置是否正确

### 通知逻辑

- 应用启动后延迟 5 秒进行首次检查
- 之后每隔设定的检查间隔自动检查
- 当任一类资产的权重超出设定的带宽上下限时，发送通知
- 同一偏离状态在检查间隔内不会重复通知

## 数据备份

应用数据存储在浏览器的 IndexedDB 和 localStorage 中。建议定期备份。

### 手动备份

1. **设置 → 数据备份 → 备份到文件**：选择保存位置，导出 JSON 文件
2. **设置 → 数据备份 → 从文件恢复**：选择之前导出的 JSON 文件导入

> 恢复操作会覆盖当前所有数据，请谨慎操作。

### 自动备份

1. 开启自动备份开关
2. 点击「选择文件位置」选择一个本地 JSON 文件
3. 之后每次持仓或配置变更时，自动写入该文件

> 自动备份依赖浏览器的 File System Access API，仅 Chromium 内核浏览器（Chrome、Edge）支持，且文件句柄仅在当前浏览器会话内有效。

## 项目结构

```
src/
├── components/
│   ├── charts/          # 图表组件（饼图、净值曲线）
│   ├── forms/           # 表单组件（持仓表单、交易记录、分配配置）
│   └── Layout/          # 布局（侧边栏导航）
├── db/                  # Dexie IndexedDB 数据库
├── pages/
│   ├── Dashboard/       # 仪表盘
│   ├── Holdings/        # 持仓管理
│   ├── Rebalance/       # 再平衡
│   ├── History/         # 历史记录
│   └── Settings/        # 设置
├── services/
│   ├── calcService.ts   # 组合计算
│   ├── fxService.ts     # 汇率服务
│   ├── quoteService.ts  # 行情服务（多源回退）
│   ├── searchService.ts # 标的搜索（新浪财经）
│   ├── rebalanceService.ts  # 再平衡引擎
│   ├── notificationService.ts # Telegram 通知
│   ├── backupService.ts # 数据备份
│   ├── performanceService.ts # 绩效计算
│   └── snapshotService.ts    # 快照服务
├── stores/
│   ├── portfolioStore.ts # 持仓/交易/快照状态
│   ├── quoteStore.ts     # 行情/汇率状态
│   └── configStore.ts    # 配置状态
└── types/                # TypeScript 类型定义
```

## License

MIT
