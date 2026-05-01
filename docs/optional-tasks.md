# AI Gateway 可选开发事项

本文档记录经后端代码审查后识别出的可选改进事项，均为非必要但有价值的开发方向。每项均附有背景、影响范围和实施建议，供你决策是否推进。

> 最后审查：2026-04-17（v0.1.36）  
> 事项按大致优先级排列，从高到低。
> 已完成事项：T01、T05、T07、T08、T09（已实施并合入主线，可在此文档中删除）
> 决策关闭事项：T02、T03、T04（跨格式工具调用和多模态——低优先级，暂不适配）；T06（日志持久化——不做磁盘写入，维持内存缓冲）；T10（流式中断通知——暂缓）

---

## ✅ T01：`auto` 伪装模式不覆盖新 preset（已完成，v0.1.36）

**类型**：功能补全  
**影响范围**：`disguise.ts`（3 行改动）

**背景**

`resolvePresetForProvider()` 的 provider 映射表 `PROVIDER_PRESET_MAP` 目前只指向 4 个基础 preset（`openai-sdk` / `anthropic-sdk` / `gemini-sdk` / `openrouter-sdk`）。v0.1.34 新增的 4 个 preset（`openai-sdk-bun`、`openai-sdk-deno`、`anthropic-sdk-bun`、`gemini-sdk-py`）无法通过 `auto` 自动选中，只能手动指定。

**现状**

`auto` 在 Gemini 路径下永远选 `gemini-sdk`（Node.js SDK），即使真实客户端是 Python httpx。对 Bun/Deno 环境同理。

**建议方案**

不需要修改 `PROVIDER_PRESET_MAP`（它是全局入口映射，修改影响面大）。可以在 `resolvePresetForProvider()` 中增加基于 `User-Agent` 嗅探的二次判断逻辑：

```ts
// 伪代码，仅供参考
if (userAgent?.includes("Deno/")) return "openai-sdk-deno";
if (userAgent?.includes("Bun/"))  return "openai-sdk-bun";
if (userAgent?.includes("python-httpx")) return "gemini-sdk-py";
```

需要将入站 `User-Agent` 透传给 `resolvePresetForProvider()`，当前函数签名只接受 `provider` 和 `requestPath`。改动较小但需要在所有调用点加 header 参数。

---

## 🚫 T02：跨格式路径缺少 tool call 支持（Gemini 目标端）

> **决策：低优先级，暂不适配。** 跨格式工具调用涉及多层格式转换，维护成本高，当前使用场景有限。native → native 透传路径不受影响。

**类型**：功能缺失  
**影响范围**：`claude.ts`（Gemini 跨格式路径，约 30 行）

**背景**

`/v1/messages` 接收到 Claude 格式请求并路由到 Gemini 时（`provider === "gemini"`），当前实现：

- 未将 `body.tools` 转换为 `tools[].function_declarations` 格式传入 Gemini
- 未处理 `tool` 角色的消息（`openAIMessages` 中 role=tool 的 turn 被 `filter` 直接丢弃，见 `claude.ts` 第 198 行）
- Gemini 响应中的 `functionCall` part 未转换回 Claude 的 `tool_use` block

**影响**

使用 Anthropic SDK 向网关发出 function call 请求，模型为 Gemini 时，工具调用功能完全失效（工具声明不传入 Gemini，Gemini 无法调用工具，多轮 tool use 对话会截断）。

**建议方案**

1. 复用 `toGeminiFunctionDeclarations(body.tools)` 并在请求体中加入 `tools` 字段
2. 在 `contents` 数组构建时处理 role=tool 的消息（转换为 Gemini 的 `functionResponse` part）
3. 解析 Gemini 响应中 `functionCall` part 并转换为 Claude `tool_use` block

---

## 🚫 T03：跨格式路径缺少 tool call 支持（Anthropic 目标端，Gemini Native 入口）

> **决策：低优先级，暂不适配。** 同 T02，跨格式工具调用暂不实施。native → native 透传路径不受影响。

**类型**：功能缺失  
**影响范围**：`gemini-native.ts`（Anthropic 跨格式路径，约 20 行）

**背景**

`/v1beta/models/:model:generateContent` 路由到 Anthropic 时（`provider === "anthropic"`），当前实现：

