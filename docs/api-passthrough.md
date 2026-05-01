# API 透传机制文档

> 当前实现版本：`0.1.71`

## 概述

本网关对上游 AI 供应商采用“能原样透传就原样透传，必须兼容时才转换”的策略。

- **原生格式 / 同供应商路径**：请求体尽量使用客户端提交的原始字节转发，上游响应字节直接写回客户端。网关只负责认证、必要的安全头处理、连接生命周期管理和旁路 usage 统计。
- **OpenAI 兼容直连路径**：OpenAI / OpenRouter / DeepSeek / xAI / Mistral / Moonshot / Groq / Together / SiliconFlow / Cerebras / Fireworks / Novita / Hyperbolic 的 `/v1/chat/completions` 以及 OpenAI `/v1/responses` 使用原生 `fetch` 直连上游，成功与错误响应体都按上游字节返回。
- **跨格式兼容路径**：例如 OpenAI 格式请求 Claude/Gemini，或 Claude/Gemini 原生格式请求其它供应商。此类路径必须进行格式转换，因此不会承诺响应字节级原样返回；但上游调用仍使用原生 `fetch`，不经任何官方 SDK。

所有上游请求均通过 Node.js 原生 `fetch` 发出，不使用 OpenAI / Anthropic / Gemini SDK，避免 SDK 层额外序列化、事件重组和隐藏重试逻辑。

---

## 支持的供应商

| 供应商 | Provider Key | 默认 Base URL | 备注 |
|---|---|---|---|
| OpenAI | `openai` | 通过 `AI_INTEGRATIONS_OPENAI_BASE_URL` 或 Settings 配置 | `/chat/completions`、`/responses` 直连透传 |
| Anthropic | `anthropic` | `https://api.anthropic.com` | `/v1/messages` 同供应商时字节级透传 |
| Google Gemini | `gemini` | `https://generativelanguage.googleapis.com` | Gemini Native 同供应商时字节级透传 |
| DeepSeek | `deepseek` | `https://api.deepseek.com/v1` | OpenAI 兼容格式直连透传；只需配置 API Key |
| xAI | `xai` | `https://api.x.ai/v1` | OpenAI 兼容格式直连透传 |
| Mistral AI | `mistral` | `https://api.mistral.ai/v1` | OpenAI 兼容格式直连透传 |
| Moonshot AI | `moonshot` | `https://api.moonshot.cn/v1` | OpenAI 兼容格式直连透传 |
| Groq | `groq` | `https://api.groq.com/openai/v1` | 本地模型名使用 `groq/` 前缀，转发前剥离 |
| Together AI | `together` | `https://api.together.xyz/v1` | 本地模型名使用 `together/` 前缀，转发前剥离 |
| SiliconFlow | `siliconflow` | `https://api.siliconflow.cn/v1` | 本地模型名使用 `siliconflow/` 前缀，转发前剥离 |
| Cerebras | `cerebras` | `https://api.cerebras.ai/v1` | 本地模型名使用 `cerebras/` 前缀，转发前剥离 |
| Fireworks AI | `fireworks` | `https://api.fireworks.ai/inference/v1` | 本地模型名使用 `fireworks/` 前缀，转发前剥离 |
| Novita AI | `novita` | `https://api.novita.ai/v3/openai` | 本地模型名使用 `novita/` 前缀，转发前剥离 |
| Hyperbolic | `hyperbolic` | `https://api.hyperbolic.xyz/v1` | 本地模型名使用 `hyperbolic/` 前缀，转发前剥离 |
| OpenRouter | `openrouter` | 通过 `AI_INTEGRATIONS_OPENROUTER_BASE_URL` 或 Settings 配置 | OpenAI 兼容格式直连透传；剩余含 `/` 的模型名默认路由到此处 |

---

## 模型名到供应商的路由规则

**文件**：`artifacts/api-server/src/lib/providers.ts`（`detectProvider` 函数）

