# AI Gateway 开发交接文档

## 当前状态

AI Gateway 是一个统一 AI API 网关项目，包含前端控制台和后端 API 服务两个主要工件：

- `artifacts/api-portal`：React + Vite 前端控制台，预览路径为 `/`，对用户展示名称为 `AI Gateway`
- `artifacts/api-server`：Express 后端 API 服务，服务路径为 `/api` 和 `/v1`
- `artifacts/mockup-sandbox`：设计/组件预览沙盒，路径为 `/__mockup`

旧名称检查结果：

- 旧前端工件名称：全库无匹配
- 旧页面主标题：全库无匹配
- 后端工件标题应使用 `AI Gateway API Server`

## 技术栈

- Monorepo：pnpm workspaces
- 前端：React、Vite、TypeScript
- 后端：Express 5、TypeScript、esbuild
- API 契约：OpenAPI + Orval 代码生成
- 配置持久化：工作区根目录 `.proxy-config.json`
- AI 服务接入：
  - OpenAI / Anthropic / Gemini / OpenRouter：优先使用 Replit 托管 AI Integrations 注入的环境变量
  - DeepSeek：用户在 AI Gateway 界面中手动配置 API Key 和 Base URL

## 运行入口

常用开发命令：

```bash
pnpm --filter @workspace/api-portal run dev
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/api-spec run codegen
```

后端开发命令会先执行构建再启动：

```bash
export NODE_ENV=development && pnpm run build && pnpm run start
```

前端必须读取 Replit 分配的端口，后端生产启动使用 `PORT=8080`。不要硬编码新的预览端口。

## 关键路径与文件

### 前端控制台

- `artifacts/api-portal/src/App.tsx`：顶层状态、健康检查、配置拉取、页面路由
- `artifacts/api-portal/src/components/AppHeader.tsx`：页面主标题、版本号、在线状态、密度切换
- `artifacts/api-portal/src/data/models.ts`：前端展示模型注册表；以下常量为全局唯一来源，**禁止在其他文件重复定义**：
  - `PROVIDER_COLORS`：服务商完整视觉配置（`bg`/`border`/`dot`/`text`/`label`）
  - `PROVIDER_HEX_COLORS`：服务商主色十六进制字符串映射
  - `PROVIDER_LABELS`：服务商名称映射
  - `ALL_MODELS`、`TOTAL_MODELS`、`TABS`、`TabId`、`LOCAL_VERSION`、`LOCAL_BUILD_TIME`
- `artifacts/api-portal/src/utils/highlight.tsx`：共享文本高亮函数 `highlight(text, query)`，**禁止在页面组件内重复实现**
- `artifacts/api-portal/src/data/pricing.ts`：用量日志费用估算价格表
- `artifacts/api-portal/src/pages/ModelsPage.tsx`：模型列表展示
- `artifacts/api-portal/src/pages/SettingsPage.tsx`：Proxy Key、服务商配置、URL 自动纠错、请求伪装配置
- `artifacts/api-portal/src/pages/usageLogs/stats.ts`：统计辅助；`PROVIDER_COLORS` 由 `models.ts` 的 `PROVIDER_HEX_COLORS` 重导出，维持向后兼容
- `artifacts/api-portal/src/pages/UsageLogsPage.tsx` 和 `src/pages/usageLogs/`：使用日志、统计分析、CSV 导出、伪装统计
- `artifacts/api-portal/UI_DESIGN.md`：前端视觉规范

### 后端 API

- `artifacts/api-server/src/app.ts`：Express 应用装配、路由挂载、404 端点纠错提示
- `artifacts/api-server/src/config.ts`：配置读取、保存、工作区根路径定位
- `artifacts/api-server/src/lib/auth.ts`：API 和管理端点认证
- `artifacts/api-server/src/lib/providers.ts`：模型到服务商识别、thinking 后缀解析
- `artifacts/api-server/src/lib/disguise.ts`：请求伪装 preset、Header 注入和清理策略；导出 `isDisguiseActive()` 和 `overridePreset` 参数支持降级重试
- `artifacts/api-server/src/routes/proxy-models.ts`：后端 `/v1/models` 注册表、非聊天模型集合、Responses API 专用模型集合
- `artifacts/api-server/src/routes/proxy.ts`：OpenAI 兼容入口编排
- `artifacts/api-server/src/routes/proxy-raw.ts`：OpenAI-compatible 通道（OpenAI / OpenRouter / DeepSeek / xAI / Mistral / Moonshot / Groq / Together / SiliconFlow / Cerebras / Fireworks / Novita / Hyperbolic）原样透传；`fetchWithDisguiseFallback()` 在伪装失败（HTTP 400/403/407/422）时自动以无伪装模式重试；raw 流式响应设置 `X-Accel-Buffering: no`
- `artifacts/api-server/src/routes/proxy-anthropic.ts`：Anthropic 目标后端处理
- `artifacts/api-server/src/routes/proxy-gemini.ts`：Gemini 目标后端处理
- `artifacts/api-server/src/routes/claude.ts`：`/v1/messages` Claude 原生格式入口
- `artifacts/api-server/src/routes/gemini-native.ts`：Gemini 原生格式入口
- `artifacts/api-server/src/routes/proxy-usage.ts`、`usage-logs.ts`、`logs.ts`：请求日志和用量统计
- `artifacts/api-server/src/routes/billing.ts`：`/api/billing/usage` 端点；汇总用量与费用统计，含多时段（last_1h/last_24h/last_7d/since_startup）、多货币（usd/cny/eur/gbp/jpy/krw/hkd/sgd）、模型/服务商明细分组、预算配额（budgetQuotaUsd），30 秒内置缓存
- `artifacts/api-server/src/routes/health.ts`：健康检查、版本号、更新记录

