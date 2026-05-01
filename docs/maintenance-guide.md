# AI Gateway 日常维护文档

## 维护范围

本文档覆盖 AI Gateway 的日常维护流程，重点包括：

- 模型列表维护
- **模型计费维护**（重点，详见下文专节）
- 请求伪装 SDK preset 维护
- 版本记录维护
- 基本运行检查

## 当前模型清单概况

前端本地兜底清单位于 `artifacts/api-portal/src/data/models.ts`，当前分布为：

| 服务商 | 前端展示数组 | 当前数量 |
|---|---|---:|
| OpenAI | `OPENAI_MODELS` | 25 |
| Anthropic | `ANTHROPIC_MODELS` | 19 |
| Gemini | `GEMINI_MODELS` | 12 |
| DeepSeek | `DEEPSEEK_MODELS` | 4 |
| xAI | `XAI_MODELS` | 10 |
| Mistral | `MISTRAL_MODELS` | 16 |
| Moonshot | `MOONSHOT_MODELS` | 6 |
| Groq | `GROQ_MODELS` | 17 |
| Together AI | `TOGETHER_MODELS` | 19 |
| SiliconFlow | `SILICONFLOW_MODELS` | 20 |
| Cerebras | `CEREBRAS_MODELS` | 2 |
| Fireworks AI | `FIREWORKS_MODELS` | 7 |
| Novita AI | `NOVITA_MODELS` | 6 |
| Hyperbolic | `HYPERBOLIC_MODELS` | 6 |
| OpenRouter | `OPENROUTER_MODELS`（已清空，改由 `useLiveOpenRouterModels` Hook 实时同步 `/api/models`） | 0（实时） |
| 合计本地兜底 | `ALL_MODELS` / `TOTAL_MODELS` | 169 |

后端 `/v1/models` 静态兜底清单位于 `artifacts/api-server/src/routes/proxy-models.ts`，关键基础数组为：

| 服务商 | 后端数组 | 当前基础数量 |
|---|---|---:|
| OpenAI | `OPENAI_CHAT_MODELS` | 22 |
| Anthropic | `ANTHROPIC_BASE_MODELS` | 7 |
| Gemini | `GEMINI_BASE_MODELS` | 6 |
| DeepSeek | `DEEPSEEK_CHAT_MODELS` | 4 |
| xAI | `XAI_CHAT_MODELS` | 10 |
| Mistral | `MISTRAL_CHAT_MODELS` | 16 |
| Moonshot | `MOONSHOT_CHAT_MODELS` | 6 |
| Groq | `GROQ_FEATURED_MODELS` | 17 |
| Together AI | `TOGETHER_FEATURED_MODELS` | 19 |
| SiliconFlow | `SILICONFLOW_FEATURED_MODELS` | 20 |
| Cerebras | `CEREBRAS_FEATURED_MODELS` | 2 |
| Fireworks AI | `FIREWORKS_FEATURED_MODELS` | 7 |
| Novita AI | `NOVITA_FEATURED_MODELS` | 6 |
| Hyperbolic | `HYPERBOLIC_FEATURED_MODELS` | 6 |
| OpenRouter | `OPENROUTER_FEATURED_MODELS`（已清空，运行时由 `/api/models` 60s 缓存拉取 openrouter.ai/api/v1/models） | 0（实时） |

后端会自动扩展部分 thinking 别名：

- OpenAI o-series：`OPENAI_THINKING_ALIASES`
- Anthropic：每个基础模型扩展 `-thinking` 和 `-thinking-visible`
- Gemini：`GEMINI_THINKING_CAPABLE` 中的基础模型扩展 `-thinking` 和 `-thinking-visible`

展开上述 thinking 别名后，本地兜底总数约为 **169**（不含 OpenRouter）。运行时 `/api/models` 与 `/v1/models` 会优先实时拉取 Replit 可访问的 OpenAI / Anthropic / Gemini / OpenRouter 上游 models 接口，并以 60 秒缓存返回；OpenRouter 自 v0.1.62 起完全实时（本地数组已清空，无兜底），其它服务商若上游无凭证、不可访问或失败，则保留本地兜底清单。OpenRouter 模型从 v0.1.63 起额外携带 `context_length` 字段（来自上游 `context_length` 或 `top_provider.context_length`），前端在模型徽标中以 `K`/`M` 显示。

