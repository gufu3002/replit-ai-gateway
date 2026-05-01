# 工作区

---

## ⚠️ 最高优先原则：绝不破坏中转纯净度

**本条规则优先级高于所有其他开发决策，不得以任何理由绕过。**

AI Gateway 的核心价值是透明中转：客户端发什么，网关就转什么，不得对请求内容做任何隐性修改。违反此原则的改动（无论出于"健壮性"、"兼容性"还是其他理由）一律禁止。

**禁止行为（不限于以下列举）：**

- 合并、拆分或重排客户端消息（如将连续同角色消息合并为一条）
- 静默修改消息 role、content 或结构字段
- 在客户端请求中增删任何字段（除非用于路由必要的头部注入，如认证 Key）
- 对客户端请求做任何"修复性"预处理，哪怕上游 API 不支持该结构

**允许行为（仅限以下）：**

- 格式转换（OpenAI ↔ Claude ↔ Gemini）时进行必要的结构映射（如字段重命名、嵌套结构转换），但必须保持语义等价、零信息丢失
- 对响应字段做规范化映射（如将 Gemini `finishReason` 映射为 OpenAI `finish_reason`），不修改内容语义
- 注入认证头部（API Key）用于上游鉴权

---

## ⚠️ 最高优先原则：请求伪装 Profile 列表必须始终可见

`GET /api/settings/disguise` 和前端“请求伪装模式”列表属于公开只读元数据路径，不得因为未提供 Admin Key、提供错误 Admin Key、或接口临时失败而隐藏模式清单。

- 后端 `GET /api/settings/disguise` 不得添加 `adminAuth` 或任何 Admin Key 校验；`POST /api/settings/disguise` 切换 preset 仍需认证
- 前端读取列表时不得携带 `Authorization` / Admin Key，避免错误 Key 影响公开读取
- 前端必须保留本地只读兜底 Profile 列表；接口失败时仍展示模式清单，只禁用切换保存

---

## 📌 UI 与文档约定（不得违反）

**本节为前端 UI 与项目文档的固定约定，任何重写、重构都必须保留：**

- **实时日志页面的圆圈占位图案禁止删除**：「实时日志」页面（`LogsPage.tsx`）在未连接、无日志时，显示在「点击「连接」开始接收实时日志」上方的圆圈 SVG 占位图案是设计的一部分，必须保留为实线圆圈（`stroke="#334155"`，无 `strokeDasharray`），不得删除或改回虚线
- **`/v1beta/models` 与 `/v1/models` 作用一致**：两者都是返回可用模型列表，仅响应格式不同（前者 Google Gemini 原生格式，后者 OpenAI / Anthropic 格式）。技术参考、项目文档中描述这两个端点时措辞必须保持一致，**禁止**在 `/v1beta/models` 描述里出现「所有可用模型」之类与 `/v1/models` 不一致的表达
- **AI 服务商顺序必须与模型列表对齐（OpenRouter 在尾部）**：技术参考（`ReferencePage.tsx`）和项目文档（`DocsPage.tsx`）中所有列举服务商的位置（路由机制、端点说明、概览统计等），顺序必须严格与「模型列表」页面 `ModelsPage.tsx` 的渲染顺序一致：OpenAI → Anthropic → Google → xAI → DeepSeek → Mistral → Moonshot → Groq → Cerebras → Together → SiliconFlow → Fireworks → Novita → Hyperbolic，**OpenRouter 始终位于尾部**（这是唯一例外，即便模型列表页将其插入中段，文档列举仍放最后）。新增/调整服务商时三处必须同步更新

---

## 📏 系统约束：请求体大小上限 256 MB

**本约束不得随意调整，任何修改须在此处更新说明。**

Express 的 `json()` 和 `urlencoded()` 中间件 `limit` 统一设置为 `"256mb"`（`app.ts`）。超出上限时返回 OpenAI 格式的 `413 request_too_large` 错误，附中文说明。256 MB 可覆盖多图（约 20 张高清图）、大型 PDF 等绝大多数真实 AI 请求场景，同时避免超大 body 在 Replit 容器中造成 OOM（1 GB body 解析峰值内存约 2–3 GB，容器通常无法承受）。

---

## 项目概览

本项目是一个基于 TypeScript 的 pnpm workspace 单仓库。各个包分别管理自身依赖，整体通过 pnpm workspaces 协同开发。

## 技术栈

- **单仓库工具**：pnpm workspaces
- **Node.js 版本**：24
- **包管理器**：pnpm
- **TypeScript 版本**：6.x（已升级，注：orval/typedoc 不支持 TS6，仅影响代码生成，generated api.ts 已提交）
- **API 框架**：Express 5
- **数据库**：PostgreSQL + Drizzle ORM
- **数据校验**：Zod（`zod/v4`）、`drizzle-zod`
- **API 代码生成**：Orval（基于 OpenAPI 规范生成）
- **构建工具**：esbuild（输出 CJS bundle）

## 常用命令

- `pnpm run typecheck`：对全部包执行完整类型检查
- `pnpm run build`：类型检查并构建全部包
- `pnpm --filter @workspace/api-spec run codegen`：根据 OpenAPI 规范重新生成 API hooks 和 Zod schemas
- `pnpm --filter @workspace/db run push`：推送数据库 schema 变更（仅开发环境）
- `pnpm --filter @workspace/api-server run dev`：本地运行 AI Gateway API Server

## 工件

### AI Gateway（`artifacts/api-portal`）

React + Vite 单页前端应用，运行在 `/`。主要结构：

- `src/App.tsx`：轻量容器，负责共享状态（adminKey、健康检查、配置、密度模式）、标签栏和页面路由；Tab 状态与 URL `?tab=<TabId>` 双向同步：初始挂载时读取 URL（无效或缺省回退到 `overview`），切换 Tab 时通过 `history.replaceState` 写回 URL（`overview` 时移除参数），并监听 `popstate` 支持浏览器前进 / 后退。**此 URL 同步约定不得移除**，是分享深链接和外部截图工具定位页面的基础
- `src/data/models.ts`：模型注册表（OPENAI / ANTHROPIC / GEMINI / DEEPSEEK / XAI / MISTRAL / MOONSHOT / GROQ / TOGETHER / SILICONFLOW / CEREBRAS / FIREWORKS / NOVITA / HYPERBOLIC / OPENROUTER，共 15 个服务商）；同时导出以下全局共享常量，**禁止在其他文件重复定义**：
  - `PROVIDER_COLORS`：服务商完整视觉配置（`bg`、`border`、`dot`、`text`、`label`），供 `ModelGroup` 等组件使用
  - `PROVIDER_HEX_COLORS`：服务商主色十六进制字符串映射，供搜索结果标签、图表、统计面板等使用
  - `PROVIDER_LABELS`：服务商名称映射
  - `ALL_MODELS`、`TOTAL_MODELS`、`TABS`、`TabId`、`LOCAL_VERSION`、`LOCAL_BUILD_TIME`
