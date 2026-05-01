# AI Gateway 部署流程文档

> 本文档面向需要在全新 Replit 项目中部署本项目的 agent 或开发者。**请在开始任何操作前完整阅读全文。**

---

## 一、重要背景说明

本项目源码托管在 GitHub，但以下内容在全新 Replit 环境中处于**未初始化状态**，每次部署时必须由 agent 完成初始化：

| 未初始化的内容 | 说明 |
|---|---|
| `.replit` 中的工作流配置 | `api-server` 工作流由 artifact 系统自动管理；`api-portal` 工作流在步骤 4 注册 artifact 后由系统自动创建 |
| `artifacts/api-portal` 的 Replit 系统注册 | `artifact.toml` 文件**已在仓库中**，但尚未向 Replit 系统注册，需调用 `verifyAndReplaceArtifactToml()` 完成注册 |
| `lib/integrations-openai-ai-server/` | 从 `.local/skills/ai-integrations-openai/templates/lib/` 复制 |
| `lib/integrations-anthropic-ai/` | 从 `.local/skills/ai-integrations-anthropic/templates/lib/` 复制 |
| `lib/integrations-gemini-ai/` | 从 `.local/skills/ai-integrations-gemini/templates/lib/` 复制 |
| `lib/integrations-openrouter-ai/` | 从 `.local/skills/ai-integrations-openrouter/templates/lib/` 复制 |

`artifacts/api-server/.replit-artifact/artifact.toml` 和 `artifacts/mockup-sandbox/.replit-artifact/artifact.toml` **已包含在仓库中**，无需重建。

### 幂等性说明

以下步骤均可安全重复执行（幂等）：

- **步骤 1**：`cp -r` 会直接覆盖，无副作用
- **步骤 2**：`pnpm install` 在锁文件未变时快速跳过
- **步骤 3**：`setupReplitAIIntegrations()` 重复调用无副作用
- **步骤 4**：`verifyAndReplaceArtifactToml()` 重复调用无副作用

如果环境已部分完成初始化，可通过每步开头的"验证已完成"命令快速判断是否需要执行该步骤。

---

## 二、项目结构概览

本项目为 pnpm workspace 单仓库，包含三个工件：

| 工件目录 | 类型 | 说明 | 预览路径 | 端口 |
|---|---|---|---|---|
| `artifacts/api-portal` | Web（React + Vite） | AI Gateway 前端控制台 | `/` | **24927** |
| `artifacts/api-server` | API（Express 5） | AI Gateway 后端服务 | `/api`、`/v1`、`/v1beta` | **8080** |
| `artifacts/mockup-sandbox` | Design | 组件预览沙盒（开发用） | `/__mockup` | 8081 |

**端口为固定值，不得更改。** 前端固定 `PORT=24927 BASE_PATH=/`，后端固定 `PORT=8080`。

---

## 三、全新 Replit 项目初始化（完整步骤）

从 GitHub 导入源码后，按以下顺序执行。**全部步骤均通过 agent 的 `code_execution` 或 `bash` 工具完成，无需用户手动操作。**

### 步骤 1：复制 AI 集成库包

**验证已完成**（跳过条件：以下四个目录均已存在）：
```bash
ls lib/integrations-openai-ai-server lib/integrations-anthropic-ai lib/integrations-gemini-ai lib/integrations-openrouter-ai
```

如需执行：
```bash
cp -r .local/skills/ai-integrations-openai/templates/lib/integrations-openai-ai-server lib/
cp -r .local/skills/ai-integrations-anthropic/templates/lib/integrations-anthropic-ai lib/
cp -r .local/skills/ai-integrations-gemini/templates/lib/integrations-gemini-ai lib/
cp -r .local/skills/ai-integrations-openrouter/templates/lib/integrations-openrouter-ai lib/
```

### 步骤 2：安装依赖

**验证已完成**（跳过条件：`node_modules` 已存在且锁文件未变）：
```bash
ls artifacts/api-server/node_modules 2>/dev/null && echo "已安装" || echo "需要安装"
```

