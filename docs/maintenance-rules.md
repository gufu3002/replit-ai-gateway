# AI Gateway — 维护规范

> 本文档是所有 agent 维护此项目的强制性参考。任何涉及定价表、设计规范、路由结构的修改，必须以本文档为准。

---

## 一、定价表维护规则（CRITICAL — 必须遵守）

**位置**：`artifacts/api-server/src/routes/billing.ts` → `PRICING_TABLE`

### 强制要求：更新前必须实时联网查价

任何对 `PRICING_TABLE` 的新增、修改、删除，都必须先通过联网搜索（webSearch / webFetch）查询对应厂商的官方定价页，**不得凭印象或估算填写任何价格数字**。

### 各厂商官方定价页

| 厂商 | 官方定价页 |
|---|---|
| OpenAI | https://platform.openai.com/docs/pricing |
| Anthropic | https://platform.claude.com/docs/en/about-claude/pricing |
| Google Gemini | https://ai.google.dev/pricing |
| DeepSeek | https://api-docs.deepseek.com/quick_start/pricing |
| xAI (Grok) | https://docs.x.ai/developers/models |
| Mistral AI | https://mistral.ai/technology/#pricing |
| Moonshot AI (Kimi) | https://platform.kimi.ai/docs/pricing/chat |
| ZhipuAI (GLM) | https://bigmodel.cn/pricing |
| Alibaba (Qwen) | https://www.alibabacloud.com/help/en/model-studio/model-pricing |

### 模式匹配顺序规则

`PRICING_TABLE` 使用 `model.includes(match)` 做前缀/子串匹配。**更具体的 pattern 必须排在更宽泛的 pattern 之前**，否则宽泛的 pattern 会提前命中，导致精确 pattern 永远不会生效。

错误示例（宽泛在前）：
```
{ match: "claude-opus-4" }     // ← 会命中 claude-opus-4-7
{ match: "claude-opus-4-7" }   // ← 永远不会到达
```

正确示例（精确在前）：
```
{ match: "claude-opus-4-7" }   // ← 先命中精确版本
{ match: "claude-opus-4-6" }
{ match: "claude-opus-4" }     // ← 兜底匹配其余 4.x
```

### 旧模型处理原则

- 不记载已停售 / 已退休 / 发布超过 18 个月且基本无人使用的模型
- 每次更新时检查并移除已宣布退休的旧模型

### 价格单位

所有价格单位为 **USD / 1M tokens（输入 / 输出分别记录）**，不做任何汇率估算（CNY 价格需换算成 USD）。

---

## 二、前端 UI 规范

详见 `artifacts/api-portal/UI_DESIGN.md`。

核心原则摘要：
- H1 = 22px（固定永久），H2 = 18px，H3 = 14px，H4 = 12px
- 正文默认 14px，辅助元数据 / 标签 12px，不使用 12px 以下字号
- 全局暗色系，玻璃质感卡片，克制颜色

---

## 三、API Server 路由结构

- 所有路由挂载于 `artifacts/api-server/src/app.ts`
- 计费 / 用量路由：`/api/billing/*`，`/api/usage-logs/*`，`/api/logs/*`
- 代理路由：`/v1/*`（OpenAI 兼容格式，**无** `/api` 前缀）、`/v1beta/*`（Gemini 原生格式）

---

## 四、安全 API 约束（v0.1.75–v0.1.81，不得退化）

| 约束 | 所在文件 | 规则 |
|---|---|---|
| 500 错误脱敏 | `app.ts` errorHandler | 固定返回 `"Internal server error"`，禁止暴露 `err.message` |
| 模型刷新认证 | `routes/index.ts` GET `/api/models` | `?refresh=1` 时若已配置密钥则必须验证身份，失败返回 401 |
| CSS 注入防护 | `components/ui/chart.tsx` | `dangerouslySetInnerHTML` 注入值须经 `SAFE_CSS_COLOR_RE` 白名单过滤 |
| 密钥比较 | `lib/auth.ts` `safeCompare()` | 所有密钥比较必须使用计时安全方法，禁止 `===` |
| 请求体大小 | `app.ts` body-parser | JSON 256 MB / urlencoded 1 MB，不得移除 |
| SSRF 防护 | `routes/index.ts` `isPrivateUrl()` | 用户输入的 baseUrl 必须过滤私有/回环/元数据地址 |
| Disguise GET headers | `routes/index.ts` GET `/api/settings/disguise` | 响应**不得**包含 `headers` 字段（v0.1.81 移除） |

---

*最后更新：2026-05-01（v0.1.81）*