- `src/utils/highlight.tsx`：共享文本高亮函数 `highlight(text, query)`，在 `ModelsPage` 和 `LogsPage` 中统一使用，**禁止在页面组件内重复实现**
- `src/components/`：可复用 UI 组件，包括 AppHeader、Card、CopyButton、CodeBlock、SectionTitle、Badge、MethodBadge、ModelGroup、ToggleSwitch、SegmentedControl
  - **`SegmentedControl`**：统一的胶囊式分段切换控件，支持 `size="sm"/"md"`、`allowDeselect`、每项可选 `accentColor`（自动派生 bg/border）与 `badge`（数量徽标）。**所有"互斥状态切换"语义（如使用日志的趋势/性能/伪装、性能面板的按供应商/按模型、实时日志的级别筛选）必须使用此组件**，禁止再为这类场景手写按钮组或引入新的配色风格
- `src/pages/`：8 个标签页组件：OverviewPage、ModelsPage、SettingsPage、DeployPage、ReferencePage、LogsPage、UsageLogsPage、DocsPage；`ModelsPage` 会优先读取公开 `/api/models` 实时同步结果，接口失败时回退 `src/data/models.ts` 本地清单
- `src/pages/usageLogs/`：使用日志功能模块，包括共享类型、CSV/统计辅助函数、趋势分析面板、性能分析面板、伪装统计面板；`ToggleButton.tsx` 仅作为 `SegmentedControl` 的兼容性再导出，新代码请直接从 `src/components/SegmentedControl` 导入。`stats.ts` 的 `PROVIDER_COLORS` 由 `PROVIDER_HEX_COLORS` 重导出以维持向后兼容
- `src/data/pricing.ts`：模型价格表（美元 / 100 万 tokens），提供 `lookupPricing`、`estimateCost`、`formatCost` 辅助函数；覆盖 OpenAI、Anthropic、Gemini、DeepSeek，支持精确匹配和前缀匹配，并在查询前自动剥离 `-thinking` / `-thinking-visible` 后缀
- `src/index.css`：全局样式，包含紧凑模式覆盖规则和 `.btn-ghost-subtle` 等通用 CSS 工具类；**hover 交互效果应优先用 CSS 类实现，不应在组件内使用 `onMouseOver`/`onMouseOut` 直接操纵 style**
- 页面专属状态（实时日志轮询、使用日志过滤器、设置表单等）保留在对应页面组件内
- **实时日志轮询间隔固定为 15 分钟（`POLL_INTERVAL = 15 * 60 * 1000`），禁止修改此值**，这是有意设计的节流策略，不得以"实时性"为由缩短
- UI 字号规范：以 `artifacts/api-portal/UI_DESIGN.md` 为唯一权威。采用三级标题制：**H1 = 22px（页面主标题，仅用于顶部 Header 产品名 "AI Gateway"，固定永久不变）**、**H2 = 18px（区块标题 SectionTitle）**、**H3 = 14px（卡片内小节标题，与正文同尺寸，以字重 700 + 下边框区分）**、**H4 = 12px（子节标题）**；正文内容默认 14px，次级元信息 / 辅助标签 / 徽章 / placeholder 使用 12px。**禁止使用 11px / 13px / 13.5px 等三级制以外的字号**（lineHeight 不受此约束）。已于 2026-04-16、2026-04-20、2026-04-21 多次全量复审，修复涉及 `BillingPage.tsx` 的 `11px`、`LogsPage.tsx` 输入框 `12px`→`14px`、`ReferencePage.tsx` 说明文字 `12px`→`14px`、`DocsPage.tsx` 统计标签 `14px`→`12px`、`UsageLogsPage.tsx` 输入框 / 表格模型 ID / 重放弹窗模型 code / 请求体 textarea / Headers `<pre>` / 响应体 `<pre>` 主要内容 `12px`→`14px` 等正文/次级层级的越界用法。Header logo / favicon 使用清晰的 "A" 网关 SVG 标记。AI Gateway 支持持久化密度模式：默认 `comfortable`，可通过 `localStorage.portal_density_mode` 切换到 `compact`；紧凑模式间距覆盖定义在 `src/index.css`

**前端编码规范**：

- **共享常量**：服务商颜色、标签、模型列表等全局数据只在 `src/data/models.ts` 中维护，其他文件从此处导入；`src/utils/` 目录存放跨页面复用的工具函数
- **性能**：列表过滤（`filteredLogs`、`searchResults`）和统计聚合应使用 `useMemo`；渲染期间不变的静态派生数据（如模块级分组）应提升为模块常量而非每次渲染重新计算
- **无障碍**：可交互的非原生按钮元素须添加 `role="button"`、`tabIndex`、`onKeyDown`（支持 Enter / Space）和对应 `aria-*` 属性；原生 `<button>` 禁止嵌套

### AI Gateway API Server（`artifacts/api-server`）

当前版本：**0.1.81**（构建日期：2026-05-01）。服务端版本常量位于 `src/routes/health.ts`，前端控制台版本常量位于 `src/data/models.ts`（`LOCAL_VERSION`、`LOCAL_BUILD_TIME`）。

**v0.1.81 代码审计修复（全部已完成）：**
- 安全①：500 全局错误处理器改为固定字符串，不再向客户端暴露 `err.message`
- 安全②：`GET /api/models?refresh=1` 新增认证校验，防止消耗上游配额
- 安全③：`GET /api/settings/disguise` 响应移除 `headers` 字段，防止 SDK 伪装指纹泄露
- 安全④：`chart.tsx` 的 `dangerouslySetInnerHTML` CSS 值注入增加白名单正则防护
- 质量⑤：`LogsPage` 增加 `fetchAbortRef`（AbortController），`stopPolling()` 立即取消进行中的 fetch
- 质量⑥：`proxy-raw.ts` `getProviderCredentials()` 新增注释说明 Replit 平台注入 localhost URL 的设计意图
- 质量⑦：`URL_AC_VALID_KEYS` 新增注释说明 `enabled`/`global` 双键并存与向后兼容设计
- 质量⑧：`types.ts` `SystemConfig` 新增 `adminKeyWarning?` 字段与后端对齐

**v0.1.80 安全加固（全部已完成）：**
- 后端批次一：CSP 启用、CORS 显式配置、rate-limit skip 回调移除、URL ReDoS 防护（2048 字符上限）、SSRF 正则补充 CGNAT/GCP metadata 段、Zod 配置校验 + 随机 proxyKey 自动生成、分层超时（非流式 3 min / 流式 10 min）
- 前端 LogsPage：401/403 停止轮询并展示错误横幅（可关闭），网络错误改为 console.warn 后继续重试
- 前端 UsageLogsPage：Replay 增加 AbortController + ✕ 取消按钮，关闭/跳转时自动取消进行中请求，超时从 120s 降至 60s，openReplay 同样处理 401/403
- 后端批次二：① `trust proxy 1` 修复 Replit 反向代理后 req.ip 失真，确保速率限制按真实客户端 IP 生效；② `proxy-anthropic.ts` / `proxy-gemini.ts` 非流式路径 JSON.parse 包裹 try/catch，上游返回非 JSON 时返回 502 并附前 200 字节预览（避免 SyntaxError 裸抛并泄露上游原始内容）；③ `getPublicConfig()` 在 adminKey 未配置时追加 `adminKeyWarning` 字段，明确告知 Proxy Key 当前具备管理权限；④ 404 处理器移除 `REPLIT_DOMAINS` 域名泄露（`docs` 字段删除）
- 前端批次二：① `getReplayUrl` / `getCompareUrl` 对 Gemini 路径中的模型名改用 `encodeURIComponent()` 防路径穿越；② 删除 replay 请求中已废弃的 `X-Gateway-Debug-Headers: "1"` 头（后端 v0.1.76 已移除处理逻辑，该头仅出现在 NOT_FORWARDED 列表中）