- 未将 Gemini 格式的 `tools[].function_declarations` 转换为 Anthropic 的 `tools[]` 格式
- Anthropic 响应中的 `tool_use` block 未转换回 Gemini 的 `functionCall` part

**影响**

使用 Gemini SDK 向网关发出带工具声明的请求，模型为 Claude 时，工具调用失效。

**建议方案**

1. 将入站 Gemini `tools` 字段转换为 Anthropic `tools` 格式（可复用 `toAnthropicTools`，需要适配 Gemini 的 `function_declarations` schema 结构）
2. 解析 Anthropic 响应中 `tool_use` block，转换为 Gemini 的 `functionCall` candidate part

---

## 🚫 T04：跨格式路径中图片/多模态内容未正确处理

> **决策：低优先级，暂不适配。** 跨格式多模态支持需要大量格式转换逻辑，暂不实施。native → native 透传路径不受影响。

**类型**：功能缺失  
**影响范围**：`claude.ts`、`gemini-native.ts`（跨格式路径各约 10 行）

**背景**

在 `claude.ts` 的 Gemini 跨格式路径中，message content 构建时（第 199 行）：

```ts
parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
```

非字符串的 content（如 Claude 的 `image` type block，或 OpenAI 的 content array with image_url）会被 `JSON.stringify` 后塞入 text，而不是转换为 Gemini 的 `inlineData` / `fileData` part。

同样，`gemini-native.ts` 的 OpenAI 跨格式路径中，Gemini `parts` 中的图片 part 也未转换为 OpenAI 的 `image_url` content block。

**影响**

多模态请求（含图片）在跨格式路径下会静默失效：图片 base64 被当做普通文本发送，上游模型看不到真实图片。

**建议方案**

- Claude 格式 → Gemini：将 `image` block 的 `source.data` 转换为 `{ inlineData: { mimeType, data } }` part
- Gemini 格式 → OpenAI：将 `inlineData` part 转换为 `{ type: "image_url", image_url: { url: "data:..." } }` content block
- 注意：仅影响跨格式路径，native → native 透传不受影响

---

## ✅ T05：DeepSeek 模型 ID 识别不完整（已完成，v0.1.36）

**类型**：路由缺陷  
**影响范围**：`providers.ts`（约 5 行）

**背景**

`detectProvider()` 当前只能识别 `deepseek-chat` 和 `deepseek-reasoner` 两个 DeepSeek 原生模型 ID（第 10 行）：

```ts
if (model === "deepseek-chat" || model === "deepseek-reasoner") return "deepseek";
```

DeepSeek 官方 API 还有以下模型 ID 在使用或测试中：`deepseek-r1`、`deepseek-r1-zero`、`deepseek-v3`、`deepseek-v2.5`、`deepseek-coder`、`deepseek-coder-v2` 等。这些 ID 因不含 `/` 也无法被 OpenRouter catch-all 接住，最终落入 `null` 返回 400 错误。

**建议方案**

改为前缀匹配并放在 `/` 规则之前：

```ts
if (model.startsWith("deepseek-") && !model.includes("/")) return "deepseek";
```

同时在 `proxy-models.ts` 的 `DEEPSEEK_CHAT_MODELS` 中补充实际需要的模型 ID，前端 `models.ts` 同步更新展示项。

---

## 🚫 T06：日志数据持久化

> **决策：不实施磁盘写入，维持内存缓冲。** 持久化会增加部署复杂度，与零配置目标冲突；内存缓冲已满足当前使用场景。

**类型**：运维功能  
**影响范围**：`usage-logs.ts`、`logs.ts`，可能需要引入数据库

**背景**

系统日志（`logs.ts`）和使用日志（`usage-logs.ts`）均采用纯内存环形缓冲区，容量分别为 1000 和 500 条。服务器重启后数据全部丢失。

**影响**

- 无法做跨重启的趋势分析
- 调试时重启服务器会清空所有日志
- 使用量统计在更新代码后需要重新积累

**建议方案**

A（最小改动）：将使用日志定期序列化写入磁盘（`.proxy-usage-logs.json`），启动时读取恢复。  
B（完整方案）：引入 SQLite（`better-sqlite3`）存储使用日志，支持任意时间范围查询，无需改变前端 API 接口。

注意：加入数据库会增加构建体积和启动时间，且与当前零配置部署目标略有冲突。建议先评估实际使用场景再决策。