## 模型列表维护

### 单一事实源

模型维护必须同步本地兜底事实源；运行时可用模型以 `/api/models` / `/v1/models` 实时同步结果优先：

1. 前端展示：
   - `artifacts/api-portal/src/data/models.ts`
2. 后端兜底返回与路由：
   - `artifacts/api-server/src/routes/proxy-models.ts`

如果涉及价格估算，还需同步：

- `artifacts/api-portal/src/data/pricing.ts`

如果涉及 token 限制或 thinking budget，还需同步：

- `artifacts/api-server/src/lib/model-limits.ts`

如果涉及新服务商或新命名规则，还需同步：

- `artifacts/api-portal/src/data/models.ts` 的 `Provider` 类型和 `PROVIDER_COLORS`
- `artifacts/api-server/src/lib/providers.ts` 的 `ProviderType` 和 `detectProvider()`
- `artifacts/api-server/src/config.ts` 的服务商配置结构
- `artifacts/api-server/src/lib/disguise.ts` 的 `PROVIDER_PRESET_MAP`
- 设置页服务商配置 UI

### 添加 OpenAI 模型

1. 在 `OPENAI_MODELS` 添加前端展示项
2. 在 `OPENAI_CHAT_MODELS` 添加后端模型 ID
3. 如果模型只能走 Responses API，加入 `OPENAI_RESPONSES_API_MODELS`
4. 如果是非聊天模型，加入 `OPENAI_NON_CHAT_MODELS`
5. 如果是 o-series 推理模型，确认 `OPENAI_THINKING_ALIASES` 是否会自动覆盖
6. 如需费用估算，在 `EXACT_PRICING` 中添加价格

### 添加 Anthropic 模型

1. 在 `ANTHROPIC_MODELS` 添加基础模型和对应 thinking 展示项
2. 在 `ANTHROPIC_BASE_MODELS` 添加基础模型 ID
3. 后端会自动生成 `-thinking` 和 `-thinking-visible`
4. 如需价格估算，在 `PREFIX_PRICING` 中添加或更新前缀价格
5. 确认 Claude Messages 路由和 OpenAI 兼容转换逻辑无需特殊适配

### 添加 Gemini 模型

1. 在 `GEMINI_MODELS` 添加前端展示项
2. 在 `GEMINI_BASE_MODELS` 添加后端基础模型 ID
3. 如果支持 `thinkingConfig`，加入 `GEMINI_THINKING_CAPABLE`
4. 如果不是聊天模型，加入 `GEMINI_NON_CHAT_MODELS`
5. 如需价格估算，在 `EXACT_PRICING` 或 `PREFIX_PRICING` 中添加价格
6. 确认 Gemini Native 端点是否需要额外格式处理

### 添加 DeepSeek 模型

1. 在 `DEEPSEEK_MODELS` 添加前端展示项
2. 在 `DEEPSEEK_CHAT_MODELS` 添加后端模型 ID
3. 如果是原生 DeepSeek 模型且不含 `/`，必须在 `detectProvider()` 中先于 OpenRouter 规则识别
4. 如需价格估算，在 `EXACT_PRICING` 中添加价格
5. 确认默认 Base URL 仍为 `https://api.deepseek.com/v1`，除非服务商官方变更

### 添加 OpenAI 兼容通道模型（Groq / Together / SiliconFlow / Cerebras / Fireworks / Novita / Hyperbolic 等）

这些通道均使用 OpenAI 兼容 API，模型 ID 在本地加 `<provider>/` 前缀后路由，上游收到去前缀后的 ID。