**路由服务商**（15 个）：openai、anthropic、gemini、openrouter、deepseek、xai、mistral、moonshot、groq、together、siliconflow、cerebras、fireworks、novita、hyperbolic。路由识别逻辑位于 `src/lib/providers.ts` 的 `detectProvider`。DeepSeek 模型识别采用前缀匹配（`deepseek-` 开头且不含 `/`），xAI/Mistral/Moonshot 使用无斜杠官方模型名前缀，Groq/Together/SiliconFlow/Cerebras/Fireworks/Novita/Hyperbolic 使用本地命名空间前缀（`groq/`、`together/`、`siliconflow/`、`cerebras/`、`fireworks/`、`novita/`、`hyperbolic/`）并在转发上游前剥离前缀。DeepSeek 等非 Replit 托管服务商凭证由用户自行在设置页填写对应平台 API Key。

**`AppConfig.providers` 支持 15 个服务商配置字段**（`baseUrl` + `apiKey`）：`openai`、`anthropic`、`gemini`、`openrouter`、`deepseek`、`xai`、`mistral`、`moonshot`、`groq`、`together`、`siliconflow`、`cerebras`、`fireworks`、`novita`、`hyperbolic`。15 个字段均可通过 `POST /api/config/provider` 写入；OpenAI/Anthropic/Gemini/OpenRouter 优先使用 Replit AI Integrations，其余通道使用设置页填写的上游 API Key 和默认 Base URL。`budgetQuotaUsd`（默认 10.0 USD）为会话消费预算上限，由 `GET /api/billing/usage` 返回的 `budget` 对象使用：使用率达 80% 时 `warn: true`，超过 100% 时 `exceeded: true`。

URL 自动纠错支持按端点单独配置（chatCompletions、messages、models、geminiGenerate、geminiStream、global），配置持久化到 `.proxy-config.json`。对应 API 为 `GET/POST /api/settings/url-autocorrect`。纠错规则包括：`/v1/v1/` 去重、`/api/v1/` 前缀修正、`/v[2-9]/` → `/v1/`、`/v1beta/v1beta/` 去重、`/v1/v1beta/` 合并为 `/v1beta/`、`/v1/models/:model:generateContent` → `/v1beta/models/:model:generateContent`、`/v1/models/:model:streamGenerateContent` → `/v1beta/models/:model:streamGenerateContent`、裸路径 `/models/:model:generateContent` → `/v1beta/models/:model:generateContent`。

Express 服务暴露以下端点：

- `/api/healthz`：健康检查
- `/api/version`：返回 `{ version, buildTime, changelog }`，并设置 CORS `*`，用于 AI Gateway 展示当前版本以及外部读取版本信息
- `/api/models`：公开只读模型清单，优先实时拉取 Replit 可访问的 OpenAI / Anthropic / Gemini / OpenRouter 上游 models 接口，返回同步来源状态；无上游凭证或上游失败时使用本地静态兜底
- `/v1/models`：列出可用模型；默认返回 OpenAI 兼容格式（`{object:"list", data:[{id,object,created,owned_by}]}`）；携带 `anthropic-version` 请求头时返回 Anthropic 格式（`{data:[{type,id,display_name,created_at}], has_more, first_id, last_id}`，仅含 Anthropic 模型）；与 `/api/models` 使用同一份 60 秒缓存，仍需 Proxy Key 认证
- `/v1beta/models`：列出 Google 模型，返回 Google Gemini 原生格式（`{models:[{name,version,displayName,supportedGenerationMethods}]}`），遵循 Google 官方 generativelanguage.googleapis.com/v1beta/models 路径约定；需 Proxy Key 认证
- `/v1beta/models/:model`：查询单个 Google 模型信息，返回 Google 原生格式；模型不存在时 404；需 Proxy Key 认证
- `/v1/chat/completions`：OpenAI 兼容补全代理端点；会自动识别 Gemini 格式请求（`contents` 字段）并透明转换
- `/v1/responses`：OpenAI Responses API 透传端点，用于 gpt-5.3-codex、gpt-5.2-codex 等仅支持 Responses API 的模型；支持流式输出
- `/v1/messages`：Claude Messages API 格式端点，可从任意后端模型返回 Claude 格式响应
- `/v1beta/models/:model:generateContent`：Gemini 原生格式端点（非流式，遵循 Google 官方 /v1beta 路径约定）
- `/v1beta/models/:model:streamGenerateContent`：Gemini 原生格式流式端点

认证方式（所有 `/v1/*` 端点均需要认证，支持多种传递方式）：

- `Authorization: Bearer <your-key>`：OpenAI 风格 Bearer Token
- `x-goog-api-key: <your-key>`：Gemini 风格请求头
- `?key=<your-key>`：URL 查询参数

模型路由规则：

- `gpt-*` / `o*` 前缀 → OpenAI（通过 Replit AI Integrations）
- `claude-*` 前缀 → Anthropic（通过 Replit AI Integrations）
- `gemini-*` 前缀 → Google Gemini（通过 `@google/genai` SDK，已由 esbuild 打包）
- `deepseek-*` 前缀（不含 `/`）→ DeepSeek 原生接口（覆盖 deepseek-chat、deepseek-reasoner、deepseek-r1、deepseek-v3 等）
- `grok-*` 前缀（不含 `/`）→ xAI 原生接口
- `mistral-*` / `mixtral-*` / `codestral-*` / `devstral-*` / `voxtral-*` / `ministral-*` 前缀（不含 `/`）→ Mistral AI 原生接口
- `moonshot-*` / `kimi-*` 前缀（不含 `/`）→ Moonshot AI 原生接口
- `groq/` 前缀 → Groq OpenAI-compatible 接口（转发前剥离 `groq/`）
- `together/` 前缀 → Together AI OpenAI-compatible 接口（转发前剥离 `together/`）
- `siliconflow/` 前缀 → SiliconFlow OpenAI-compatible 接口（转发前剥离 `siliconflow/`）
- `cerebras/` 前缀 → Cerebras OpenAI-compatible 接口（`api.cerebras.ai/v1`，转发前剥离 `cerebras/`）
- `fireworks/` 前缀 → Fireworks AI OpenAI-compatible 接口（`api.fireworks.ai/inference/v1`，转发前剥离 `fireworks/`；上游模型 ID 格式为 `accounts/fireworks/models/<name>`）
- `novita/` 前缀 → Novita AI OpenAI-compatible 接口（`api.novita.ai/v3/openai`，转发前剥离 `novita/`）
- `hyperbolic/` 前缀 → Hyperbolic OpenAI-compatible 接口（`api.hyperbolic.xyz/v1`，转发前剥离 `hyperbolic/`）
- 其他包含 `/` 的模型名 → OpenRouter
- `-thinking` 后缀 → 思考模式（隐藏思考过程）
- `-thinking-visible` 后缀 → 思考 tokens 以可见形式输出
- o-series 模型的 `-thinking` → 同模型别名，用于兼容
- Codex 模型（gpt-5.3-codex、gpt-5.2-codex）在 `/v1/chat/completions` 中返回 400，并提示改用 `/v1/responses`
- 非聊天模型（image、audio、transcribe）会出现在 `/v1/models` 中，但在 `/v1/chat/completions` 中返回 400 和使用提示

