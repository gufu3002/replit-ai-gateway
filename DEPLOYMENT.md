# AI Gateway 部署流程文档

> 本文档面向需要快速上手本项目部署的 agent 或开发者。请在开始任何部署操作前完整阅读。

---

## 一、项目结构概览

本项目为 pnpm workspace 单仓库，包含三个工件：

| 工件目录 | 类型 | 说明 | 预览路径 |
|---|---|---|---|
| `artifacts/api-portal` | Web（React + Vite） | AI Gateway 前端控制台 | `/` |
| `artifacts/api-server` | API（Express 5） | AI Gateway 后端服务 | `/api`、`/v1`、`/v1beta` |
| `artifacts/mockup-sandbox` | Design | 组件预览沙盒（开发用） | `/__mockup` |

---

## 二、环境前提条件

| 依赖 | 要求 |
|---|---|
| Node.js | 24.x |
| pnpm | 已安装（Replit 环境内置） |
| PostgreSQL | Replit 托管数据库（如需持久化日志） |

---

## 三、AI 服务集成配置

### 3.1 Replit 托管集成（优先）

以下四个服务商通过 **Replit AI Integrations** 注入环境变量，**无需手动配置 API Key**：

- OpenAI → `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY`
- Anthropic → `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` / `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
- Google Gemini → `AI_INTEGRATIONS_GEMINI_BASE_URL` / `AI_INTEGRATIONS_GEMINI_API_KEY`
- OpenRouter → `AI_INTEGRATIONS_OPENROUTER_BASE_URL` / `AI_INTEGRATIONS_OPENROUTER_API_KEY`

请让Replit Agent手动开启 AI Integrations 的权限。
> **⚠️ 重要：从 GitHub 导入到新 Replit 项目后，必须手动启用一次 AI Integrations，否则四个服务商的环境变量不会注入，调用时将报 401 / 403 错误。**
>
> 启用步骤：
>
> 1. 在 Replit 中导入本项目源代码。
> 2. 让 Replit Agent 手动开启 OpenAI Anthropic Gemini OpenRouter 的 Integrations 权限。
> 3. 授权完成后，Replit 会自动将对应环境变量注入到运行时，无需手动配置任何 Key。
> 4. **验证**：让 Replit Agent 启动后端后调用 `GET /api/config`，确认 `providers.openai.baseUrl` 等字段已被自动填入。

### 3.2 其他服务商（用户手动配置）

DeepSeek、xAI、Mistral、Moonshot、Groq、Together、SiliconFlow、Cerebras、Fireworks、Novita、Hyperbolic 等服务商的 API Key 和 Base URL 由用户在 AI Gateway 前端的 **Settings** 页填写，持久化到工作区根目录的 `.proxy-config.json`。

**不要将真实密钥写入源码、文档或日志。**

---

## 四、配置文件

### `.proxy-config.json`（运行时生成，位于工作区根目录）

此文件由网关自动创建和管理，包含：

```json
{
  "proxyApiKey": "<Proxy Key>",
  "adminKey": "<Admin Key（可选）>",
  "providers": {
    "deepseek": { "apiKey": "...", "baseUrl": "https://api.deepseek.com/v1" }
  },
  "disguisePreset": "auto",
  "urlAutocorrect": { ... },
  "budgetQuotaUsd": 10.0
}
```

- 首次启动时若文件不存在，后端会自动生成默认配置。
- **不要将此文件提交到代码仓库**（已在 `.gitignore` 中排除）。

---

## 五、本地开发启动

```bash
# 安装依赖
pnpm install

# 同时启动前后端（推荐）
pnpm --filter @workspace/api-portal run dev   # 前端
pnpm --filter @workspace/api-server run dev   # 后端

# 类型检查
pnpm run typecheck

# 全量构建
pnpm run build

# 重新生成 API hooks（修改 OpenAPI spec 后执行）
pnpm --filter @workspace/api-spec run codegen