1. 在 `artifacts/api-portal/src/data/models.ts` 的对应数组（如 `FIREWORKS_MODELS`）添加前端展示项
2. 在 `artifacts/api-server/src/routes/proxy-models.ts` 的对应数组（如 `FIREWORKS_FEATURED_MODELS`）添加后端模型 ID（保留 `<provider>/` 前缀）
3. `normalizeProviderModel()` 会在转发时自动剥离前缀；确认 `if (provider === "xxx" && model.startsWith("xxx/"))` 分支已存在
4. 确认 `PROVIDER_DEFAULTS` 中该通道的默认 Base URL 正确，且 `detectProvider()` 中对应前缀规则已添加

注意 Fireworks 的模型 ID 特殊：前缀为 `fireworks/`，上游实际 ID 为 `accounts/fireworks/models/<name>`，即完整本地 ID 格式为 `fireworks/accounts/fireworks/models/<name>`。

### OpenRouter 模型（无需手动维护）

OpenRouter 模型清单自 v0.1.62 起完全实时同步，**前后端不再保留静态数组**：

- 后端 `/api/models` 端点定时（60s 缓存）拉取 `https://openrouter.ai/api/v1/models`，并在响应里附带 `context_length`（v0.1.63 起，来自上游 `context_length` 或 `top_provider.context_length`）
- 前端 `useLiveOpenRouterModels(baseUrl)` Hook（`artifacts/api-portal/src/hooks/useLiveOpenRouterModels.ts`）从 `/api/models` 取出 `owned_by === "openrouter"` 的条目，token 数通过 `formatContextLength` 格式化为 `K`/`M` 写入 `ModelEntry.context`，由 `ModelsPage` 现有的上下文徽标 UI 直接展示
- `OPENROUTER_MODELS` 与 `OPENROUTER_FEATURED_MODELS` 保留为空数组占位，**不要再向其添加条目**；新模型只要在 OpenRouter 上线即会被自动展示

如需调整定价估算（不影响列表），仍需在 `pricing.ts` 与 `billing.ts` 同步对应前缀；模型 ID 仍需包含 `/`，由 `detectProvider()` 的 catch-all 规则路由。

### 模型维护后检查

建议检查：

```bash
rg "新增模型ID" artifacts/api-portal/src/data/models.ts artifacts/api-server/src/routes/proxy-models.ts
```

再启动前后端观察运行日志，确认：

- 前端模型列表可显示
- `/api/models` 与 `/v1/models` 在有 Replit 上游凭证时返回实时同步模型；无凭证或失败时返回本地兜底模型
- 聊天端点对非聊天模型或 Responses-only 模型返回明确错误
- thinking 后缀不会错误路由

## 模型计费维护（重点维护事项）

模型定价是影响用户费用估算准确性的核心数据，必须定期更新，是日常维护的最高优先级事项之一。

### 定价文件位置

所有模型定价集中维护于：

- `artifacts/api-portal/src/data/pricing.ts`

该文件包含两个核心数据结构：

- `EXACT_PRICING`：精确匹配表（按模型 ID 精确查找）
- `PREFIX_PRICING`：前缀匹配表（用于模型族通配，如 `claude-sonnet-4` 匹配所有 Sonnet 4.x 变体）

定价单位均为 **美元 / 100 万 tokens（USD per 1M tokens）**。

### 当前覆盖的服务商（2026-05-01 实时查询更新）