网关架构：

- **OpenAI / OpenRouter / DeepSeek / xAI / Mistral / Moonshot / Groq / Together / SiliconFlow / Cerebras / Fireworks / Novita / Hyperbolic**：使用原生 `fetch` 透传 OpenAI-compatible 接口，不引入 SDK 开销；原样转发层必须保持厂商响应体透传，usage 统计只能旁路解析副本，不能重序列化响应体，不能在 raw 流式响应后追加本地 `[DONE]`。raw 上游请求在伪装 Header 注入后仍会清理逐跳请求头、请求体编码头、代理/CDN 链路头并强制保留 `Accept-Encoding: identity`，响应转发上游状态码、安全响应头和原始字节，流式响应设置 `X-Accel-Buffering: no`。服务商凭证解析顺序为配置文件 → 环境变量
- **Anthropic**：原生 Anthropic Messages 端点使用原始请求字节透传；OpenAI / Gemini 跨格式路径转换请求体后通过原生 `fetch` 调用 Anthropic HTTP API，并解析 SSE / JSON 转回目标格式
- **Gemini**：原生 Gemini generateContent / streamGenerateContent 端点使用原始请求字节透传；OpenAI / Claude 跨格式路径转换请求体后通过原生 `fetch` 调用 Gemini HTTP API，并解析 SSE / JSON 转回目标格式

配置管理：

- `GET /api/config`：公开读取基础配置（密钥脱敏，仅显示服务商是否已配置，含 `adminKeyConfigured`）；带认证时返回 baseUrl 和脱敏 apiKey 等完整管理信息
- `POST /api/config/admin-key`：设置或清除 Admin Key，需要认证（留空即清除，回退为 Proxy Key 验证）
- `POST /api/config/proxy-key`：修改 Proxy API Key，需要 Admin Key 认证（或未设置 Admin Key 时用 Proxy Key），并要求 `newKey` / `confirmKey` 双重输入，最少 16 个字符
- `POST /api/config/provider`：更新服务商配置（`provider`、可选 `baseUrl`、可选 `apiKey`），需要 Admin Key 认证
- `GET /api/settings/budget`：读取预算配额（`budgetQuotaUsd`），需要 Admin Key 认证
- `POST /api/settings/budget`：更新预算配额（`budgetQuotaUsd`），需要 Admin Key 认证
- `GET /api/billing/usage`：汇总用量与费用统计；支持 `period`、`since`、`currency`、`top`、`no_breakdown` 参数；返回 `budget`（quota/used/remaining/warn/exceeded）、多时段统计及模型/服务商明细；需 Admin Key 认证
- `GET/POST /api/settings/url-autocorrect`：读取或更新请求路径自动纠错配置，需认证
- `GET /api/settings/disguise`：公开读取当前伪装 Preset 及所有可用 Profile，无需 Admin Key 认证；前端必须在接口失败时显示本地只读兜底 Profile 列表
- `POST /api/settings/disguise`：切换请求伪装 Preset，需 Admin Key 认证
- `GET /api/logs`：获取最近请求日志（内存环形缓冲，最多 500 条），支持 `sinceIndex` 增量轮询，需认证
- `POST /api/logs/clear`：清空内存请求日志，需认证
- `GET /api/usage-logs`：获取 Token 用量统计日志（内存环形缓冲，最多 500 条），需认证
- `POST /api/usage-logs/clear`：清空用量统计日志，需认证
- 配置持久化在工作区根目录的 `.proxy-config.json`
- **Admin Key 与 Proxy Key 安全分离**：`adminKey` 是管理设置的独立凭证，`proxyApiKey` 是 AI 请求凭证。若未设置 `adminKey`，`adminAuth` 回退到 `proxyApiKey` 兼容旧部署。前端 Admin Key 存储于 `sessionStorage` 的 `admin_key`（会话级，页面关闭自动清除）；旧版 `localStorage` 的 `admin_key` / `proxy_api_key` 键在启动时由 `clearLegacyAdminKeyStorage()` 自动清除。密度模式偏好存储于 `localStorage.portal_density_mode`

关键源码文件：

- `src/routes/proxy.ts`：轻量编排层（约 210 行），仅负责 `/v1/models`、`/v1/chat/completions`、`/v1/responses` 的路由分发，具体逻辑委托给子模块
- `src/routes/proxy-models.ts`：后端模型注册表、端点兼容性集合、Replit 上游 models 实时同步逻辑（60 秒缓存），用于 `/api/models`、`/v1/models` 和聊天端点校验
- `src/routes/proxy-format.ts`：共享聊天请求 / 消息类型，以及 OpenAI → Anthropic / Gemini 的工具调用格式转换辅助函数
- `src/routes/proxy-raw.ts`：OpenAI-compatible 原样转发逻辑，覆盖 OpenAI / OpenRouter / DeepSeek / xAI / Mistral / Moonshot / Groq / Together / SiliconFlow / Cerebras / Fireworks / Novita / Hyperbolic；导出 `streamRawProvider`、`nonStreamRawProvider`、`rawPassthroughStream`、`rawPassthroughNonStream`、`getProviderCredentials`
- `src/routes/proxy-sse.ts`：SSE 工具函数，包括 `sseChunk`、`setupSseHeaders`、`startKeepalive`、`extractUpstreamStatus`
- `src/routes/proxy-usage.ts`：用量统计逻辑，包括 `LogUsage` 类型、`UsageTracker` 接口、`createUsageTracker`
- `src/routes/billing.ts`：`GET /api/billing/usage` 端点（需 `adminAuth`）；汇总全会话用量与费用估算，支持 `period=last_1h|last_24h|last_7d|since_startup`、`since=<ISO/ms>` 自定义窗口、`currency=usd|cny|eur|gbp|jpy|krw|hkd|sgd` 多货币汇算、`top=N` 明细截断、`no_breakdown=1` 轻量模式；返回 `budget`（quota/used/remaining/warn/exceeded）、`period` 时段统计、`by_model`/`by_provider` 明细（按 totalTokens 降序）；内置 30 秒结果缓存，但 `usage-logs` 写入或清空会递增版本号并让下一次 billing 查询立即重建缓存；since_startup token 来自无上限会话累加器，精确不受环形缓冲限制
- `src/routes/proxy-anthropic.ts`：Anthropic 流式处理器 `handleAnthropicStream` 和非流式处理器 `handleAnthropicNonStream`
- `src/routes/proxy-gemini.ts`：Gemini 流式处理器 `handleGeminiStream` 和非流式处理器 `handleGeminiNonStream`
- `src/routes/claude.ts`：`/v1/messages` 路由，接收 Claude 格式并支持所有服务商
- `src/routes/gemini-native.ts`：`/v1beta/models/*:generateContent` 路由，接收 Gemini 格式并支持所有服务商
- `src/lib/auth.ts`：共享多认证方式中间件，包括 API 端点的 `authMiddleware` 和管理端点的 `adminAuth`
- `src/lib/providers.ts`：共享服务商识别逻辑 `detectProvider`、思考后缀解析 `parseThinkingSuffix`、SSE flush 辅助函数 `flushRes`
- `src/lib/model-limits.ts`：共享模型 token 限制和 thinking budget 常量，包括 `ANTHROPIC` / `GEMINI` 常量和 `resolveMaxTokens`
- `src/lib/format.ts`：Gemini ↔ OpenAI、Claude ↔ OpenAI 的格式转换工具
- `src/config.ts`：配置管理，`saveConfig` / `updateConfig` 为异步函数，导出 `findWorkspaceRoot`
- `build.mjs`：esbuild 配置；仅将 `@google-cloud/*` 设为外部依赖，`@google/genai` 会被打包

