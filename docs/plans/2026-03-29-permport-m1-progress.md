# PermPort M1 当前完成情况（截至 2026-03-29）

## 1. 总体进度

- 对照计划文件 `2026-03-29-permport-m1.md`，当前已完成 **Task 1 ~ Task 13**，整体完成度约 **100%**。
- 项目已具备 M1 目标能力：可添加持仓、查看实时权重、判断是否触发再平衡。
- 当前实现在行情源方面已超出原计划，完成了多数据源回退增强。

## 2. 各任务完成状态

| 任务 | 名称 | 状态 | 说明 |
|------|------|------|------|
| Task 1 | Project Scaffolding | ✅ 已完成 | Vite + React + TypeScript 项目初始化完成 |
| Task 2 | Type Definitions | ✅ 已完成 | `src/types` 下组合、行情、配置类型已就绪 |
| Task 3 | IndexedDB Data Layer | ✅ 已完成 | Dexie 数据层与 CRUD 测试已完成 |
| Task 4 | Utility Functions | ✅ 已完成 | 格式化与校验工具函数及测试已完成 |
| Task 5 | Calculation Service | ✅ 已完成 | 权重计算与再平衡触发逻辑已完成 |
| Task 6 | Quote Service | ✅ 已完成 | 行情服务可用，且已做多源增强 |
| Task 7 | FX Service | ✅ 已完成 | 汇率获取与批量汇率处理已完成 |
| Task 8 | Zustand Stores | ✅ 已完成 | 组合、配置、行情状态管理已完成 |
| Task 9 | App Layout & Routing | ✅ 已完成 | 主布局与路由导航已完成 |
| Task 10 | Holdings CRUD Page | ✅ 已完成 | 持仓增删改查、刷新、行情展示已完成 |
| Task 11 | Dashboard Page | ✅ 已完成 | 统计卡片、权重图、带宽视图已完成 |
| Task 12 | Settings Page | ✅ 已完成 | 货币、API Key、再平衡参数配置已完成 |
| Task 13 | Final Integration & Smoke Test | ✅ 已完成 | 标题更新、全量测试与构建通过 |

## 3. 相比原计划的增强项

### 3.1 行情服务增强（超出 M1 原始范围）

- 原计划：主要基于 Yahoo 获取行情。
- 当前实现：按可用性做了多源回退，提升稳定性：
  - FMP（有 Key 时优先）
  - Yahoo（公共源）
  - Stooq（公共回退源）
  - Tencent（针对 `.SS/.SZ` 中国市场代码优先）
- 已修复的关键问题：
  - ticker 大小写/空格导致的匹配失败
  - FMP Legacy endpoint 问题（迁移到 stable）
  - Yahoo 429 限流导致回退失败
  - Stooq 单行 CSV 与时间格式解析问题
  - 沪深代码（如 `510300.SS`）行情来源适配

### 3.2 资产品种支持优化

- 黄金支持区分：
  - `GLD`（黄金 ETF）
  - `XAUUSD`（现货黄金）
- 债券与黄金在部分源失败时可自动切换回退源继续尝试。

## 4. 当前可验证状态

- 测试：`vitest` 全通过（当前为 78 个测试用例通过）。
- 代码质量：`eslint` 通过（存在 TypeScript 版本兼容提示，但不阻塞）。
- 构建：`npm run build` 通过，产物可正常生成。
- 页面：Dashboard / Holdings / Settings / Rebalance / History 可访问。

## 5. 当前已知情况

- FMP 免费/当前订阅对部分 symbol（如 `GLD`、`TLT`、`510300.SS` 等）会返回 Premium 限制，这是外部服务策略，不是前端逻辑错误。
- 因此项目通过多源回退保障可用性，但不同数据源在时点、精度、成交时区上可能存在轻微差异，属正常现象。

## 6. 下一步建议（可选）

- 在持仓页增加“行情来源”字段（FMP / Yahoo / Stooq / Tencent），便于排查价格差异。
- 为不同市场（美股、A股、外汇/贵金属）增加更明确的 ticker 输入提示和校验提示。
- 增加行情抓取失败统计与重试次数指标，便于后续稳定性观察。