| 服务商 | 定价来源 | 最后更新 |
|---|---|---|
| OpenAI | platform.openai.com/docs/pricing | 2026-05-01 |
| Anthropic | claude.ai/pricing | 2026-04-16 |
| Google Gemini | ai.google.dev/gemini-api/docs/pricing | 2026-04-15 |
| DeepSeek | api-docs.deepseek.com/quick_start/pricing | 2026-04-24 |
| xAI Grok | docs.x.ai/developers/models | 2026-05-01 |
| Mistral AI | mistral.ai/technology/#pricing | 2026-05-01 |
| Moonshot AI | platform.moonshot.cn | 2026-04-20 |
| Groq | console.groq.com/docs/rate-limits | 2026-04-20 |
| Together AI | api.together.ai/models | 2026-04-20 |
| Cerebras | cloud.cerebras.ai/pricing | 2026-04-20 |
| Fireworks AI | fireworks.ai/pricing | 2026-04-20 |
| Novita AI | novita.ai/llm-api/pricing | 2026-04-20 |
| Hyperbolic | docs.hyperbolic.xyz/docs/hyperbolic-pricing | 2026-04-07 |
| SiliconFlow | siliconflow.cn/pricing（折算后 USD 估算） | 2026-04-20 |
| OpenRouter（独占 owner） | openrouter.ai/api/v1/models 实时 API（cohere/perplexity/nvidia/amazon/ai21/microsoft/liquid/inflection/minimax/z-ai/baidu/tencent/bytedance(-seed)/alibaba/allenai/arcee-ai/nousresearch/xiaomi/writer/upstage/ibm-granite/inception/stepfun/morph/deepcogito/essentialai/prime-intellect/tngtech/switchpoint/aion-labs/rekaai/relace/kwaipilot/nex-agi/sao10k/thedrummer 等 36 个 owner，含 Qwen3-VL / Qwen-2.5 / Llama-3.2 子系列） | 2026-04-21 |

### 关键价格变动记录

以下为各维护周期实时查询中发现的重要变动，按时间倒序：

**2026-05-01（v0.1.74）**

| 模型 | 旧定价（input/output per 1M） | 新定价（input/output per 1M） | 说明 |
|---|---|---|---|
| `gpt-5.5`（新） | — | $5.00 / $30.00 | OpenAI GPT-5.5，API 2026-04-24 开放，1M context |
| `gpt-5.5-pro`（新） | — | $30.00 / $180.00 | OpenAI GPT-5.5 Pro，1M context |
| `grok-4.3`（新） | — | $1.25 / $2.50 | xAI Grok 4.3，经 docs.x.ai 实时核查 |
| `mistral-medium-3.5`（新） | — | $0.40 / $2.00 | Mistral Medium 3.5，256K context；`mistral-medium-latest` 现别名至此 |
| `gpt-5.4`（补丁） | $1.25 / $10.00（被 gpt-5 catch-all 误命中） | $15.00 / $60.00 | billing.ts 缺失精确条目导致严重低估，补充于 catch-all 之前 |

**2026-04-20（v0.1.73 及早期）**

| 模型 | 旧定价（input/output per 1M） | 新定价（input/output per 1M） | 说明 |
|---|---|---|---|
| `o3` | $10.00 / $40.00 | $2.00 / $8.00 | OpenAI 大幅降价，约降 80% |
| `gpt-5` | $15.00 / $60.00 | $1.25 / $10.00 | GPT-5 正式定价低于预期 |
| `gpt-5-mini` | $0.40 / $1.60 | $0.25 / $2.00 | 输入更便宜，输出略贵 |
| `deepseek-chat` | $0.27 / $1.10 | $0.28 / $0.42 | V3.2 统一定价，输出大幅下调 |
| `deepseek-reasoner` | $0.55 / $2.19 | $0.28 / $0.42 | V3.2 统一定价，与 chat 同价 |
| `gemini-2.5-flash` | $0.15 / $0.60 | $0.30 / $2.50 | Gemini 更新计费，thinking 输出 $3.50 |
| `claude-haiku-4.5`（新） | — | $1.00 / $5.00 | 新模型，高于 Haiku 4 旧价 |
| `claude-opus-4.6/4.7`（新） | — | $5.00 / $25.00 | 较旧 Opus 4 ($15/$75) 降价 67% |
| Groq、Together、Cerebras 等 | 未覆盖 | 已全量补充 | 本次新增覆盖所有 11 个非 Replit 渠道 |
| `grok-4`（修正） | $3.00 / $15.00 | $2.00 / $6.00 | 经 docs.x.ai 官方文档二次核查：grok-4.20 系列实际定价 $2/$6 |
| `grok-4-fast`（修正键名） | 键名 `grok-4.1-fast`（错误） | 键名 `grok-4-fast` + $0.20/$0.50 | xAI API 实际别名为 grok-4-fast，并补充 grok-4-1-fast-* 精确版本 ID |
| OpenRouter 独占 owner（新增） | 未覆盖 | 36 个 owner / ~150 条 prefix 规则 | 实时查询 openrouter.ai/api/v1/models，补全 cohere/perplexity/nvidia/amazon/ai21/minimax/z-ai/baidu/tencent/bytedance/nousresearch/arcee-ai/xiaomi/sao10k 等 OpenRouter-only 模型族 |