# 推送数据库 schema 变更（仅开发环境）
pnpm --filter @workspace/db run push
```

---

## 六、Replit 工作流配置

Replit 通过工作流（Workflows）绑定长运行服务命令。本项目已注册以下工作流：

| 工作流名称 | 对应工件 | 启动命令 |
|---|---|---|
| `artifacts/api-portal: web` | 前端控制台 | `pnpm --filter @workspace/api-portal run dev` |
| `artifacts/api-server: AI Gateway API Server` | 后端 API | `export NODE_ENV=development && pnpm run build && pnpm run start` |
| `artifacts/mockup-sandbox: Component Preview Server` | 组件沙盒 | （自动管理） |

**端口规则**：所有服务必须读取 `PORT` 环境变量，禁止硬编码端口。后端生产模式使用 `PORT=8080`。

---

## 七、Replit 部署（发布到生产）

### 7.1 发布前检查

```bash
# 确认全量构建通过
pnpm run build

# 确认无旧名称残留
rg "API\s+Portal|AI\s+Proxy\s+Gateway" .
# 预期结果：无匹配

# 确认类型无错误
pnpm run typecheck
```

### 7.2 发布步骤

1. 在 Replit 工作区点击顶部 **Deploy** 按钮，或通过 **Deployments** 面板发布。
2. 选择 **Reserved VM** 或 **Autoscale** 部署类型（推荐 Reserved VM 保证持续运行）。
3. 确认入口命令为后端构建 + 启动命令：
   ```
   export NODE_ENV=production && pnpm run build && pnpm run start
   ```
4. 发布后应用将托管在 `.replit.app` 域名或自定义域名下。

### 7.3 发布后验证

```bash
# 健康检查（将 <domain> 替换为实际域名）
curl https://<domain>/api/healthz

# 版本信息
curl https://<domain>/api/version

# 模型列表（需携带 Proxy Key）
curl -H "Authorization: Bearer <proxy-key>" https://<domain>/v1/models
```

---

## 八、生产环境关键说明

### 配置持久化

- `.proxy-config.json` 在生产环境中持久化于部署实例的工作区根目录。
- 若重新部署或实例重置，需通过前端 Settings 页重新配置服务商 API Key 和 Admin Key。

### 请求体大小上限

Express 中间件统一设置为 **1 GB**，支持含大量 base64 图片或超长对话历史的请求。超出时返回 `413 request_too_large`。

### 认证方式

所有 `/v1/*` 端点均需 Proxy Key 认证，支持以下方式：

- `Authorization: Bearer <key>`
- `x-goog-api-key: <key>`
- `?key=<key>`

Admin Key（用于管理操作）通过前端 Settings 页设置，存储于浏览器 `sessionStorage`。

---

## 九、迁移到其他仓库后的注意事项

本项目从 Replit 迁移到 GitHub 或新 Replit 项目时，需注意：

1. **AI Integrations 必须手动启用一次**（最关键步骤，从 GitHub 导入的新项目必做）：
   - 从 GitHub 下载源码后在 Replit 新项目中打开，AI Integrations **不会自动继承**原项目的授权，必须重新启用。
   - 在 Replit 工作区侧边栏 → **Integrations** 面板，逐一为 **OpenAI / Anthropic / Google Gemini / OpenRouter** 点击启用并完成授权。
   - 授权完成后，Replit 自动注入所有必要的环境变量，**无需手动配置任何 Key**。
   - **若跳过此步骤**，调用这四个服务商时将返回 401 / 403 错误。

2. **数据库**：若使用 Replit 托管 PostgreSQL，需在新环境中提供 `DATABASE_URL` 环境变量。

3. **端口配置**：后端读取 `PORT` 环境变量，目标平台需提供该变量或使用默认值 `8080`。

4. **`.proxy-config.json`**：此文件不应提交，需在新环境中从零初始化（首次启动自动生成默认配置）。

5. **pnpm workspaces**：确保目标环境安装了与项目相同版本的 pnpm，并执行 `pnpm install` 恢复依赖。

---

## 十、关键文档索引

| 文档 | 路径 | 说明 |
|---|---|---|
| 项目总览与规则 | `replit.md` | 最高优先原则、架构约束、技术栈 |
| 维护规范（agent 规则）| `docs/maintenance-rules.md` | 定价表、设计规范、路由结构维护规则 |
| 日常维护指南 | `docs/maintenance-guide.md` | 模型列表、计费、伪装 SDK 维护流程 |
| 开发交接文档 | `docs/development-handoff.md` | 关键路径、请求流、设计约束 |
| API 透传机制 | `docs/api-passthrough.md` | 透传策略、供应商路由规则详解 |
| 前端 UI 规范 | `artifacts/api-portal/UI_DESIGN.md` | 字号、间距、颜色规范 |

---

*最后更新：2026-04-23*