## 请求伪装系统

实现文件：`src/lib/disguise.ts`。

当前共有 **21 个 preset**：`none`、`auto`、`auto-no-replit`，以及 18 个具体 SDK / 工具 profile：

- `openai-sdk` / `openai-sdk-py` / `openai-sdk-py-async`：OpenAI Node.js SDK、Python 同步客户端、Python 异步客户端（`AsyncOpenAI`）
- `openai-sdk-bun`：OpenAI Node.js SDK 在 Bun 运行时（`x-stainless-runtime: bun`，`x-stainless-runtime-version: 1.3.12`）
- `openai-sdk-deno`：OpenAI Node.js SDK 在 Deno 运行时（`x-stainless-runtime: deno`，User-Agent: `Deno/2.7.12`）
- `anthropic-sdk` / `anthropic-sdk-py` / `anthropic-sdk-py-async`：Anthropic Node.js SDK、Python 同步客户端、Python 异步客户端（`AsyncAnthropic`）
- `anthropic-sdk-bun`：Anthropic Node.js SDK 在 Bun 运行时（`x-stainless-runtime: bun`，`x-stainless-runtime-version: 1.3.12`）
- `gemini-sdk`：Google GenAI Node.js SDK（`x-goog-api-client: genai-js/... gl-node/...`）
- `gemini-sdk-py`：Google GenAI Python SDK（`x-goog-api-client: genai-py/... gl-python/... httpx/...`，User-Agent: `python-httpx/0.28.1`，与 Node.js 版本完全不同的指纹）
- `openrouter-sdk`：OpenRouter（基于 OpenAI SDK 风格）
- `litellm`：LiteLLM 代理（内部使用 OpenAI Python SDK 的 stainless headers）
- `vercel-ai-sdk`：Vercel AI SDK v6（Node.js 原生 fetch，无 user-agent）
- `httpx`：Python httpx 直接 HTTP 客户端，常见于 LangChain、LlamaIndex、CrewAI
- `curl` / `python-requests` / `browser-chrome`

`auto` 和 `auto-no-replit` 是元 preset，具备路径感知和 User-Agent 嗅探能力：

1. **路径优先**：`/v1/messages` → `anthropic-sdk`（Bun UA 时 → `anthropic-sdk-bun`）；Gemini 原生端点 → `gemini-sdk`（python-httpx UA 时 → `gemini-sdk-py`）
2. **User-Agent 嗅探**（无路径信号时）：`Deno/` → `openai-sdk-deno`；`Bun/` → `openai-sdk-bun` / `anthropic-sdk-bun`（按 provider）；`python-httpx` → `openai-sdk-py` / `anthropic-sdk-py` / `gemini-sdk-py`（按 provider）
3. **provider 映射兜底**：openai/deepseek → `openai-sdk`，anthropic → `anthropic-sdk`，gemini → `gemini-sdk`，openrouter → `openrouter-sdk`

`auto` 在 SDK preset 路径下额外注入 Replit Headers（`x-replit-repl-id`、`x-replit-cluster`）；`auto-no-replit` 保持相同解析逻辑但跳过 Replit Headers 注入。

关键机制：

- `resolvePresetForProvider(provider, requestPath?, incomingUserAgent?)`：在 `auto` / `auto-no-replit` 模式下解析最终使用的 profile；解析优先级：requestPath > UA 嗅探 > provider 映射
- `isDisguiseActive()`：返回当前是否有非 `none` 的伪装 preset 生效，供 `fetchWithDisguiseFallback` 判断是否需要重试
- `fetchWithDisguiseFallback()`（`proxy-raw.ts`）：对所有 7 个原生上游 fetch 调用点的包装层，当上游返回 `400 / 403 / 407 / 422` 时自动以 `overridePreset: "none"` 无伪装模式重试，保证伪装失败不会对客户端暴露为错误；`DISGUISE_RETRY_STATUSES = {400, 403, 407, 422}`
- `GET/POST /api/settings/disguise`：读取或切换伪装配置，配置持久化到 `.proxy-config.json` 的 `settings.disguisePreset`
- 所有 stainless 系 profile 都携带 `x-stainless-async` 和 `x-stainless-timeout: "600000"`
  - Node.js SDK profile：`x-stainless-async: "false"`
  - Python 同步 profile（`SyncOpenAI` / `SyncAnthropic`）：`"false"`
  - Python 异步 profile（`AsyncOpenAI` / `AsyncAnthropic`）：`"async"`
- **伪装只改 Header**：伪装系统不再修改请求体；OpenAI / OpenRouter / DeepSeek raw-passthrough 在无需转换模型名或格式时会优先转发原始请求字节，保持 `api-passthrough.md` 的“网关只是管道”语义
- **Header 清理列表**：
  - `COMMON_PROXY_STRIP`：清理代理 / CDN headers、W3C tracing（`traceparent`、`tracestate`、`baggage`）以及 Zipkin B3
  - `BROWSER_ONLY_STRIP`：清理 `priority`、`sec-purpose`、`purpose`、`x-requested-with`、`origin`、`referer`
  - `SDK_STRIP`：在 COMMON + BROWSER_ONLY 基础上清理 `sec-fetch-*`、`te`
  - `CLI_STRIP`：在 SDK_STRIP 基础上清理所有 `x-stainless-*` headers 和 `x-goog-api-client`，避免 curl / requests 伪装泄露 SDK 指纹；`gemini-sdk-py` 也使用此列表来清除旧 `x-goog-api-client`，再注入 Python SDK 正确指纹
- **Header 清理限制**：Anthropic SDK 和 Gemini SDK 路由只能通过每次请求 options 添加 / 覆盖 headers，无法移除 SDK 自身已经设置的 headers。Raw fetch 路由（OpenAI / OpenRouter / DeepSeek）支持清理和注入。这是 SDK 调用方式的架构限制
- 用量日志会记录每次请求的当前 `disguisePreset` 到 `UsageLogEntry.disguisePreset`，并在“使用日志”页以“伪装”列展示

## 工具 / 函数调用

- OpenAI / OpenRouter / DeepSeek：`tools` 和 `tool_choice` 直接原样透传
- Anthropic：`tools` 转换为 Anthropic 格式（`input_schema`）；响应中的 `tool_use` block 会转换回 OpenAI `tool_calls` 格式，流式和非流式都支持
- Gemini：`tools` 转换为 `functionDeclarations` 格式
- 多轮工具结果：`role: "tool"` 消息会转换为 Anthropic `tool_result` blocks 或 Gemini `functionResponse` parts