### 定价更新流程

**建议每 2 周或重大发布后更新一次。**

1. **检查变动**：实时查询各服务商官方定价页面（见上表来源链接）
2. **更新 EXACT_PRICING**：精确模型 ID 的新定价直接修改对应条目
3. **更新 PREFIX_PRICING**：模型族新增版本时，在数组**前端**（更具体前缀优先）插入新条目
4. **同步本文档**：更新上方"当前覆盖的服务商"表格的"最后更新"日期，并在"关键价格变动记录"表中追加新条目
5. **无需版本升级**：纯定价更新为文档型变更，不触发版本号变更规则

### 新增服务商定价

若新增服务商（在 `providers.ts` 中添加了新 `ProviderType`）：

1. 在 `EXACT_PRICING` 中以 `<provider>/` 前缀添加该服务商已知模型的精确定价
2. 在 `PREFIX_PRICING` 中添加通配前缀条目（如 `siliconflow/Qwen/Qwen2.5`）
3. 在本文档"当前覆盖的服务商"表中登记来源和日期

### 注意事项

- **namespaced 服务商**（Groq、Together、SiliconFlow 等）的模型 ID 在用量日志中含完整 `<provider>/` 前缀，因此定价键也必须带该前缀
- **Gemini 超长上下文**（>200K tokens）有单独定价档，`EXACT_PRICING` 目前仅收录标准档（≤200K），超长上下文估算会偏低，属已知局限
- **Fireworks AI** 模型 ID 特殊：本地格式为 `fireworks/accounts/fireworks/models/<name>`，定价前缀也须对应
- **SiliconFlow** 以人民币定价为主，已折算为 USD 估算值，精度有限，仅供参考
- **Hyperbolic** 部分模型为混合（blended）定价，input/output 设置相同值

## 请求伪装 SDK 维护

### 当前 preset

请求伪装实现位于：

- `artifacts/api-server/src/lib/disguise.ts`

当前共有 **21 个 preset**：

- `none`
- `auto`（智能自动，携带 Replit Headers，**默认推荐**）
- `auto-no-replit`（智能自动，不携带 Replit Headers）
- `openai-sdk`
- `openai-sdk-py`
- `openai-sdk-py-async`
- `openai-sdk-bun`（OpenAI SDK 在 Bun 运行时）
- `openai-sdk-deno`（OpenAI SDK 在 Deno 运行时）
- `anthropic-sdk`
- `anthropic-sdk-py`
- `anthropic-sdk-py-async`
- `anthropic-sdk-bun`（Anthropic SDK 在 Bun 运行时）
- `gemini-sdk`
- `gemini-sdk-py`（Google GenAI Python SDK，httpx 底层）
- `openrouter-sdk`
- `litellm`
- `vercel-ai-sdk`
- `httpx`
- `curl`
- `python-requests`
- `browser-chrome`

### 当前版本指纹（更新于 2026-05-01，v0.1.74 内容同步）

> 已通过 npm registry、PyPI 官方渠道及 GitHub Releases 实时核查。最近更新：v0.1.71 同步 Deno 2.7.12→2.7.13、LiteLLM 1.83.11→1.83.12；v0.1.74（2026-05-01）同步：openai JS 6.34→6.35、anthropic JS 0.90→0.92、@google/genai 1.50.1→1.51.0、openai Python 2.32→2.33、anthropic Python 0.96→0.97、google-genai Python 1.73.1→1.74.0、LiteLLM 1.83.12→1.83.14、Deno 2.7.13→2.7.14、curl 8.19.0→8.20.0、Vercel AI SDK 6.0.168→6.0.170；Chrome 147 截至 2026-05-01 仍为最新稳定版（148 预计 ~2026-05-05 发布）、Bun 1.3.13、httpx 0.28.1、python-requests 2.33.1 均无更新。