| 匹配规则 | 目标供应商 | 说明 |
|---|---|---|
| 前缀 `gpt-` | `openai` | 全部 GPT 系列 |
| 正则 `/^o\d/`（即 o1/o3/o4 等开头） | `openai` | o-series 推理模型及 thinking 别名（如 o3-mini、o4-mini） |
| 前缀 `claude-` | `anthropic` | 全部 Claude 系列 |
| 前缀 `gemini-` | `gemini` | 全部 Gemini 系列 |
| 前缀 `deepseek-`（不含 `/`） | `deepseek` | DeepSeek 官方直连 API |
| 前缀 `grok-`（不含 `/`） | `xai` | xAI 官方直连 API |
| 前缀 `mistral-` / `mixtral-` / `codestral-` / `devstral-` / `voxtral-` / `ministral-`（不含 `/`） | `mistral` | Mistral 官方直连 API |
| 前缀 `moonshot-` / `kimi-`（不含 `/`） | `moonshot` | Moonshot 官方直连 API |
| 前缀 `groq/` | `groq` | Groq OpenAI 兼容 API，转发前剥离前缀 |
| 前缀 `together/` | `together` | Together AI OpenAI 兼容 API，转发前剥离前缀 |
| 前缀 `siliconflow/` | `siliconflow` | SiliconFlow OpenAI 兼容 API，转发前剥离前缀 |
| 前缀 `cerebras/` | `cerebras` | Cerebras OpenAI 兼容 API，转发前剥离前缀 |
| 前缀 `fireworks/` | `fireworks` | Fireworks AI OpenAI 兼容 API，转发前剥离前缀 |
| 前缀 `novita/` | `novita` | Novita AI OpenAI 兼容 API，转发前剥离前缀 |
| 前缀 `hyperbolic/` | `hyperbolic` | Hyperbolic OpenAI 兼容 API，转发前剥离前缀 |
| 包含 `/` 的其它任意模型名 | `openrouter` | 全部 OpenRouter 模型（含 deepseek/...、anthropic/... 等） |
| 其它 | 返回错误 | 未知模型名，网关返回 400 并列出近似候选 |

> **注意**：所有本地命名空间通道和 DeepSeek 直连路由必须在 OpenRouter catch-all 之前判断。若使用 OpenRouter 的 DeepSeek 模型，应使用 `deepseek/deepseek-chat` 等带斜线格式。

---

## 透传等级定义

| 等级 | 适用路径 | 请求体 | 响应体 | 是否转换格式 |
|---|---|---|---|---|
| **字节级原生透传** | Anthropic→Anthropic、Gemini→Gemini、OpenAI 兼容通道直连、OpenAI Responses | 优先使用 `req.rawBody` | 上游字节直接写回 | 否 |
| **原生 fetch + 格式转换** | OpenAI↔Anthropic、OpenAI↔Gemini、Claude/Gemini Native 跨供应商 | 构造目标供应商对象后发送 | 解析上游响应并转换为客户端期望格式 | 是 |
| **旁路解析** | usage 统计、首 token 计时 | 不修改请求 | 读取副本/文本片段提取 token | 否，不能影响输出字节 |

关键约束：

1. 字节级透传路径不能 `res.json()` 重序列化上游响应。
2. 字节级流式路径不能追加本地 `[DONE]`，也不能重组 SSE 块。
3. usage 统计只能作为旁路解析，不能改变客户端收到的任何字节。
4. 所有上游请求强制 `Accept-Encoding: identity`，避免压缩响应破坏“已解码 body + 原始响应头”的一致性。

---

## 端点路由与透传策略

### 1. `/v1/messages` — Anthropic Messages 原生格式

**文件**：`artifacts/api-server/src/routes/claude.ts`

| 模型归属 | 策略 |
|---|---|
| `provider === "anthropic"` | **字节级原生透传**：请求体与响应体不做格式转换 |
| `provider === "gemini"` | Claude 格式转换为 Gemini 格式，用原生 `fetch` 调 Gemini，再转回 Claude 格式 |
| OpenAI 兼容通道 | Claude 格式转换为 OpenAI Chat Completions 格式，用原生 `fetch` 调上游，再转回 Claude 格式 |

Anthropic 同供应商透传流程：

```text
客户端 POST /v1/messages
  │  请求体：Anthropic Messages JSON（优先使用 req.rawBody 原始字节）
  ▼
网关注入目标供应商认证头：
  x-api-key: <ANTHROPIC_API_KEY>
  anthropic-version: 2023-06-01
  Accept-Encoding: identity
  │
  ▼
fetch → https://api.anthropic.com/v1/messages
  │
  ▼
上游状态码 + 安全响应头 + 原始响应字节写回客户端
```