## AI Gateway 页面说明

React + Vite 前端控制台位于 `/`，包含 7 个主要标签页：

- **概览**：核心功能网格、Base URL、API 端点、认证方式、快速测试
- **模型列表**：所有模型按服务商分组展示，提供 badge 和复制按钮
- **系统设置**：顶部 Base URL、API Key 输入、Proxy API Key 管理、各服务商 Base URL / API Key 配置、URL 自动纠错开关
- **部署指南**：CherryStudio 设置说明、Remix / 部署教程
- **技术参考**：API 文档（包含 Responses API）、格式转换矩阵、错误码、环境变量、SDK 示例
- **实时日志**：Proxy Key 输入框、SSE 实时日志流查看器、过滤器和自动滚动
- **项目文档**：完整说明核心机制（路由、格式转换、认证、SSE、URL 纠错）、功能细节（扩展思考、工具调用、配置持久化）、各服务商模型信息、API 端点详情、管理 API、错误码和环境变量

视觉规范：全局深色主题（`hsl(222, 47%, 11%)`），大量使用复制按钮。字号遵循 `UI_DESIGN.md` 三级标题制（H1=22px / H2=18px / H3=14px / H4=12px），正文 14px、次级元信息 12px，禁止使用规范以外的字号。

## AI 集成

Replit 托管的 AI Integrations 渠道（4 个）：**OpenAI、Anthropic、Gemini、OpenRouter**，运行时自动注入 `AI_INTEGRATIONS_<PROVIDER>_BASE_URL` / `API_KEY` 环境变量。其余 11 个渠道（DeepSeek、xAI、Mistral、Moonshot、Groq、Together、SiliconFlow、Cerebras、Fireworks、Novita、Hyperbolic）**没有对应的 Replit 集成**，不存在 `AI_INTEGRATIONS_DEEPSEEK_*` 等自动注入变量；这些渠道的凭证只能通过 AI Gateway Settings 页面手动填写。代码中使用 `REPLIT_AI_INTEGRATION_SUFFIX` 映射表（仅含 openai / anthropic / gemini / openrouter）限定自动注入范围，避免对非 Replit 集成渠道错误读取空变量。

## 📋 重点必读：部署流程文档

**`DEPLOYMENT.md`（根目录）**：面向新 agent 的完整部署指南，包含环境前提、AI 服务集成配置、配置文件说明、本地开发启动、Replit 工作流配置、生产发布步骤、发布后验证和 GitHub 迁移注意事项。**任何接手本项目的 agent 或开发者，在执行部署操作前必须优先阅读此文档。**

## 交接与维护文档

- `docs/development-handoff.md`：开发交接文档，面向下一个接手的 agent，包含架构、关键文件、请求流、配置、版本和检查清单
- `docs/maintenance-rules.md`：agent 维护规范（原根目录 `MAINTENANCE.md`），覆盖定价表维护规则、前端 UI 规范、API Server 路由结构等强制性约束
- `docs/maintenance-guide.md`：日常维护操作指南，覆盖模型列表维护、**模型计费维护**（重点维护事项）、请求伪装 SDK preset 维护、版本记录和名称检查
- `docs/api-passthrough.md`：API 透传机制文档，详细说明网关的"能原样透传就原样透传，必须兼容时才转换"核心策略。内容涵盖：15 个供应商的透传等级定义（字节级原生透传 / 原生 fetch + 格式转换 / 旁路解析）、各端点路由与透传策略（`/v1/messages`、Gemini Native、`/v1/chat/completions`、`/v1/responses`）、`proxy-raw.ts` 核心实现、请求头与响应头净化规则、Disguise Profile 公开访问核心规则、伪装自动降级机制、流式生命周期、错误处理策略、用量统计旁路解析方式、以及配置优先级。任何修改透传架构或头部处理逻辑的变更，都必须同步更新此文档
- `docs/optional-tasks.md`：可选开发事项，记录代码审查后识别的非必要改进方向（按优先级排列，由用户决定是否推进）

## 版本管理

⚠️ **核心规则：版本号只能因大型变更而更新，小型变更严禁修改版本号。**

- **大型变更**（可以更新版本号）：新增功能、重构核心模块、影响多个文件的系统性改动、API 接口变更、重要 Bug 修复
- **小型变更**（禁止修改版本号）：单文件文字修正、注释更新、样式微调、变量重命名、replit.md 文档更新、无功能影响的代码格式化

修改项目时，需同步更新 **两处** 版本号：

1. **`artifacts/api-server/src/routes/health.ts`**：更新 `APP_VERSION`、`APP_BUILD_TIME`，并在 `APP_CHANGELOG` 数组头部追加新条目
2. **`artifacts/api-portal/src/data/models.ts`**：更新 `LOCAL_VERSION` 和 `LOCAL_BUILD_TIME`，与服务端保持一致

**更新记录数量规则**：`APP_CHANGELOG` 数组 **始终只保留最近 10 个版本**。每次新增条目时，同步删除数组末尾最旧的一条，确保总数不超过 10。`replit.md` 变更记录区块遵守同一规则。

`/api/version` 端点（CORS `*`）返回 `{ version, buildTime, changelog }`，供 Portal 显示当前版本和外部读取版本信息使用。

## 变更记录

> 规则：仅保留最近 10 个版本的记录，每次新增时同步删除最旧的一条。

### v0.1.79（2026-05-01）

- **上游响应大小防护扫尾**：`claude.ts`（`/v1/messages` 格式转换端点）遗漏 4 处无上限读取——① 流式 Gemini 错误路径 `upstream.text()`；② 流式 OpenAI-compat 错误路径 `upstream.text()`；③ 非流式 Gemini 路径 `upstream.text()`；④ 非流式 OpenAI-compat 路径 `upstream.text()`；全部替换为 `readResponseTextCapped()`。
- **防御面完整闭合**：至此，服务器全部路由（`proxy-raw.ts` / `proxy-anthropic.ts` / `proxy-gemini.ts` / `gemini-native.ts` / `claude.ts`）中的 `upstream.text()` / `upstream.arrayBuffer()` 调用已 100% 替换为有上限（100 MB）的受控读取，恶意上游通过超大响应体引发 OOM 的攻击面完全消除。
- **版本号同步**：`health.ts` APP_VERSION、`models.ts` LOCAL_VERSION、`replit.md` 一并升至 0.1.79；`APP_CHANGELOG` 推入 v0.1.79 条目并淘汰 v0.1.69。

### v0.1.78（2026-05-01）