| Preset | user-agent / 关键标识 | 核心版本 |
|---|---|---|
| `openai-sdk` | OpenAI/JS，`x-stainless-runtime: node` | 6.35.0 |
| `openai-sdk-py` / `openai-sdk-py-async` | OpenAI/Python，`x-stainless-runtime: CPython` | 2.33.0 |
| `openai-sdk-bun` | OpenAI/JS，`x-stainless-runtime: bun` | SDK 6.35.0，Bun 1.3.13 |
| `openai-sdk-deno` | Deno/2.7.14，`x-stainless-runtime: deno` | SDK 6.35.0，Deno 2.7.14 |
| `anthropic-sdk` | Anthropic/JS，`x-stainless-runtime: node` | 0.92.0 |
| `anthropic-sdk-py` / `anthropic-sdk-py-async` | Anthropic/Python，`x-stainless-runtime: CPython` | 0.97.0 |
| `anthropic-sdk-bun` | Anthropic/JS，`x-stainless-runtime: bun` | SDK 0.92.0，Bun 1.3.13 |
| `gemini-sdk` | google-genai-sdk / `x-goog-api-client: genai-js/...` | 1.51.0 |
| `gemini-sdk-py` | python-httpx / `x-goog-api-client: genai-py/... gl-python/...` | google-genai 1.74.0，httpx 0.28.1 |
| `openrouter-sdk` | OpenAI/JS（base） | 6.35.0 |
| `litellm` | litellm，内嵌 openai stainless | 1.83.14，openai 2.24.0 |
| `httpx` | python-httpx | 0.28.1 |
| `curl` | curl | 8.20.0 |
| `python-requests` | python-requests | 2.33.1 |
| `vercel-ai-sdk` | 无 user-agent（Node.js fetch） | ai@6.0.170 |
| `browser-chrome` | Chrome UA | 147（截至 2026-05-01 仍为最新稳定版；148 预计 ~2026-05-05 发布，届时升级）|

### auto 模式规则

`auto` 由 `resolvePresetForProvider(provider, requestPath?, incomingUserAgent?)` 决定（三段优先级）：

1. **路径优先**：
   - 入站路径包含 `/messages` → `anthropic-sdk`（Bun UA 时 → `anthropic-sdk-bun`）
   - 入站路径包含 `:generateContent` 或 `:streamGenerateContent` → `gemini-sdk`（python-httpx UA 时 → `gemini-sdk-py`）

2. **User-Agent 嗅探**（无路径信号时，v0.1.36 新增）：
   - UA 含 `Deno/` → `openai-sdk-deno`
   - UA 含 `Bun/` → `openai-sdk-bun`（或 `anthropic-sdk-bun`，按 provider）
   - UA 含 `python-httpx` → `openai-sdk-py` / `anthropic-sdk-py` / `gemini-sdk-py`（按 provider）

3. **provider 兜底映射**：
   - OpenAI → `openai-sdk`
   - Anthropic → `anthropic-sdk`
   - Gemini → `gemini-sdk`
   - OpenRouter → `openrouter-sdk`
   - DeepSeek → `openai-sdk`

### Disguise Profile 列表访问规则（核心规则）

`GET /api/settings/disguise` 接口**不需要 Admin Key 认证**。Profile 列表元数据（preset ID、label、desc、headers 字段）属于只读、非敏感的配置信息，前端设置页必须在任何情况下都能展示完整的 profile 列表供用户参考，无论是否已配置 Admin Key。

- **修改当前 preset**（`POST /api/settings/disguise`）仍然需要 Admin Key 认证。
- 前端读取 profile 列表的 `useEffect` 中**不得**以 `adminKey` 是否存在作为 early-return 条件。
- 前端读取 profile 列表的 GET 请求**不得携带** `Authorization` / Admin Key，错误 Key 不能影响公开只读列表展示。
- 前端必须保留本地只读兜底 Profile 列表；接口失败时也要展示模式清单，仅禁用切换保存。
- 后端 `GET /api/settings/disguise` 路由**不得**添加 `adminAuth` 中间件。
- 如果未来重构设置接口，必须保持 GET（读取 profile 列表 + 当前 preset）公开访问。