不会发生 JSON 解析后的字段重排、事件重组或本地 `[DONE]` 追加。

---

### 2. `/v1beta/models/:model::action` — Gemini Native 原生格式

**文件**：`artifacts/api-server/src/routes/gemini-native.ts`

支持的 action：

- `generateContent`（非流式）
- `streamGenerateContent`（SSE 流式）
- `stream`（`streamGenerateContent` 的简写别名，部分 SDK 版本会使用此形式）

| 模型归属 | 策略 |
|---|---|
| `provider === "gemini"` | **字节级原生透传**：请求体与响应体不做格式转换 |
| `provider === "anthropic"` | Gemini 格式转换为 Anthropic 格式，用原生 `fetch` 调 Claude，再转回 Gemini 格式 |
| OpenAI 兼容通道 | Gemini 格式转换为 OpenAI Chat Completions 格式，用原生 `fetch` 调上游，再转回 Gemini 格式 |

Gemini 同供应商透传流程：

```text
客户端 POST /v1beta/models/gemini-2.5-flash:streamGenerateContent
  │  请求体：Gemini generateContent JSON（优先使用 req.rawBody 原始字节）
  ▼
网关注入目标供应商认证头：
  x-goog-api-key: <GEMINI_API_KEY>
  Accept-Encoding: identity
  │
  ▼
fetch → https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent
  │
  ▼
上游状态码 + 安全响应头 + 原始响应字节写回客户端
```

---

### 3. `/v1/chat/completions` — OpenAI 兼容格式主入口

**文件**：`artifacts/api-server/src/routes/proxy.ts`、`proxy-raw.ts`、`proxy-anthropic.ts`、`proxy-gemini.ts`

客户端通常以 OpenAI Chat Completions 格式请求。网关根据 `model` 自动检测目标供应商并路由。

| 目标供应商 | 策略 |
|---|---|
| `openai` | **字节级原生透传**到 `{openai_base}/chat/completions` |
| OpenAI 兼容通道 | **字节级原生透传**到 `{provider_base}/chat/completions` |
| `anthropic` | OpenAI 格式转换为 Anthropic Messages 格式，再将响应转回 OpenAI Chat Completions 格式 |
| `gemini` | OpenAI 格式转换为 Gemini generateContent 格式，再将响应转回 OpenAI Chat Completions 格式 |

OpenAI 兼容通道直连流程：

```text
客户端 POST /v1/chat/completions
  │  OpenAI-compatible JSON
  ▼
网关注入目标供应商认证头：
  Authorization: Bearer <API_KEY>
  Accept-Encoding: identity
  │
  ▼
fetch → {provider_base_url}/chat/completions
  │
  ▼
上游状态码 + 安全响应头 + 原始响应字节写回客户端
```

特殊情况：

- 如果请求体是 Gemini 风格（有 `contents` 且没有 `messages`），入口会先自动转换为 OpenAI messages，再继续路由。
- OpenAI o-series 的 `-thinking` / `-thinking-visible` 后缀会被剥离为真实上游模型名，因此这类请求会重建请求体。
- 只有在无需改写模型名、请求是标准 `messages` 且没有 `contents` 时，OpenAI-compatible 直连路径才会直接使用 `req.rawBody`。

---

### 4. `/v1/responses` — OpenAI Responses API 透传入口

**文件**：`artifacts/api-server/src/routes/proxy.ts`

`/v1/responses` 用于只支持 Responses API 的 OpenAI / Codex 模型。

| 目标供应商 | 策略 |
|---|---|
| `openai` | **字节级原生透传**到 `{openai_base}/responses` |
| 其它供应商 | 不参与该端点路由 |

流程：

```text
客户端 POST /v1/responses
  │  OpenAI Responses API JSON（优先使用 req.rawBody）
  ▼
fetch → {openai_base}/responses
  │
  ▼
上游状态码 + 安全响应头 + 原始响应字节写回客户端
```

---

## 核心实现：`proxy-raw.ts`