如需执行：
```bash
pnpm install
```

### 步骤 3：开启 Replit AI Integrations

**验证已完成**（跳过条件：四个环境变量均已注入）：
```bash
node -e "['AI_INTEGRATIONS_OPENAI_API_KEY','AI_INTEGRATIONS_ANTHROPIC_API_KEY','AI_INTEGRATIONS_GEMINI_API_KEY','AI_INTEGRATIONS_OPENROUTER_API_KEY'].forEach(k => console.log(k, process.env[k] ? '已注入' : '缺失'))"
```

如需执行，在 `code_execution` 沙箱中依次执行（每条 await 后再执行下一条）：

```javascript
const r1 = await setupReplitAIIntegrations({
  providerSlug: "openai",
  providerUrlEnvVarName: "AI_INTEGRATIONS_OPENAI_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENAI_API_KEY",
});
console.log("OpenAI:", r1);

const r2 = await setupReplitAIIntegrations({
  providerSlug: "anthropic",
  providerUrlEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
});
console.log("Anthropic:", r2);

const r3 = await setupReplitAIIntegrations({
  providerSlug: "gemini",
  providerUrlEnvVarName: "AI_INTEGRATIONS_GEMINI_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_GEMINI_API_KEY",
});
console.log("Gemini:", r3);

const r4 = await setupReplitAIIntegrations({
  providerSlug: "openrouter",
  providerUrlEnvVarName: "AI_INTEGRATIONS_OPENROUTER_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENROUTER_API_KEY",
});
console.log("OpenRouter:", r4);
```

每条成功时输出 `{"success":true,"envVarsSet":[...]}` 。

### 步骤 4：注册前端 artifact（api-portal）

**验证已完成**（跳过条件：`listArtifacts()` 结果中已包含 "AI Gateway"）：
```javascript
const { artifacts } = await listArtifacts();
console.log(artifacts.map(a => a.title));
// 若输出包含 "AI Gateway" 则跳过本步骤
```

如需执行：

> **说明**：`artifacts/api-portal/.replit-artifact/artifact.toml` 文件已在仓库中，内容正确，但尚未向 Replit 系统注册。需通过 `verifyAndReplaceArtifactToml()` 完成注册。注册成功后，Replit 会自动为前端创建并托管对应工作流（`artifacts/api-portal: web`），**步骤 5 的两个 `configureWorkflow()` 调用均会因 artifact 已托管而报错，属正常现象，直接跳过步骤 5 即可。**

将以下内容写入 `artifacts/api-portal/.replit-artifact/artifact.edit.toml`（通过 agent `write` 工具）：

```toml
kind = "web"
previewPath = "/"
title = "AI Gateway"
version = "1.0.0"
id = "artifacts/api-portal"
router = "path"

[[integratedSkills]]
name = "react-vite"
version = "1.0.0"

[[services]]
name = "web"
paths = [ "/" ]
localPort = 24927

[services.development]
run = "pnpm --filter @workspace/api-portal run dev"

[services.production]
build = [ "pnpm", "--filter", "@workspace/api-portal", "run", "build" ]
publicDir = "artifacts/api-portal/dist/public"
serve = "static"

[[services.production.rewrites]]
from = "/*"
to = "/index.html"

[services.env]
PORT = "24927"
BASE_PATH = "/"
```

然后在 `code_execution` 中调用：

```javascript
const result = await verifyAndReplaceArtifactToml({
  tempFilePath: "/home/runner/workspace/artifacts/api-portal/.replit-artifact/artifact.edit.toml",
  artifactTomlPath: "/home/runner/workspace/artifacts/api-portal/.replit-artifact/artifact.toml"
});
console.log(result); // 期望: { success: true }

// 验证注册成功
const { artifacts } = await listArtifacts();
console.log(artifacts.map(a => a.title));
// 期望输出包含: ["Canvas", "AI Gateway API Server", "AI Gateway"]
```