### 伪装自动降级

所有上游 fetch 调用点通过 `fetchWithDisguiseFallback()` 包裹（`proxy-raw.ts`）。当上游返回 `400 / 403 / 407 / 422` 时，网关会：

1. 耗尽失败响应体，释放连接。
2. 以 `overridePreset: "none"` 重发请求，完全移除伪装 Header。
3. 返回重试结果。

这意味着即使 preset 配置错误或上游拒绝了伪装 Header，客户端仍能收到正常响应。维护 preset 时无需担心破坏无法降级恢复的场景。`DISGUISE_RETRY_STATUSES` 常量定义了触发降级的状态码集合（`{400, 403, 407, 422}`），如需调整范围，修改该常量即可。

### Header 清理策略

主要清理列表：

- `COMMON_PROXY_STRIP`：代理、CDN、链路追踪类 Header
- `BROWSER_ONLY_STRIP`：浏览器专属 Header
- `SDK_STRIP`：SDK 请求常见清理集
- `CLI_STRIP`：CLI / requests 伪装清理集，额外移除 stainless 和厂商 SDK Header

维护原则：

- 伪装只修改 Header，不修改请求体
- 原样透传路径必须保留鉴权 Header、Content-Type、必要厂商版本 Header
- raw fetch 路径可以清理和注入 Header
- SDK 路径只能通过请求 options 添加或覆盖 Header，无法移除 SDK 自身已经设置的 Header
- `Accept-Encoding` 在 raw passthrough 中会强制回到 `identity`，避免压缩破坏字节级透传

### 更新 SDK 版本指纹

当 OpenAI、Anthropic、Gemini、LiteLLM、httpx、requests、curl、Chrome 或 Vercel AI SDK 版本变化时：

1. 查官方 SDK 或真实请求样本中的 Header
2. 更新 `DISGUISE_PROFILES` 中对应 preset 的：
   - `label`
   - `desc`
   - `user-agent`
   - `x-stainless-package-version`
   - `x-stainless-runtime`
   - `x-stainless-runtime-version`
   - 厂商专属 Header，例如 `anthropic-version`、`x-goog-api-client`
3. 如新增或删除 Header，检查对应 `strip` 列表是否需要调整
4. 如果新增 preset，必须同步更新：
   - `DisguisePreset` union
   - `DISGUISE_PROFILES`
   - 如需自动选择，更新 `PROVIDER_PRESET_MAP` 或 `resolvePresetForProvider()`
   - 前端设置页使用的 preset 列表接口显示文案
5. 启动后端通过 `GET /api/settings/disguise`（无需 Admin Key）检查新 preset 是否出现在 `profiles` 列表中
6. 切换到该 preset，发起一次测试请求，检查上游请求日志或调试输出是否符合预期

### 不建议维护的指纹

以下属于较高成本或当前架构难以完整伪装的范围：

- TLS 指纹，例如 JA3 / JA4
- HTTP/2 SETTINGS 帧与 Header 顺序
- 底层 TCP 行为

如确需实现，需要更换或包裹 Node.js 底层 HTTP 客户端，风险高于普通 Header preset 维护。

## 版本维护

涉及运行行为、模型路由、格式转换、日志统计或伪装行为时，同步更新：

- `artifacts/api-server/src/routes/health.ts`
- `artifacts/api-portal/src/data/models.ts`
- `replit.md`

纯文档变更可不提升应用版本，但应在 `replit.md` 中记录文档位置或维护规则变化。

## 名称维护

项目对外名称统一为 `AI Gateway`。

名称检查命令：

```bash
rg "API\s+Portal|AI\s+Proxy\s+Gateway" .
```

预期结果：无匹配。

如果未来还需要检查旧式简称，可额外搜索：

```bash
rg "Portal\s*界面|前端\s*Portal|通过\s*Portal|Portal\s*设置页" .
```

这些表述应优先替换为 `AI Gateway 界面`、`前端控制台` 或 `设置页`。