所有透传基础设施集中在 `artifacts/api-server/src/routes/proxy-raw.ts`。

### 认证与 URL 构建

```typescript
getAnthropicCredentials()          // 读取 config / 环境变量 / 默认 Base URL
getGeminiCredentials()             // 读取 config / 环境变量 / 默认 Base URL
getProviderCredentials(provider)   // OpenAI / OpenRouter / DeepSeek / xAI / Mistral / Moonshot / Groq / Together / SiliconFlow / Cerebras / Fireworks / Novita / Hyperbolic

getAnthropicMessagesUrl(baseUrl)   // → {base}/v1/messages
getGeminiModelUrl(baseUrl, model, action)  // → {base}/v1beta/models/{model}:{action}

buildAnthropicHeaders(apiKey)      // { x-api-key, anthropic-version }
buildGeminiHeaders(apiKey)         // { x-goog-api-key }
```

### 通用透传函数

```typescript
// 原生格式端点：Anthropic /v1/messages、Gemini generateContent / streamGenerateContent
rawVendorPassthroughStream(url, vendorHeaders, body, res, ...)
rawVendorPassthroughNonStream(url, vendorHeaders, body, res, ...)

// OpenAI-compatible 直连端点：OpenAI / OpenRouter / DeepSeek /chat/completions、OpenAI /responses
rawPassthroughStream(baseUrl, apiKey, endpoint, body, res, ...)
rawPassthroughNonStream(baseUrl, apiKey, endpoint, body, res, ...)

// 跨格式路径使用的原生 HTTP fetch（无 SDK）
fetchAnthropicRaw(baseUrl, apiKey, body)
fetchGeminiRaw(baseUrl, apiKey, model, action, body)
fetchOpenAICompatibleRaw(baseUrl, apiKey, endpoint, body, provider)

// 上层封装：自动读取凭据、校验配置、构造必要 body
streamRawProvider(provider, body, messages, res, ...)
nonStreamRawProvider(provider, body, messages, res, ...)
```

### SSE 解析器

```typescript
parseOpenAISSE(body)      // AsyncGenerator<Record<string, unknown>>
parseAnthropicSSE(body)   // AsyncGenerator<{ eventType, data }>
parseGeminiSSE(body)      // AsyncGenerator<Record<string, unknown>>
```

解析规则：

- 按标准 SSE 事件块解析，空行分隔事件。
- 同时支持 `\n` 和 `\r\n`。
- 支持一个事件内多行 `data:` 字段，并按 SSE 规则用换行拼接。
- 支持流末尾没有空行时的残留块 flush。
- `[DONE]` 只作为解析终止信号处理；raw 透传路径不会追加本地 `[DONE]`。

用途边界：

- 跨格式路径：解析上游 SSE，并转换为客户端端点所需格式。
- usage 统计：旁路读取文本片段提取 token。
- 字节级透传路径：不使用这些解析器重写输出，仍直接 `res.write(Buffer.from(value))`。

---

## 请求体透传

Express 在 JSON 解析阶段通过 `verify` 钩子捕获原始请求字节并保存为 `req.rawBody`。

优先使用 `req.rawBody` 的路径：

- Anthropic `/v1/messages` 且目标模型归属 Anthropic。
- Gemini Native `generateContent` / `streamGenerateContent` 且目标模型归属 Gemini。
- OpenAI / OpenRouter / DeepSeek `/v1/chat/completions` 直连，且请求无需改写模型名或从 Gemini `contents` 转换。
- OpenAI `/v1/responses`。

会重建请求体的路径：

- 任意跨格式转换路径。
- Gemini 风格请求体自动转 OpenAI messages 的路径。
- OpenAI o-series thinking alias 需要剥离模型后缀的路径。

设计目的：避免在真正原生透传路径中因 `JSON.stringify()` 导致字段顺序、空白、数字文本表示或未知字段发生变化。

---

## 请求头与响应头处理

### 上游请求头

网关会转发安全的客户端语义头，例如：

- `content-type`
- `accept`
- 其它非敏感自定义业务头

以下请求头不会转发给上游：