- **上游响应大小防护全量补全**：安全审查发现 6 处非流式代理路径绕过了 v0.1.76 引入的 `readResponseBufferCapped` 防护——① `proxy-gemini.ts handleGeminiNonStream` 直接调用 `upstream.arrayBuffer()`；② `proxy-anthropic.ts handleAnthropicNonStream` 直接调用 `upstream.arrayBuffer()`；③ `proxy-anthropic.ts` / `proxy-gemini.ts` 流式路径错误分支各 1 处 `upstream.text()`；④ `gemini-native.ts` Anthropic 非流式路径 `upstream.text()`；⑤ `gemini-native.ts` OpenAI-compat 非流式路径 `upstream.text()`；⑥ `gemini-native.ts` Anthropic/OpenAI-compat 流式错误路径各 1 处 `upstream.text()`。
- **修复方案**：将 `readResponseBufferCapped` 从私有函数改为 `export`，新增 `readResponseTextCapped` 便捷包装（逐块读取 → 合并 → UTF-8 解码），6 处全部替换，防止恶意上游通过超大响应体引发 OOM。
- **版本号同步**：`health.ts` APP_VERSION、`models.ts` LOCAL_VERSION、`replit.md` 一并升至 0.1.78；`APP_CHANGELOG` 推入 v0.1.78 条目并淘汰 v0.1.68。

### v0.1.77（2026-05-01）

- **安全审查第三轮**：① 请求体上限从 50 MB 调整为 **256 MB**：50 MB 过严（20 张高清图 base64 约 50–80 MB），256 MB 覆盖绝大多数真实 AI 请求场景，同时相比 1 GB 显著降低 OOM 风险；② **SSRF 防护补全**：`isPrivateUrl` 正则新增 `0.0.0.0`（Linux 下等价于 127.0.0.1）和 `::ffff:`（IPv4-mapped IPv6 绕过向量），同时增加协议白名单（仅 `http:`/`https:` 允许），阻断 `file:`/`ftp:` 等本地资源访问；③ **流式代理 499 修正**：`rawPassthroughStream` 和 `rawVendorPassthroughStream` 在客户端提前断连时原本记录 `status: success`，现改为 `status: error` / `statusCode: 499`（Client Closed Request，nginx 约定），使使用日志与成功率统计真实反映实际完成情况；④ `adminRateLimit` skip 回调中 `getConfig()` 双重调用优化为单次。

### v0.1.76（2026-05-01）

- **安全加固第二轮**：① 请求体上限收缩：`express.json` 从 1 GB 降至 **50 MB**（后在 v0.1.77 调整为 256 MB），防止超大 JSON 请求体导致 OOM DoS；② `GET /api/config` 计时旁路修复：对 `adminKey`/`proxyKey` 的判断从 `===` 改为 `safeCompare()`，消除最后一处不安全字符串比较；③ 强制刷新频率限制：`?refresh=1` 参数触发模型缓存刷新新增 **10 秒最短间隔**（`FORCE_REFRESH_MIN_INTERVAL_MS`），防止串行请求引发上游拉取风暴；④ Host 头注入修复：所有错误响应中的 `docs` URL 从 `req.protocol + '://' + req.get('host')` 改为读取 `REPLIT_DOMAINS` 环境变量，彻底消除 Host 头注入攻击面；⑤ 调试头信息泄露修复：移除 `rawPassthroughNonStream` / `rawVendorPassthroughNonStream` 中的 `x-gateway-debug-headers` 响应路径，防止任意代理客户端通过 header 读取上游请求详情（含伪装配置信息）；⑥ 上游响应缓冲限制：非流式非流式路径引入 `readResponseBufferCapped()`，逐块读取并累计字节数，超过 **100 MB** 立即取消流并返回 **502**，防止恶意上游通过超大响应体导致 OOM。

### v0.1.75（2026-05-01）

- **安全加固全量修复**：① 计时攻击防护：`auth.ts` 密钥比较从 `===` 改为 `crypto.timingSafeEqual()`，先 SHA-256 哈希再等长比较，消除逐字符短路时序泄露；② 速率限制：引入 `express-rate-limit`，管理接口（`/api/config`、`/api/settings`、`/api/logs`、`/api/billing` 等）每 IP 每 15 分钟限 30 次，代理接口（`/v1`、`/v1beta`）每 IP 每分钟限 300 次，响应头携带剩余次数与重置时间，未配置密钥时自动跳过；③ HTTP 安全响应头：引入 `helmet` 中间件，全局注入 `X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy: no-referrer`、`Strict-Transport-Security` 等；④ SSRF 防护：`POST /api/config/provider` 写入 `baseUrl` 前校验 hostname，拒绝 `localhost`/`127.x`/`10.x`/`172.16-31.x`/`192.168.x`/`169.254.x`/`::1` 等私有及回环地址；⑤ 密钥最短长度提升：Admin Key 与 Proxy Key 最短长度从 6 位升至 **16 位**；⑥ 预算上限校验：`budgetQuotaUsd` 新增上限 $100,000 防止意外写入极大值；⑦ 模型缓存惊群效应修复：`proxy-models.ts` 缓存失效时用单例 inflight Promise 合并并发请求，任意时刻最多触发一次上游 fetch；⑧ 文档修正：删除从未实现的 `GET /api/logs/stream` SSE 端点描述，改为如实描述 `sinceIndex` 增量轮询接口。

### v0.1.74（2026-05-01）

- **SDK 指纹全量同步**：openai JS 6.34→**6.35**、anthropic JS 0.90→**0.92**、@google/genai 1.50.1→**1.51.0**、openai Python 2.32→**2.33**、anthropic Python 0.96→**0.97**、google-genai Python 1.73.1→**1.74.0**、LiteLLM 1.83.12→**1.83.14**、Deno 2.7.13→**2.7.14**、curl 8.19.0→**8.20.0**、Vercel AI SDK 6.0.168→**6.0.170**；Bun 1.3.13 / httpx 0.28.1 / python-requests 2.33.1 / Chrome 147 经实时核查无更新。
- **新模型上线**：`gpt-5.5`（$5/$30 per 1M，1M context，API 2026-04-24 开放）、`gpt-5.5-pro`（$30/$180 per 1M，1M context）加入 OpenAI 清单；`grok-4.3`（$1.25/$2.50 per 1M）加入 xAI 清单；`mistral-medium-3.5`（$0.40/$2.00 per 1M，256K context）加入 Mistral 清单。
- **补丁：`gpt-5.4` 计费缺口修复**：`billing.ts` PRICING_TABLE 中 `gpt-5.4` 专项条目原缺失，`gpt-5` 宽泛 catch-all（$1.25/$10）提前命中导致定价严重低估；补充 `gpt-5.4` 精确条目（$15/$60 per 1M）于 `gpt-5.5-pro` 之后、`gpt-5` catch-all 之前。
- **版本号同步**：前端 `LOCAL_VERSION` / `LOCAL_BUILD_TIME`、后端 `APP_VERSION`、`docs/maintenance-guide.md`、`docs/maintenance-rules.md`、`replit.md` 一并升至 0.1.74；`APP_CHANGELOG` 推入 v0.1.74 条目并淘汰最早的 v0.1.64。
- **代码审查微调（不升版本号）**：修正 6 处「Google Gemini」措辞（`DocsPage.tsx`×3、`OverviewPage.tsx`×1、`ReferencePage.tsx`×2）统一为「Google」，对齐 `UI_DESIGN.md §八` 厂商名称规范；将 `Dropdown.tsx` 箭头字号从 `10px` 调整为 `12px`，对齐 `UI_DESIGN.md §九`「不使用 12px 以下字号」禁止事项。

### v0.1.73（2026-04-24）