### 步骤 5：配置工作流（通常可跳过）

> **重要**：步骤 4 中 artifact 注册成功后，Replit 会自动托管前后端工作流。直接调用 `configureWorkflow()` 将报错：`"... is managed by an artifact and cannot be overridden"`，这是正常行为，**不是错误**。
>
> 只有在 artifact 注册失败、且工作流也不存在时，才需要手动配置。此时配置命令仅供参考：

<details>
<summary>手动配置工作流（仅在 artifact 注册失败时使用）</summary>

```javascript
// 后端工作流（console 类型）
await configureWorkflow({
  name: "artifacts/api-server: AI Gateway API Server",
  command: "cd artifacts/api-server && PORT=8080 NODE_ENV=development pnpm run build && PORT=8080 NODE_ENV=development pnpm run start",
  waitForPort: 8080,
  outputType: "console",
  autoStart: false
});

// 前端工作流（webview 类型）
await configureWorkflow({
  name: "artifacts/api-portal: web",
  command: "PORT=24927 BASE_PATH=/ pnpm --filter @workspace/api-portal run dev",
  waitForPort: 24927,
  outputType: "webview",
  autoStart: false
});
```

</details>

### 步骤 6：启动服务

先启动后端，再启动前端（通过 `restart_workflow` 工具）：

```
restart_workflow("artifacts/api-server: AI Gateway API Server")
restart_workflow("artifacts/api-portal: web")
```

### 步骤 7：验证部署

```bash
# 后端健康检查
curl -s http://localhost:8080/api/healthz
# 期望: {"status":"ok"}

# 确认四个 AI 服务商已注入（使用 node 解析，环境中无 python3）
curl -s http://localhost:8080/api/config | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const p = d.providers || {};
['openai','anthropic','gemini','openrouter'].forEach(k =>
  console.log(k + ':', p[k]?.configured ? 'true ✓' : 'false ✗')
);
"

# 前端可访问性（检查 HTML 返回）
curl -s http://localhost:24927/ | grep -o '<title>[^<]*</title>'
# 期望: <title>AI Gateway</title>
```

也可直接用 Proxy Key 测试模型调用：

```bash
PROXY_KEY=$(node -e "const c=require('./.proxy-config.json'); console.log(c.proxyApiKey)")

# 测试 OpenAI
curl -s -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROXY_KEY" \
  -d '{"model":"gpt-5-mini","messages":[{"role":"user","content":"hello"}],"max_completion_tokens":5}'

# 测试 Anthropic
curl -s -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROXY_KEY" \
  -d '{"model":"claude-haiku-4-5","messages":[{"role":"user","content":"hello"}],"max_tokens":5}'
```

---

## 四、端口规范（固定，不得更改）

| 工件 | 端口 | 环境变量 | 说明 |
|---|---|---|---|
| `api-server`（后端） | **8080** | `PORT=8080` | 开发与生产一致 |
| `api-portal`（前端） | **24927** | `PORT=24927 BASE_PATH=/` | 由 artifact.toml 固定 |
| `mockup-sandbox` | 8081 | `PORT=8081 BASE_PATH=/__mockup` | 开发辅助，按需启动 |

---

## 五、工作流配置参考

`.replit` 文件中的完整工作流配置（供参考，由 artifact 系统自动生成）：

| 工作流名称 | 启动命令 | 端口 | 类型 |
|---|---|---|---|
| `artifacts/api-server: AI Gateway API Server` | `cd artifacts/api-server && PORT=8080 NODE_ENV=development pnpm run build && PORT=8080 NODE_ENV=development pnpm run start` | 8080 | console |
| `artifacts/api-portal: web` | `PORT=24927 BASE_PATH=/ pnpm --filter @workspace/api-portal run dev` | 24927 | webview |

**`artifacts/api-portal: web` 是前端服务的 Replit 工作流名称**，属于正常组件，不可删除（删除后前端将无法访问）。Canvas 上出现的同名 iframe 预览框是 Replit 系统自动创建的 artifact 框，同样无法删除。