```text
host, connection, content-length, content-encoding, accept-encoding,
authorization, x-api-key, x-goog-api-key, anthropic-version,
cookie, set-cookie,
proxy-authenticate, proxy-authorization,
te, trailer, transfer-encoding, upgrade,
forwarded, via,
x-forwarded-for, x-forwarded-host, x-forwarded-port, x-forwarded-proto, x-real-ip,
cf-connecting-ip, cf-ipcountry, cf-ray, cf-visitor, cdn-loop
```

随后网关注入目标供应商所需认证头：

- OpenAI / OpenRouter / DeepSeek：`Authorization: Bearer <API_KEY>`
- Anthropic：`x-api-key` + `anthropic-version`
- Gemini：`x-goog-api-key`

所有上游请求都会强制：

```text
Accept-Encoding: identity
```

原因：Express 可能已经解析/解压请求体；继续转发客户端原始 `content-encoding` 或接受 gzip/br 响应，都会破坏字节级透传的一致性。

### Disguise Profile 列表访问规则（核心规则）

`GET /api/settings/disguise` **不需要 Admin Key 认证**。Profile 列表（preset ID、label、desc、headers 字段）属于只读元数据，前端设置页必须在任何情况下都能加载并展示完整列表，无论是否已配置 Admin Key。

- `POST /api/settings/disguise`（切换 preset）仍然需要 Admin Key 认证。
- 后端该路由**不得**加 `adminAuth` 中间件。
- 前端该请求的 `useEffect` **不得**以 `adminKey` 是否存在作为 early-return 条件，且请求中**不得携带** `Authorization` / Admin Key，避免错误 Key 影响公开只读列表。
- 前端必须保留本地只读兜底 Profile 列表；即使接口失败，也必须显示模式清单，仅禁止切换操作。

### 伪装系统与头部净化

所有上游请求在发出前会经过 `applyPassthroughDisguise()`：

1. 先通过 `applyDisguiseToFetch()` 注入选定 SDK / 工具 preset 的请求头指纹。
2. 再恢复网关注入的认证头和 `content-type`。
3. 再次清理逐跳头、压缩头、代理链路头等不应出站的头。
4. 最后强制 `Accept-Encoding: identity`。

特别注意：`anthropic-version` 在入站请求中会被剔除，但网关为 Anthropic 上游注入的 `anthropic-version` 必须保留。

### 伪装自动降级（Disguise Fallback）

**文件**：`artifacts/api-server/src/routes/proxy-raw.ts`，`fetchWithDisguiseFallback()`

当伪装 preset 不为 `none` 时，所有 7 个原生上游 fetch 调用点都通过 `fetchWithDisguiseFallback()` 发出请求。其行为如下：

1. 以当前 preset 的 Header 指纹正常发出请求。
2. 如果上游返回 `400 / 403 / 407 / 422`，认为伪装 Header 可能被上游拒绝。
3. 耗尽失败响应体（释放 socket），以 `overridePreset: "none"` 重新发出请求，完全移除伪装 Header。
4. 如果重试成功，返回不带伪装的响应；如果重试同样失败，直接返回重试的上游响应。

降级仅在 `auto` 模式或任意具体 preset（非 `none`）下生效；如果 preset 已经是 `none`，则不触发重试逻辑。

相关常量：`DISGUISE_RETRY_STATUSES = {400, 403, 407, 422}`。

### 上游响应头

上游响应头会转发给客户端，但以下逐跳 / 长度 / 编码相关响应头不会转发：

```text
connection, content-encoding, content-length, keep-alive,
proxy-authenticate, proxy-authorization,
te, trailer, transfer-encoding, upgrade
```

实现见 `forwardUpstreamHeaders()`。

---

## 流式生命周期

字节级流式透传路径遵循以下生命周期：

1. 发起上游 `fetch`。
2. 如果上游返回非 2xx：读取上游响应体，按上游状态码、响应头和响应字节返回客户端。
3. 如果上游没有 `body`：返回 `502`，错误码 `empty_response`。
4. 如果上游有流式 body：
   - 设置客户端状态码为上游状态码；
   - 转发安全响应头；
   - 对每个 chunk 直接 `res.write(Buffer.from(value))`；
   - 同时旁路解析 usage 和首 token 时间；
   - 上游流结束后调用 `res.end()`；
   - 客户端断开时尝试 `reader.cancel()`，停止继续读取上游。

