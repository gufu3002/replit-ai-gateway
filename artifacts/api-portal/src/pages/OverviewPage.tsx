import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { CopyButton } from "../components/CopyButton";
import { CodeBlock } from "../components/CodeBlock";
import { MethodBadge } from "../components/MethodBadge";
import { TOTAL_MODELS } from "../data/models";
import type { TabId } from "../data/models";

interface OverviewPageProps {
  baseUrl: string;
  setActiveTab: (tab: TabId) => void;
}

export default function OverviewPage({ baseUrl }: OverviewPageProps) {
  return (
    <>
      <div style={{ marginBottom: "24px" }}>
        <SectionTitle>核心功能</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: "12px" }}>
          {[
            { icon: "🚀", title: "零配置部署", desc: "Remix 即用，无需填写任何环境变量。AI 服务商由 Replit AI Integrations 自动接入，Proxy Key 可在 AI Gateway 中随时修改，配置自动持久化到 .proxy-config.json。", color: "#4ade80" },
            { icon: "🔀", title: "多后端路由", desc: "自动按模型名称路由到 15 家服务商，无需手动切换配置，模型名即路由键。", color: "#6366f1" },
            { icon: "📐", title: "多格式兼容", desc: "单一 Base URL 同时支持 OpenAI、Claude Messages、Gemini Native 三种请求格式，自动检测转换。", color: "#3b82f6" },
            { icon: "🔧", title: "工具 / 函数调用", desc: "完整支持 OpenAI 格式的 tools + tool_calls，自动转换到各后端原生格式（Anthropic / Google）。", color: "#f59e0b" },
            { icon: "🧠", title: "扩展思考模式", desc: "Claude、Google、o-series 均支持 -thinking 和 -thinking-visible 后缀别名，可选隐藏或展示推理过程。", color: "#a855f7" },
            { icon: "🔑", title: "多种认证方式", desc: "同时支持 Bearer Token、x-goog-api-key 请求头、?key= URL 参数三种方式，兼容各类客户端。", color: "#10b981" },
            { icon: "⚡", title: "流式输出 SSE", desc: "所有端点均支持 Server-Sent Events 流式输出，包括 Claude 原生格式和 Gemini 原生格式端点。", color: "#f43f5e" },
            { icon: "🎭", title: "请求伪装系统", desc: "21 个 preset（含 none、auto、auto-no-replit 与 18 个具体 SDK/工具 profile），自动注入真实 SDK 请求头指纹，auto 模式按路径智能选择。", color: "#8b5cf6" },
            { icon: "📊", title: "用量分析与费用估算", desc: `完整使用日志记录、P50/P95 延迟分析、每秒 Token 吞吐、30 分钟实时趋势图，以及 ${TOTAL_MODELS} 个模型的美元费用估算。`, color: "#14b8a6" },
            { icon: "▶️", title: "请求重放与模型对比", desc: "从使用日志一键重放任意历史请求，可同时选择第二个模型并行执行，双栏对比响应内容、耗时和状态码。", color: "#f97316" },
            { icon: "⚙️", title: "在线配置管理", desc: "通过 AI Gateway 界面在线修改 Proxy Key、配置 AI 服务商 Base URL 和 API Key，无需重启服务或编辑环境变量。", color: "#06b6d4" },
            { icon: "🛡️", title: "请求路径自动纠错", desc: "自动修正 /v1/v1 去重、/api/v1 去前缀、completion→completions 等常见拼写错误，按端点独立控制开关。", color: "#ec4899" },
          ].map((f) => (
            <div key={f.title} className="feature-card" style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "12px", padding: "16px", borderTopColor: `${f.color}45`,
              transition: "background 0.15s, border-color 0.15s, transform 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ width: "32px", height: "32px", background: `${f.color}15`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{f.icon}</span>
                <span style={{ fontWeight: 600, color: "#cbd5e1", fontSize: "14px" }}>{f.title}</span>
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: "1.6" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>Base URL</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <code style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "10px 16px", fontFamily: "Menlo, monospace", fontSize: "14px", color: "#ddd6fe", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{baseUrl}</code>
          <CopyButton text={baseUrl} label="复制 URL" />
        </div>
        <p style={{ margin: "10px 0 0", fontSize: "14px", color: "#475569" }}>
          在任意 OpenAI 兼容客户端中设为 <strong style={{ color: "#94a3b8" }}>Base URL</strong> 即可。
        </p>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>API 端点</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {([
            { method: "GET", path: "/v1/models", desc: "列出可用模型（OpenAI 兼容格式；带 anthropic-version 请求头时返回 Anthropic 格式）" },
            { method: "GET", path: "/v1beta/models", desc: "列出可用模型（Google 原生格式）" },
            { method: "GET", path: "/v1beta/models/{model}", desc: "查询单个 Google 模型信息（Gemini 原生格式，404 表示不存在）" },
            { method: "POST", path: "/v1/chat/completions", desc: "OpenAI 兼容补全（支持工具调用 + Gemini 格式自动检测）" },
            { method: "POST", path: "/v1/responses", desc: "OpenAI Responses API（gpt-5.3-codex / gpt-5.2-codex 专用，支持流式）" },
            { method: "POST", path: "/v1/messages", desc: "Claude Messages 原生格式（所有后端均支持）" },
            { method: "POST", path: "/v1beta/models/{model}:generateContent", desc: "Gemini 原生格式（非流式）" },
            { method: "POST", path: "/v1beta/models/{model}:streamGenerateContent", desc: "Gemini 原生格式（流式 SSE）" },
          ] as { method: "GET" | "POST"; path: string; desc: string }[]).map((ep) => (
            <div key={ep.path} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 14px" }}>
              <MethodBadge method={ep.method} />
              <code style={{ color: "#e2e8f0", fontFamily: "Menlo, monospace", fontSize: "14px", flex: 1 }}>{ep.path}</code>
              <span style={{ color: "#64748b", fontSize: "14px", flexShrink: 0, maxWidth: "260px", textAlign: "right" }}>{ep.desc}</span>
              <CopyButton text={`${baseUrl}${ep.path}`} />
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>认证方式（三选一）</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { label: "Bearer Token（推荐，兼容所有 OpenAI 客户端）", code: `Authorization: Bearer YOUR_API_KEY` },
            { label: "x-goog-api-key Header（兼容 Gemini 格式客户端）", code: `x-goog-api-key: YOUR_API_KEY` },
            { label: "URL 查询参数（适合简单调试）", code: `${baseUrl}/v1/models?key=YOUR_API_KEY` },
          ].map((auth) => (
            <div key={auth.label}>
              <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "4px" }}>{auth.label}</div>
              <CodeBlock code={auth.code} />
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>快速测试</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px", fontWeight: 500 }}>列出可用模型</div>
            <CodeBlock
              code={`curl ${baseUrl}/v1/models \\\n  -H "Authorization: Bearer YOUR_API_KEY"`}
              copyText={`curl ${baseUrl}/v1/models \\\n  -H "Authorization: Bearer YOUR_API_KEY"`}
            />
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px", fontWeight: 500 }}>Chat Completions（非流式）</div>
            <CodeBlock
              code={`curl ${baseUrl}/v1/chat/completions \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'`}
              copyText={`curl ${baseUrl}/v1/chat/completions \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'`}
            />
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px", fontWeight: 500 }}>流式输出（SSE）</div>
            <CodeBlock
              code={`curl ${baseUrl}/v1/chat/completions \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hello"}],"stream":true}'`}
              copyText={`curl ${baseUrl}/v1/chat/completions \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hello"}],"stream":true}'`}
            />
          </div>
        </div>
      </Card>
    </>
  );
}