---

## ✅ T07：请求体大小上限（已完成，v0.1.36）

**类型**：安全 / 稳定性  
**影响范围**：`app.ts`（1 行改动）

**背景**

Express `json()` 中间件当前使用默认限制 100 KB。AI 请求体（含长对话历史或 base64 图片）通常远超此限制，但 `rawBody` 捕获也受此约束，超大请求会被 Express 直接返回 413，错误信息不够明确。

**建议方案**

在 `app.ts` 中将 body-parser 的 `limit` 提高到合适值（例如 32MB），同时添加明确的 413 错误处理中间件，返回符合 OpenAI 错误格式的 JSON 响应，并附上中文提示。

---

## ✅ T08：Admin Key 空值时的权限说明（已完成，v0.1.36）

**类型**：安全说明 / UI 改进  
**影响范围**：设置页 UI、`index.ts` 注释

**背景**

`adminAuth` 中间件（`auth.ts`）在 `adminKey` 未配置时自动降级使用 `proxyApiKey` 作为管理密钥。这意味着持有客户端 API Key 的人同时拥有修改服务器配置的权限（包括切换伪装 preset、清空日志等敏感操作）。

此行为有意为之（零配置部署），但目前设置页没有任何提示说明这种权限关系。

**建议方案**

在设置页的 Admin Key 配置区域加入说明文字：  
「当 Admin Key 未配置时，Proxy Key 同时具备管理权限。如需分离，请单独配置 Admin Key。」

这是纯前端文本改动，风险极低。

---

## ✅ T09：`gemini-sdk-py` 的 `strip` 列表包含 `x-goog-api-client`（已完成，v0.1.36）

**类型**：文档与代码一致性  
**影响范围**：`disguise.ts`（注释）、`replit.md`（已更新）

**背景**

`gemini-sdk-py` 使用 `CLI_STRIP` 作为清理列表，该列表包含 `x-goog-api-client`（在 `CURL_EXTRA_STRIP` 中）。这样做是为了让 Python httpx 伪装能"清除"入站请求可能携带的 `x-goog-api-client`（比如客户端本身是 Node.js SDK 发来的），再注入正确的 Python 版本 header。

目前逻辑正确，但 `CLI_STRIP` 的注释说的是"避免 curl/requests 伪装泄露 SDK 指纹"，没有明确提到它也用于 `gemini-sdk-py` 这种情况。

**建议方案**

在 `disguise.ts` 的 `CLI_STRIP` 定义处添加注释，说明该 strip 列表同时被 `gemini-sdk-py` 使用，以便后续维护者理解选型原因。这是纯注释改动。

---

## ⏸ T10：流式请求中断时的客户端通知（暂缓）

> **决策：暂缓。** 终结符格式选择需要兼容多种 SSE 客户端（openai-node 等），实施不慎反而引入兼容性问题，暂不实施。

**类型**：健壮性  
**影响范围**：`proxy-raw.ts`（`rawVendorPassthroughStream`）

**背景**

当上游在流式传输中途断开（非正常 `done`，而是网络中断或上游错误），当前实现：

1. `reader.read()` 抛出错误或返回意外值
2. `finally` 块取消 reader
3. Express 响应直接 `res.end()`

客户端（尤其是 SSE 客户端）会看到流突然截断，没有任何错误事件，难以区分"正常完成"和"中途崩溃"。

**建议方案**

在 `rawVendorPassthroughStream` 的 `finally` 块检测流是否异常完成（`!streamCompleted && !readerCanceled`），如果是，并且响应头已发送，则写入一个 `data: [ERROR]` 或厂商格式的错误事件，让客户端知道流是异常中断的。注意：部分 SSE 客户端（如 openai-node）在接到非 `[DONE]` 终结符时会抛出异常，需要谨慎选择终结格式。

---

## 已知不会实施的事项（架构限制）

以下事项已在代码注释和 `replit.md` 中说明，不在本文档跟踪：

- **TLS 指纹（JA3/JA4）**：需要替换底层 HTTP 客户端，成本高，AI 上游当前极少检测
- **HTTP/2 SETTINGS 帧顺序**：由 Node.js undici 底层控制，无法通过 header preset 干预
- **TCP 层行为伪装**：超出应用层能力范围