跨格式流式路径会设置对应端点需要的 SSE 响应头，并把解析后的上游事件转换为客户端端点格式。

---

## 错误处理策略

### 字节级透传路径

字节级透传路径遵循“上游错误透明”：

- 上游返回 `400/401/403/429/5xx` 时，网关保留上游状态码。
- 上游错误响应体以原始字节返回，不 `res.json()` 包装。
- usage 日志记录错误状态和错误文本，但不影响响应。

### 跨格式转换路径

跨格式路径无法原样返回上游格式，因为客户端期待的是另一种 API 格式。因此策略是：

- 尽量保留上游 HTTP 状态码，尤其是 `4xx` 和 `429`。
- 将错误包装为当前端点的错误结构：
  - Claude 端点：`{ type: "error", error: { type, message } }`
  - Gemini Native 端点：`{ error: { code, message, status } }`
  - OpenAI Chat Completions 端点：OpenAI-compatible error SSE / JSON
- 错误类型会按状态码映射：
  - `401/403`：认证错误
  - `429`：限流错误
  - `400-499`：请求参数 / 客户端错误
  - `500+`：上游或服务端错误

### 本地配置错误

在发起上游请求前会校验 Base URL 和 API Key：

- OpenAI / OpenRouter：需要 Base URL + API Key。
- Anthropic / Gemini：有默认 Base URL，但仍需要 API Key。
- DeepSeek：默认 Base URL 为 `https://api.deepseek.com/v1`，实际只需要用户配置 API Key。

---

## 用量统计（Usage Tokens）

即使是字节级透传，网关也会尝试从响应中提取 token 用量用于日志记录和费用估算。

| 格式 | 输入 token 字段 | 输出 token 字段 |
|---|---|---|
| OpenAI / OpenRouter / DeepSeek Chat Completions | `usage.prompt_tokens` | `usage.completion_tokens` |
| OpenAI Responses API | `usage.input_tokens` | `usage.output_tokens` |
| Anthropic | `usage.input_tokens` | `usage.output_tokens` |
| Gemini | `usageMetadata.promptTokenCount` | `usageMetadata.candidatesTokenCount` |

实现要点：

- 非流式：读取响应副本解析 usage，然后把原始 response buffer 发回客户端。
- 流式：维护文本 buffer，只解析完整 SSE 事件块；usage JSON 跨 chunk 时不会丢失。
- usage 解析失败不会影响请求成功或响应字节。

---

## 配置优先级

凭据优先级从高到低：

1. Portal Settings 页面写入的 `.proxy-config.json`。
2. 环境变量：`AI_INTEGRATIONS_<PROVIDER>_BASE_URL` / `AI_INTEGRATIONS_<PROVIDER>_API_KEY`。
   - 仅适用于 Replit 托管的 4 个集成渠道：**OPENAI / ANTHROPIC / GEMINI / OPENROUTER**，由 Replit 平台在运行时自动注入。
   - DeepSeek、xAI、Mistral、Moonshot、Groq、Together、SiliconFlow、Cerebras、Fireworks、Novita、Hyperbolic **没有对应的 Replit 集成渠道**，不会自动注入任何 `AI_INTEGRATIONS_*` 变量；这些渠道的凭证只能通过第 1 步（Settings 页面）手动配置。
3. 供应商默认 Base URL：Anthropic、Gemini、DeepSeek 等非 OpenAI 渠道均有内置默认值；OpenAI / OpenRouter 通常需要配置 Base URL（由 Replit AI Integrations 自动提供）。

---

## 设计原则小结

1. **真实原生路径保持字节级透明**：不重序列化请求或响应，不重组 SSE，不追加本地结束块。
2. **跨格式路径明确转换边界**：只在协议兼容需要时解析和转换，并尽量保留上游错误状态。
3. **零 SDK 开销**：所有上游调用使用原生 `fetch`。
4. **Header 安全净化**：不泄露代理链路、Cookie、客户端认证头或错误压缩声明。
5. **显式失败**：缺少配置、空上游响应、上游错误都返回明确状态和错误信息。
6. **旁路统计不改变响应**：usage、首 token、日志与费用估算都不能影响客户端收到的字节。