## 请求流概览

1. 客户端请求进入 `/v1/*` 或 `/api/*`
2. 认证中间件识别 `Authorization: Bearer`、`x-goog-api-key` 或 `?key=`
3. 路由层根据端点选择 OpenAI 兼容、Claude Messages 或 Gemini Native 处理路径
4. `detectProvider()` 根据模型名判断目标服务商
5. 如请求格式与目标服务商不一致，执行格式转换
6. 如启用请求伪装，应用对应 preset 的 Header 注入与清理
7. 原样透传路径保持厂商响应体、状态码和安全响应头，不重序列化
8. 用量统计旁路解析 usage 信息，写入日志缓冲和使用日志

## 设计约束

- 原样透传路径不能重序列化上游响应体
- raw 流式响应不能追加本地 `[DONE]`
- usage 统计只能旁路解析响应副本
- 请求伪装只改 Header，不修改请求体
- 伪装失败（上游返回 400/403/407/422）时必须自动降级至无伪装模式重试，不得直接返回错误给客户端
- DeepSeek 原生模型 `deepseek-chat` / `deepseek-reasoner` 必须先于 OpenRouter 斜杠规则识别
- OpenRouter 模型以模型名包含 `/` 为路由规则
- `-thinking` / `-thinking-visible` 后缀由后端统一解析，前端只负责展示
- Codex Responses API 专用模型不得误走 `/v1/chat/completions`
- 非聊天模型可以出现在 `/v1/models`，但聊天端点应返回明确错误

## 安全约束（v0.1.75–v0.1.81 加固）

完整安全约束列表见 `docs/maintenance-guide.md`（"安全约束"节）和 `docs/maintenance-rules.md`（"安全 API 约束"表格）。核心不得退化项：

- **500 错误脱敏**：`app.ts` errorHandler 固定返回 `"Internal server error"`，禁止暴露 `err.message`
- **模型刷新认证**：`GET /api/models?refresh=1` 已配置密钥时须验证身份，返回 401
- **CSS 注入防护**：`chart.tsx` 的 `dangerouslySetInnerHTML` 注入值须经白名单正则过滤
- **密钥比较**：所有密钥比较必须使用 `safeCompare()`，禁止 `===`
- **Disguise headers 隐藏**：`GET /api/settings/disguise` 响应不含 `headers` 字段（v0.1.81 移除）
- **SSRF 防护**：用户输入 baseUrl 写入前须经 `isPrivateUrl()` 过滤

### 前端编码约定

- **共享常量**：服务商颜色、标签、模型列表等全局数据只在 `src/data/models.ts` 中维护，其他文件从此处导入
- **共享工具**：跨页面复用的工具函数放置于 `src/utils/` 目录（如 `highlight.tsx`），禁止在页面组件内内联重复实现
- **性能**：列表过滤（`filteredLogs`、`searchResults`）和统计聚合使用 `useMemo`；渲染期间不变的分组常量提升为模块级常量
- **无障碍**：可交互的非原生按钮须添加 `role="button"`、`tabIndex`、`onKeyDown`（支持 Enter / Space）和对应 `aria-*` 属性；原生 `<button>` 禁止嵌套
- **样式**：hover 交互效果用 CSS 类（定义于 `src/index.css`）实现，不应在组件内使用 `onMouseOver`/`onMouseOut` 直接操纵 style

## 版本与变更记录

涉及运行行为的变更应同步更新：

1. `artifacts/api-server/src/routes/health.ts`
   - `APP_VERSION`
   - `APP_BUILD_TIME`
   - `APP_CHANGELOG` 头部追加新条目
2. `artifacts/api-portal/src/data/models.ts`
   - `LOCAL_VERSION`
   - `LOCAL_BUILD_TIME`
3. `replit.md`
   - 项目结构、关键规则、变更记录

`APP_CHANGELOG` 和 `replit.md` 变更记录均只保留最近 10 条。

## 配置与密钥

配置文件：

- `.proxy-config.json`

主要配置内容：

- `proxyKey`
- 各服务商 `baseUrl` / `apiKey`
- URL 自动纠错开关
- 请求伪装 preset

不要把真实密钥写入源码、文档或日志。对用户展示时使用掩码。

## 交接前检查清单

每次交接前建议确认：

```bash
pnpm --filter @workspace/api-portal run dev
pnpm --filter @workspace/api-server run dev
```

并执行全库名称检查：

```bash
rg "API\s+Portal|AI\s+Proxy\s+Gateway" .
```

预期结果：无匹配。

如果改动了工件标题，不要直接编辑工件元数据文件；应通过 Replit 工件元数据验证流程替换。