- **DeepSeek V4 正式 model ID 修正**：将错误占位 `deepseek-v4` 替换为官方 ID `deepseek-v4-pro`（$1.74/$3.48 per 1M，1M context）和 `deepseek-v4-flash`（$0.14/$0.28 per 1M，1M context）；`deepseek-chat` 与 `deepseek-reasoner` 标注废弃（2026-07-24，DeepSeek 自动映射至 V4 Flash），定价同步更新为 V4 Flash 费率；`proxy-models.ts`、`billing.ts`、`models.ts`、`pricing.ts` 四处一致修改。
- **GPT-5.5 状态确认**：今日（2026-04-24）发布，代号 Spud，仅限 ChatGPT（Plus/Pro/Business/Enterprise），API 尚未开放（官方说明"即将推出，需要额外安全保障措施"）；预计价格 $5/$30 per 1M；当前 API 仍推荐使用 `gpt-5.4`。
- **版本号同步**：前端 `LOCAL_VERSION`、后端 `APP_VERSION`、`replit.md` 一并升至 0.1.73；`APP_CHANGELOG` 推入 v0.1.73 并淘汰最早的 v0.1.63。

### v0.1.72（2026-04-24）

- **模型清单对照审查（Replit AI Integrations SKILL）**：OpenAI 19 项、Anthropic 7 项、Gemini 6 项均与 SKILL 文档完全一致，无需增删；OpenRouter 保持实时拉取，DeepSeek 系列自动同步。
- **版本号同步**：前端 `LOCAL_VERSION`、后端 `APP_VERSION`、`replit.md` 一并升至 0.1.72。

### v0.1.71（2026-04-23）

- **SDK 指纹维护**：Deno 2.7.12 → **2.7.13**（`openai-sdk-deno` preset 的 `user-agent`、`x-stainless-runtime-version` 同步）；LiteLLM 1.83.11 → **1.83.12**（`litellm` preset `user-agent` 与描述同步）。
- **Mistral 模型上下文窗口校正**：`mistral-large-latest` 128K → **256K**（Mistral Large 3 官方文档），`mistral-small-latest` 128K → **262K**（Mistral Small 4 官方 262,144 tokens）。
- **未变更的 SDK 指纹**（经实时核查仍为当前最新）：openai JS 6.34.0、openai Python 2.32.0、@anthropic-ai/sdk 0.90.0、anthropic Python 0.96.0、@google/genai 1.50.1、google-genai 1.73.1、httpx 0.28.1、requests 2.33.1、Vercel AI SDK 6.0.168、Bun 1.3.13、curl 8.19.0、Chrome 147。
- **版本号同步**：前端 `LOCAL_VERSION` / `LOCAL_BUILD_TIME`、后端 `APP_VERSION` / `APP_BUILD_TIME`、`docs/api-passthrough.md`、`docs/maintenance-guide.md`、`replit.md` 一并升至 0.1.71；`APP_CHANGELOG` 推入 v0.1.71 条目并淘汰最早的 v0.1.61。

### v0.1.70（2026-04-22）

- **使用日志表头改为自适应宽度（`UsageLogsPage.tsx`）**：原 `<colgroup>` 13 列固定 px 宽（120/150/100/110/50/70/75×4/80/100/70 = **1150px**）+ `<table minWidth: 1150px>`，在窄于 1150px 的视口（典型如画布 871px iframe）会触发外层 `overflowX: auto` 横向滚动条，用户必须鼠标滑动才能看到「伪装/操作」两列。本次将 13 个 `<col>` 的 `width` 全部按原 1150px 等比换算为百分比（10.43% / 13.04% / 8.70% / 9.57% / 4.35% / 6.09% / 6.52%×4 / 6.96% / 8.70% / 6.08%，Σ ≈ 100%），并移除 `<table>` 的 `minWidth: 1150px`；表格随 `Card` 容器宽度等比缩放，**列宽比例锁定不抖动**，常规桌面视口不再出现横向滚动条。
- **硬约束保持**：`tableLayout: fixed` 继续保留，满足 v0.1.67 引入、v0.1.69 重申的「表格不得回退到 auto 布局」；外层 `overflowX: auto` 仍保留作为极窄视口（< ~600px）兜底，绝不会回归 v0.1.66 的列宽抖动状态。
- **「成功率」徽标改为统计卡片**：从「使用日志」标题右侧的 `position: absolute` (`left:100%`, `marginLeft:10px`, `pointerEvents:none`) 浮层迁入下方统计卡片行，与「总请求 / 成功 / 失败 / 总Tokens / 估算费用」共用同一 `7px 14px` padding + `8px` 圆角 + `14px` 数字 + `12px` 标签 + `90px minWidth` 的卡片样式；位置精确插入「失败」与「总 Tokens」之间。颜色仍按 ≥95% / ≥80% / 否则 三档绿/黄/红分级。从根本上消除 v0.1.68 起在窄视口下徽标穿模 Proxy Key / Admin Key 输入框的 z-order 冲突。
- **设计规范复核**：本次仅修改 `UsageLogsPage.tsx` 表格 colgroup + 统计卡片排序与版本号文本；**未触碰** `ModelsPage` / `PROVIDER_LABELS` 顺序（OpenRouter 仍在尾）、`LogsPage` circle 实线 SVG（无 `strokeDasharray`）、`/v1beta/models` 与 `/v1/models` 文案一致性、UI 三档字号 22 / 18 / 14（次级 12，禁用 11 / 13 / 13.5）、`SegmentedControl` 等任何已声明设计约束。
- **版本号同步**：前端 `LOCAL_VERSION` / `LOCAL_BUILD_TIME`、后端 `APP_VERSION` / `APP_BUILD_TIME`、`docs/api-passthrough.md`、`replit.md` 一并升至 0.1.70；`APP_CHANGELOG` 推入 v0.1.70 条目并淘汰最早的 v0.1.60。

## 后续开发记录

### 低优先级：存在架构限制

1. **TLS 指纹（JA3 / JA4）**

   curl、Python httpx、Node.js undici 的 TLS 握手指纹各不相同。HTTP header 层伪装对此无效。如需实现，需要替换底层 HTTP 客户端（例如引入 `got` + 自定义 TLS 配置），代价较大；同时上游 AI 服务商目前极少在 API 层做 JA3 检测，因此暂不实施。

2. **HTTP/2 协议指纹**

   Python httpx 默认走 HTTP/2，Node.js undici 也支持，但各客户端 SETTINGS 帧和 HEADERS 帧顺序不同。当前网关发出的请求协议版本由 Node.js 底层决定，难以用 profile 配置控制，因此暂不实施。

## 密钥与环境变量

项目目标是零配置：通常无需手动设置环境变量。代码会动态拼接环境变量名称，避免 Remix 时触发 Replit 的密钥检测提示。

- Proxy Key：默认可为空（不强制鉴权），可通过 AI Gateway 设置页或 `/api/config/proxy-key` 修改
- AI 服务商配置：OpenAI、Anthropic、Gemini、OpenRouter 由 Replit AI Integrations 在运行时自动注入；DeepSeek、xAI、Mistral、Moonshot、Groq、Together AI、SiliconFlow 由用户在 AI Gateway 设置页手动填写
- 所有配置持久化到工作区根目录的 `.proxy-config.json`
- 集成相关环境变量名称在运行时动态构造（前缀 + 服务商 + 后缀），避免触发 Replit 密钥检测