---

## 六、AI 服务商配置说明

### 6.1 Replit 托管集成（四个服务商自动注入，无需 API Key）

| 服务商 | 环境变量（自动注入） |
|---|---|
| OpenAI | `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY` |
| Anthropic | `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` / `AI_INTEGRATIONS_ANTHROPIC_API_KEY` |
| Google Gemini | `AI_INTEGRATIONS_GEMINI_BASE_URL` / `AI_INTEGRATIONS_GEMINI_API_KEY` |
| OpenRouter | `AI_INTEGRATIONS_OPENROUTER_BASE_URL` / `AI_INTEGRATIONS_OPENROUTER_API_KEY` |

通过 `setupReplitAIIntegrations()` 开启后，Replit 自动将上游代理 URL 和 Key 注入到运行时。
`.proxy-config.json` 中对应条目会自动填入 `http://localhost:1106/modelfarm/<provider>` 形式的 Base URL。

### 6.2 其他服务商（用户手动配置）

DeepSeek、xAI、Mistral、Moonshot、Groq、Together、SiliconFlow、Cerebras、Fireworks、Novita、Hyperbolic 等服务商的 API Key 由用户在前端 **Settings** 页填写，持久化到 `.proxy-config.json`。

**不要将真实密钥写入源码、文档或日志。**

---

## 七、配置文件说明

### `.proxy-config.json`（运行时生成，位于工作区根目录）

首次启动时自动生成默认配置，包含：
- `proxyApiKey`：访问 `/v1/*` 端点的密钥
- `adminKey`：管理操作密钥
- `providers`：各服务商 baseUrl + apiKey
- `budgetQuotaUsd`：会话消费预算上限（默认 10.0 USD）

**不要将此文件提交到仓库**（已在 `.gitignore` 中排除）。

---

## 八、Replit 部署（发布到生产）

### 8.1 发布前检查

```bash
pnpm run build      # 确认全量构建通过
pnpm run typecheck  # 确认无类型错误
```

### 8.2 发布步骤

1. 在 Replit 工作区点击 **Deploy** 按钮。
2. 选择 **Reserved VM**（推荐，保证持续运行）或 **Autoscale**。
3. 入口命令：
   ```
   export NODE_ENV=production && pnpm run build && pnpm run start
   ```
4. 发布后应用托管在 `.replit.app` 域名或自定义域名下。

### 8.3 发布后验证

```bash
curl https://<domain>/api/healthz
curl https://<domain>/api/version
curl -H "Authorization: Bearer <proxy-key>" https://<domain>/v1/models
```

---

## 九、常见问题

### 前端访问 502

原因：`artifacts/api-portal` 未在 Replit artifact 系统中注册。

解决：执行步骤 4（注册 artifact）并重启工作流。注意：**artifact 未注册时，即使前端工作流正常运行，Replit 代理也不会将 `/` 路径路由到前端服务。**

### `pnpm install` 报 `@workspace/integrations-*` 找不到

原因：`lib/integrations-*` 包未从 skill 模板复制。

解决：执行步骤 1（复制 AI 集成库包），然后重新运行 `pnpm install`。

### AI 调用返回 401 / 403

原因：AI Integrations 未开启，环境变量未注入。

解决：执行步骤 3（开启 AI Integrations）并重启后端工作流。

### 前端工作流启动报 `PORT environment variable is required`

原因：工作流命令未包含 `PORT=24927`。

解决：确保工作流命令为 `PORT=24927 BASE_PATH=/ pnpm --filter @workspace/api-portal run dev`。

### `configureWorkflow()` 报 `managed by an artifact and cannot be overridden`

原因：该工作流已由 artifact 系统自动托管，无法通过 `configureWorkflow()` 覆盖。

解决：这是正常现象，**不需要处理**。直接跳到步骤 6 启动服务即可。

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

*最后更新：2026-05-01*
