import { useState, useCallback } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Badge } from "../components/Badge";
import { MethodBadge } from "../components/MethodBadge";
import {
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  GEMINI_MODELS,
  DEEPSEEK_MODELS,
  XAI_MODELS,
  MISTRAL_MODELS,
  MOONSHOT_MODELS,
  GROQ_MODELS,
  TOGETHER_MODELS,
  SILICONFLOW_MODELS,
  CEREBRAS_MODELS,
  FIREWORKS_MODELS,
  NOVITA_MODELS,
  HYPERBOLIC_MODELS,
  TOTAL_MODELS,
} from "../data/models";
import { useLiveOpenRouterModels } from "../hooks/useLiveOpenRouterModels";

interface DocsPageProps {
  baseUrl?: string;
  adminKey?: string;
  proxyKey?: string;
  setProxyKey?: (key: string) => void;
}

type ChanStatus = "idle" | "running" | "ok" | "error" | "no_key";
interface ChanResult { status: ChanStatus; code?: number; ms?: number; msg?: string }

const CHANNEL_PROBES: { id: string; label: string; color: string; model: string }[] = [
  { id: "openai",      label: "OpenAI",      color: "#93c5fd", model: "gpt-4.1-mini" },
  { id: "anthropic",   label: "Anthropic",   color: "#fdba74", model: "claude-haiku-4-5" },
  { id: "gemini",      label: "Google",      color: "#6ee7b7", model: "gemini-2.5-flash" },
  { id: "openrouter",  label: "OpenRouter",  color: "#c4b5fd", model: "openrouter/auto" },
  { id: "xai",         label: "xAI",         color: "#cbd5e1", model: "grok-3-mini" },
  { id: "deepseek",    label: "DeepSeek",    color: "#38bdf8", model: "deepseek-chat" },
  { id: "mistral",     label: "Mistral",     color: "#f9a8d4", model: "mistral-small-latest" },
  { id: "moonshot",    label: "Moonshot",    color: "#a5b4fc", model: "moonshot-v1-8k" },
  { id: "groq",        label: "Groq",        color: "#fca5a5", model: "groq/llama-3.1-8b-instant" },
  { id: "cerebras",    label: "Cerebras",    color: "#fb923c", model: "cerebras/llama3.1-8b" },
  { id: "together",    label: "Together",    color: "#5eead4", model: "together/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo" },
  { id: "siliconflow", label: "SiliconFlow", color: "#86efac", model: "siliconflow/Qwen/Qwen2.5-7B-Instruct" },
  { id: "fireworks",   label: "Fireworks",   color: "#fdba74", model: "fireworks/accounts/fireworks/models/llama4-scout-instruct-basic" },
  { id: "novita",      label: "Novita",      color: "#c4b5fd", model: "novita/deepseek/deepseek-v3-turbo" },
  { id: "hyperbolic",  label: "Hyperbolic",  color: "#67e8f9", model: "hyperbolic/Qwen/Qwen2.5-72B-Instruct" },
];

function ChannelTestCard({ baseUrl, proxyKey, setProxyKey }: { baseUrl: string; proxyKey: string | undefined; setProxyKey?: (k: string) => void }) {
  const [results, setResults] = useState<Record<string, ChanResult>>(() =>
    Object.fromEntries(CHANNEL_PROBES.map((p) => [p.id, { status: "idle" }]))
  );

  const runOne = useCallback(async (probe: (typeof CHANNEL_PROBES)[number]) => {
    setResults((prev) => ({ ...prev, [probe.id]: { status: "running" } }));
    const t0 = Date.now();
    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(proxyKey ? { Authorization: `Bearer ${proxyKey}` } : {}),
        },
        body: JSON.stringify({
          model: probe.model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
          stream: false,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const ms = Date.now() - t0;
      if (res.status === 200) {
        setResults((prev) => ({ ...prev, [probe.id]: { status: "ok", code: 200, ms } }));
      } else {
        let msg = "";
        try { const d = await res.json(); msg = d?.error?.message ?? d?.message ?? ""; } catch {}
        if (res.status === 401 || res.status === 403) {
          const fallback = !proxyKey ? "Proxy Key 未填写" : "认证失败（Key 无效或上游拒绝）";
          setResults((prev) => ({ ...prev, [probe.id]: { status: "no_key", code: res.status, ms, msg: msg || fallback } }));
        } else {
          setResults((prev) => ({ ...prev, [probe.id]: { status: "error", code: res.status, ms, msg: msg || `HTTP ${res.status}` } }));
        }
      }
    } catch (e: unknown) {
      const ms = Date.now() - t0;
      const msg = (e instanceof Error && e.name === "TimeoutError") ? "超时（>15s）" : "网络错误";
      setResults((prev) => ({ ...prev, [probe.id]: { status: "error", ms, msg } }));
    }
  }, [baseUrl, proxyKey]);

  const runAll = useCallback(() => {
    CHANNEL_PROBES.forEach((p) => runOne(p));
  }, [runOne]);

  const anyRunning = Object.values(results).some((r) => r.status === "running");

  return (
    <Card style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <SectionTitle style={{ margin: 0 }}>渠道可用性测试</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="password"
            value={proxyKey ?? ""}
            onChange={(e) => setProxyKey?.(e.target.value)}
            placeholder="Proxy Key"
            autoComplete="current-password"
            spellCheck={false}
            style={{ width: "148px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "5px 10px", color: "#e2e8f0", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
          />
          <button
            onClick={runAll}
            disabled={anyRunning}
            style={{
              background: anyRunning ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.15)",
              color: anyRunning ? "#475569" : "#818cf8",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: "6px",
              padding: "5px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: anyRunning ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {anyRunning ? "测试中…" : "全部测试"}
          </button>
        </div>
      </div>
      <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: "12px", lineHeight: "1.6" }}>
        向每个渠道发送最小真实请求（max_tokens: 5），验证该渠道是否可正常调用。测试结果仅供参考，可能产生上游调用费用并计入使用日志。
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {CHANNEL_PROBES.map((probe) => {
          const r = results[probe.id] ?? { status: "idle" as ChanStatus };
          const statusColor: Record<ChanStatus, string> = {
            idle: "#334155", running: "#818cf8", ok: "#4ade80", error: "#f87171", no_key: "#fbbf24",
          };
          const statusBg: Record<ChanStatus, string> = {
            idle: "rgba(0,0,0,0.2)", running: "rgba(99,102,241,0.08)", ok: "rgba(74,222,128,0.07)", error: "rgba(248,113,113,0.07)", no_key: "rgba(251,191,36,0.07)",
          };
          const statusLabel: Record<ChanStatus, string> = {
            idle: "未测试", running: "测试中…", ok: `✓ 可用  ${r.ms ?? ""}ms`, error: `✗ ${r.msg ?? "失败"}`, no_key: `⚠ ${r.msg ?? "未配置"}`,
          };
          return (
            <div
              key={probe.id}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                background: statusBg[r.status],
                border: `1px solid ${statusColor[r.status]}22`,
                borderRadius: "8px", padding: "10px 14px",
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 700, color: probe.color, width: "88px", flexShrink: 0 }}>{probe.label}</span>
              <code style={{ fontSize: "12px", color: "#475569", fontFamily: "Menlo, monospace", flex: 1 }}>{probe.model}</code>
              <span style={{ fontSize: "12px", color: statusColor[r.status], fontWeight: 600, flexShrink: 0, minWidth: "120px", textAlign: "right" }}>
                {statusLabel[r.status]}
              </span>
              <button
                onClick={() => runOne(probe)}
                disabled={r.status === "running"}
                style={{
                  background: "rgba(99,102,241,0.12)",
                  color: r.status === "running" ? "#475569" : "#818cf8",
                  border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: "5px",
                  padding: "3px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: r.status === "running" ? "default" : "pointer",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                {r.status === "running" ? "…" : "测试"}
              </button>
            </div>
          );
        })}
      </div>
      <p style={{ margin: "12px 0 0", color: "#334155", fontSize: "12px", lineHeight: "1.5" }}>
        HTTP 200 表示渠道可达；401/403 可能是 Proxy Key 未填写、上游额度耗尽或账号受限；其他错误码表示上游拒绝请求（模型名变更、参数非法等）。OpenAI / Anthropic / Gemini / OpenRouter 由 Replit 托管，无需单独配置 API Key，只需 Proxy Key。
      </p>
    </Card>
  );
}

export default function DocsPage({ baseUrl, proxyKey, setProxyKey }: DocsPageProps) {
  const { models: liveOpenRouter, loading: orLoading, error: orError } = useLiveOpenRouterModels(baseUrl ?? window.location.origin);
  const liveOpenRouterCount = liveOpenRouter.length;
  return (
    <>
      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>项目概述</SectionTitle>
        <p style={{ margin: "0 0 12px", color: "#cbd5e1", fontSize: "14px", lineHeight: "1.8" }}>
          AI Gateway 是一个统一的 AI API 代理网关，将 OpenAI、Anthropic、Google、OpenRouter 等 15 家 AI 服务商整合为单一入口。
          客户端只需配置一个 Base URL 和一个 API Key，即可访问所有后端的模型，
          无需为每个服务商分别维护不同的 SDK、认证方式和请求格式。
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: "10px" }}>
          {[
            { label: "支持服务商", value: "15 个", color: "#818cf8" },
            { label: "可用模型", value: liveOpenRouterCount > 0 ? `${TOTAL_MODELS + liveOpenRouterCount} 个` : `${TOTAL_MODELS}+ 个`, color: "#4ade80" },
            { label: "请求格式", value: "3 种", color: "#fbbf24" },
            { label: "认证方式", value: "3 种", color: "#f472b6" },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: s.color, marginBottom: "4px" }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>核心运行机制</SectionTitle>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>1. 请求路由机制</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          网关根据请求中的模型名称自动判断目标服务商，遵循以下路由规则：
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
          {[
            { pattern: "gpt-*、o + 数字（o3/o3-mini/o4/o4-mini 等 o-series）", target: "OpenAI", color: "#93c5fd" },
            { pattern: "claude-*", target: "Anthropic", color: "#fdba74" },
            { pattern: "gemini-*", target: "Google", color: "#6ee7b7" },
            { pattern: "grok-* 前缀（不含 /，如 grok-4、grok-3-mini）", target: "xAI", color: "#fbbf24" },
            { pattern: "deepseek-* 前缀（不含 /，如 deepseek-chat、deepseek-reasoner）", target: "DeepSeek", color: "#38bdf8" },
            { pattern: "mistral-*/mixtral-*/codestral-*/devstral-*/voxtral-*/ministral-* 前缀（不含 /）", target: "Mistral AI", color: "#f472b6" },
            { pattern: "moonshot-*/kimi-* 前缀（不含 /，如 kimi-k2-0528）", target: "Moonshot AI", color: "#a78bfa" },
            { pattern: "groq/ 前缀（如 groq/llama-3.3-70b-versatile）", target: "Groq", color: "#fb923c" },
            { pattern: "cerebras/ 前缀（如 cerebras/llama3.1-8b）", target: "Cerebras", color: "#fb923c" },
            { pattern: "together/ 前缀（如 together/meta-llama/...）", target: "Together AI", color: "#34d399" },
            { pattern: "siliconflow/ 前缀（如 siliconflow/Qwen/...）", target: "SiliconFlow", color: "#60a5fa" },
            { pattern: "fireworks/ 前缀（如 fireworks/accounts/fireworks/models/...）", target: "Fireworks AI", color: "#fdba74" },
            { pattern: "novita/ 前缀（如 novita/deepseek/deepseek-v3-turbo）", target: "Novita AI", color: "#c4b5fd" },
            { pattern: "hyperbolic/ 前缀（如 hyperbolic/Qwen/...）", target: "Hyperbolic", color: "#67e8f9" },
            { pattern: "其他含 / 的模型名（如 anthropic/claude-opus-4.7）", target: "OpenRouter", color: "#c4b5fd" },
          ].map((r) => (
            <div key={r.pattern} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "7px", padding: "8px 12px" }}>
              <code style={{ color: r.color, fontFamily: "Menlo, monospace", fontSize: "14px", flex: 1 }}>{r.pattern}</code>
              <span style={{ fontSize: "14px", color: "#475569" }}>→</span>
              <span style={{ fontSize: "14px", color: "#cbd5e1", fontWeight: 600, flexShrink: 0 }}>{r.target}</span>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>2. 格式自动转换</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          网关接收到请求后，会根据目标服务商自动将请求体转换为对应的原生格式，响应时再转换回客户端期望的格式。
          转换包括消息结构、工具调用格式、系统提示词处理、思考块映射等。
        </p>
        <div style={{ overflowX: "auto", marginBottom: "20px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#94a3b8", fontSize: "14px" }}>请求端点</th>
              <th style={{ textAlign: "center", padding: "8px 10px", color: "#94a3b8", fontSize: "14px" }}>→ OpenAI</th>
              <th style={{ textAlign: "center", padding: "8px 10px", color: "#94a3b8", fontSize: "14px" }}>→ Anthropic</th>
              <th style={{ textAlign: "center", padding: "8px 10px", color: "#94a3b8", fontSize: "14px" }}>→ Google</th>
              <th style={{ textAlign: "center", padding: "8px 10px", color: "#94a3b8", fontSize: "14px" }}>→ OpenRouter</th>
              <th style={{ textAlign: "center", padding: "8px 10px", color: "#94a3b8", fontSize: "14px" }}>→ DeepSeek</th>
            </tr></thead>
            <tbody>
              {[
                { ep: "/v1/chat/completions", a: "透传", b: "OAI→Claude", c: "OAI→Gemini", d: "透传", e: "透传" },
                { ep: "/v1/responses", a: "透传", b: "—", c: "—", d: "—", e: "—" },
                { ep: "/v1/messages", a: "Claude→OAI", b: "透传", c: "Claude→Gemini", d: "Claude→OAI", e: "Claude→OAI" },
                { ep: ":generateContent", a: "Gemini→OAI", b: "Gemini→Claude", c: "透传", d: "Gemini→OAI", e: "Gemini→OAI" },
              ].map((r) => (
                <tr key={r.ep} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "8px 10px" }}><code style={{ color: "#e2e8f0", fontSize: "14px" }}>{r.ep}</code></td>
                  <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{r.a}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{r.b}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{r.c}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{r.d}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{r.e}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>3. 认证与鉴权</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          所有 AI 请求端点均需要通过 Proxy API Key 认证。网关支持三种方式传递密钥，按优先级排列：
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
          {[
            { method: "Authorization: Bearer <key>", desc: "HTTP 标准方式，兼容所有 OpenAI SDK", priority: "优先级 1" },
            { method: "x-goog-api-key: <key>", desc: "兼容 Gemini 原生客户端", priority: "优先级 2" },
            { method: "?key=<key> URL 参数", desc: "适合浏览器调试和简单测试", priority: "优先级 3" },
          ].map((a) => (
            <div key={a.method} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "7px", padding: "8px 12px" }}>
              <code style={{ color: "#fbbf24", fontFamily: "Menlo, monospace", fontSize: "14px", flex: 1 }}>{a.method}</code>
              <span style={{ fontSize: "14px", color: "#475569", flexShrink: 0 }}>{a.desc}</span>
              <span style={{ fontSize: "14px", color: "#334155", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "3px", padding: "1px 6px", flexShrink: 0 }}>{a.priority}</span>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>4. 流式输出（SSE）</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          所有生成端点均支持 Server-Sent Events 流式输出。同服务商原生路径按上游字节直接透传，跨格式路径才会实时解析并转换各服务商的流式响应格式，包括：
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "20px" }}>
          {[
            "OpenAI SSE delta 格式 → 标准 SSE 输出",
            "Anthropic content_block_delta 事件 → OpenAI 兼容 delta 格式",
            "Gemini streamGenerateContent → OpenAI 兼容 delta 格式",
            "思考块（thinking）实时流式输出，支持 <think> 标签包裹",
            "工具调用（tool_calls）流式增量输出",
          ].map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "4px 0" }}>
              <span style={{ color: "#4ade80", fontSize: "14px", flexShrink: 0, marginTop: "2px" }}>•</span>
              <span style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6" }}>{item}</span>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>5. URL 自动纠错</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          网关内置智能 URL 纠错中间件，自动修复常见的路径错误，提高客户端兼容性：
        </p>
        <div style={{ overflowX: "auto", marginBottom: "20px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <th style={{ textAlign: "left", padding: "6px 10px", color: "#94a3b8", fontSize: "14px" }}>错误请求</th>
              <th style={{ textAlign: "center", padding: "6px 10px", color: "#94a3b8", fontSize: "14px" }}>→</th>
              <th style={{ textAlign: "left", padding: "6px 10px", color: "#94a3b8", fontSize: "14px" }}>自动纠正为</th>
            </tr></thead>
            <tbody>
              {[
                { from: "/v1/v1/chat/completions", to: "/v1/chat/completions" },
                { from: "/api/v1/chat/completions", to: "/v1/chat/completions" },
                { from: "/v1/chat/completion", to: "/v1/chat/completions" },
                { from: "/v1/message", to: "/v1/messages" },
                { from: "/v1/model", to: "/v1/models" },
                { from: "/v1beta/v1beta/models/…:generateContent", to: "/v1beta/models/…:generateContent" },
                { from: "/v1/v1beta/models/…:generateContent", to: "/v1beta/models/…:generateContent" },
                { from: "/v1/models/…:generateContent", to: "/v1beta/models/…:generateContent" },
                { from: "/v1/models/…:streamGenerateContent", to: "/v1beta/models/…:streamGenerateContent" },
                { from: "/models/…:generateContent", to: "/v1beta/models/…:generateContent" },
              ].map((r) => (
                <tr key={r.from} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "6px 10px" }}><code style={{ color: "#f87171", fontSize: "14px" }}>{r.from}</code></td>
                  <td style={{ padding: "6px 10px", textAlign: "center", color: "#475569" }}>→</td>
                  <td style={{ padding: "6px 10px" }}><code style={{ color: "#4ade80", fontSize: "14px" }}>{r.to}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>功能详解</SectionTitle>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>扩展思考模式（Extended Thinking）</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          通过在模型名称后添加 <code style={{ color: "#c084fc" }}>-thinking</code> 或 <code style={{ color: "#34d399" }}>-thinking-visible</code> 后缀，
          可以启用模型的扩展思考能力。网关会自动处理各服务商的思考参数差异。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
          {[
            { suffix: "-thinking", desc: "启用扩展思考，思考过程隐藏不输出", example: "claude-sonnet-4-5-thinking", color: "#c084fc" },
            { suffix: "-thinking-visible", desc: "启用扩展思考，思考过程以 <think> 标签可见输出", example: "claude-sonnet-4-5-thinking-visible", color: "#34d399" },
          ].map((t) => (
            <div key={t.suffix} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "7px", padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <code style={{ color: t.color, fontFamily: "Menlo, monospace", fontSize: "14px", fontWeight: 600 }}>{t.suffix}</code>
                <span style={{ fontSize: "14px", color: "#64748b" }}>{t.desc}</span>
              </div>
              <div style={{ fontSize: "14px", color: "#475569" }}>示例：<code style={{ color: "#94a3b8" }}>{t.example}</code></div>
            </div>
          ))}
        </div>
        <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "14px", lineHeight: "1.6" }}>
          支持思考模式的服务商：Anthropic（全系列）、Google（2.5 Pro/Flash 及 3.x Pro 系列）、OpenAI o-series（原生推理，-thinking 后缀为别名）。
          网关会自动将思考预算参数（thinking_budget）转换为各服务商对应的原生参数。
        </p>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>工具调用 / 函数调用（Tool Use）</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          网关完整支持 OpenAI 格式的 <code style={{ color: "#fbbf24" }}>tools</code> 和 <code style={{ color: "#fbbf24" }}>tool_calls</code>，
          并自动转换到各服务商的原生工具调用格式：
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "20px" }}>
          {[
            "OpenAI tools → Anthropic tool_use blocks 自动转换",
            "OpenAI tools → Gemini functionDeclarations 自动转换",
            "工具调用结果（tool role messages）自动转换为各服务商格式",
            "流式输出中的工具调用增量也完整支持",
          ].map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "4px 0" }}>
              <span style={{ color: "#fbbf24", fontSize: "14px", flexShrink: 0, marginTop: "2px" }}>•</span>
              <span style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6" }}>{item}</span>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>配置持久化</h3>
        <p style={{ margin: "0", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          所有通过 AI Gateway 修改的配置（Proxy Key、服务商 Base URL / API Key、URL 纠错开关）
          均持久化存储在项目根目录的 <code style={{ color: "#fbbf24" }}>.proxy-config.json</code> 文件中。
          环境变量优先级高于配置文件：如果同时设置了环境变量和配置文件，环境变量的值将被优先使用。
        </p>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>模型信息</SectionTitle>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>OpenAI 模型（{OPENAI_MODELS.length} 个）</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          包括 GPT-5 系列（5.2/5.1/5/Mini/Nano）、GPT-5.3/5.2 Codex（<strong style={{ color: "#fbbf24" }}>仅 Responses API</strong>，不可使用 /v1/chat/completions）、
          GPT-4.1 系列（标准/Mini/Nano，最高 1M 上下文）、GPT-4o 系列、o-series 推理模型（o3/o3-mini/o4/o4-mini）以及图像/语音专用模型。
          o-series 模型原生支持推理模式，添加 <code style={{ color: "#c084fc" }}>-thinking</code> 后缀等效于直接调用，网关会自动剥离该后缀转发。
        </p>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>Anthropic 模型（{ANTHROPIC_MODELS.length} 个）</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          包括 Opus 4.7/4.6/4.5/4.1、Sonnet 4.6/4.5 以及 Haiku 4.5。每个基础模型都有对应的
          <code style={{ color: "#c084fc" }}>-thinking</code>（思考隐藏）和 <code style={{ color: "#34d399" }}>-thinking-visible</code>（思考可见）变体。
          所有模型支持 200K 上下文窗口和工具调用。
        </p>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>Google 模型（{GEMINI_MODELS.length} 个）</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          包括 Gemini 3.1 Pro Preview、Gemini 3 Pro Preview、Gemini 3 Flash Preview、Gemini 2.5 Pro 和 Gemini 2.5 Flash，
          以及图像生成专用模型（Gemini 3 Pro Image Preview、Gemini 2.5 Flash Image，<strong style={{ color: "#fbbf24" }}>仅限 Gemini 原生格式</strong>，不支持 /v1/chat/completions）。
          扩展思考模式仅支持：Gemini 2.5 Pro/Flash 及 Gemini 3 Pro/3.1 Pro 系列（不含 Flash 系列）。
          Pro 系列与 Flash 系列均支持最高 1M 上下文窗口（Google 未向外公开提供 2M 上下文）。
          支持 OpenAI 兼容格式和 Gemini 原生格式（generateContent / streamGenerateContent）两种调用方式。
        </p>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>OpenRouter 模型（{liveOpenRouterCount} 个{orLoading ? "，同步中…" : orError ? "，同步失败" : ""}）</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          通过 OpenRouter 可访问 xAI Grok、Meta Llama、DeepSeek、Mistral、Qwen、GLM、Cohere 等第三方模型。
          任何包含 <code style={{ color: "#a78bfa" }}>/</code> 的模型名均自动路由到 OpenRouter，不限于预设列表。
          这意味着 OpenRouter 上的所有模型都可以直接使用，只需使用 <code style={{ color: "#a78bfa" }}>provider/model</code> 格式的模型名即可。
        </p>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>原生与 OpenAI 兼容通道</h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          DeepSeek（{DEEPSEEK_MODELS.length} 个，deepseek-chat / deepseek-reasoner）使用 platform.deepseek.com 提供的独立 API Key，
          deepseek-* 且不含斜线的模型会优先按原生服务商路由，不依赖 OpenRouter 转发；
          xAI（{XAI_MODELS.length} 个）、Mistral（{MISTRAL_MODELS.length} 个）、Moonshot（{MOONSHOT_MODELS.length} 个）使用各自官方 API；
          Groq（{GROQ_MODELS.length} 个）、Cerebras（{CEREBRAS_MODELS.length} 个）、Together（{TOGETHER_MODELS.length} 个）、
          SiliconFlow（{SILICONFLOW_MODELS.length} 个）、Fireworks（{FIREWORKS_MODELS.length} 个）、Novita（{NOVITA_MODELS.length} 个）、
          Hyperbolic（{HYPERBOLIC_MODELS.length} 个）使用本地命名空间前缀路由到对应 OpenAI 兼容接口，转发前会剥离前缀。
        </p>

        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>模型能力标签说明</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { badge: "tools" as const, label: "工具", desc: "支持 function calling / tool use，可与外部 API 和工具交互" },
            { badge: "thinking" as const, label: "思考", desc: "支持扩展思考模式，推理过程在内部进行，仅输出最终结果" },
            { badge: "thinking-visible" as const, label: "思考可见", desc: "支持扩展思考模式，推理过程以 <think> 标签形式可见输出" },
            { badge: "reasoning" as const, label: "推理", desc: "原生推理模型（如 o3/o4），内置推理能力，无需显式启用" },
          ].map((b) => (
            <div key={b.badge} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "7px", padding: "8px 12px" }}>
              <Badge variant={b.badge}>{b.label}</Badge>
              <span style={{ fontSize: "14px", color: "#94a3b8", lineHeight: "1.5" }}>{b.desc}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>API 端点详解</SectionTitle>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[
            {
              method: "GET" as const, path: "/v1/models",
              desc: "列出所有可用模型（OpenAI / Anthropic 格式）",
              details: [
                "默认返回 OpenAI 兼容格式：{ object: \"list\", data: [{ id, object, created, owned_by }] }",
                "携带 anthropic-version 请求头时返回 Anthropic 格式：{ data: [{ type, id, display_name, created_at }], has_more, first_id, last_id }，仅含 Anthropic 模型",
                "包含所有已注册的模型及其服务商信息（OpenAI 格式时）",
                "需携带 Proxy API Key 认证",
              ],
            },
            {
              method: "GET" as const, path: "/v1beta/models",
              desc: "列出 Google 模型（Google 原生格式）",
              details: [
                "返回 Google 原生格式：{ models: [{ name, version, displayName, description, supportedGenerationMethods }] }",
                "路径遵循 Google 官方 API 规范（generativelanguage.googleapis.com/v1beta/models）",
                "仅含 Google 模型（不含 -thinking 别名）",
                "需携带 Proxy API Key 认证",
              ],
            },
            {
              method: "GET" as const, path: "/v1beta/models/{model}",
              desc: "查询单个 Google 模型信息",
              details: [
                "返回单个模型 Google 原生格式：{ name, version, displayName, description, supportedGenerationMethods }",
                "模型不存在时返回 404 + NOT_FOUND 错误",
                "需携带 Proxy API Key 认证",
              ],
            },
            {
              method: "POST" as const, path: "/v1/chat/completions",
              desc: "OpenAI 兼容格式补全端点，是最常用的调用方式",
              details: [
                "接收 OpenAI 格式请求（messages 数组 + model 字段）",
                "根据 model 名称自动路由到对应服务商",
                "自动转换请求/响应格式（如发送 Claude 模型时，OAI→Claude 格式转换）",
                "兼容 Gemini 原生格式输入：若请求体含 contents 字段（无 messages），自动转换为 OpenAI messages 格式再路由",
                "Responses API 专用模型（gpt-5.3-codex、gpt-5.2-codex）将返回 400 错误并提示使用 /v1/responses",
                "支持 stream: true 流式输出",
                "支持 tools / tool_choice 工具调用",
                "支持 thinking_budget 思考预算参数",
              ],
            },
            {
              method: "POST" as const, path: "/v1/responses",
              desc: "OpenAI Responses API 原生透传端点，适合 Codex / Responses-only 模型",
              details: [
                "接收 OpenAI Responses API 原生请求格式",
                "仅路由到 OpenAI 后端",
                "非流式和流式响应均按上游状态码、响应头和原始字节返回",
                "支持 stream: true 流式输出",
              ],
            },
            {
              method: "POST" as const, path: "/v1/messages",
              desc: "Claude Messages 原生格式端点，适合已有 Anthropic SDK 的项目",
              details: [
                "接收 Anthropic 原生请求格式",
                "可以路由到任何服务商（不限于 Anthropic）",
                "自动将 Claude 格式转换为目标服务商格式",
                "支持 stream: true 流式输出",
              ],
            },
            {
              method: "POST" as const, path: "/v1beta/models/{model}:generateContent",
              desc: "Gemini 原生格式端点（非流式）",
              details: [
                "接收 Gemini 原生请求格式（contents 数组）",
                "可以路由到任何服务商",
                "自动将 Gemini 格式转换为目标服务商格式",
              ],
            },
            {
              method: "POST" as const, path: "/v1beta/models/{model}:streamGenerateContent",
              desc: "Gemini 原生格式端点（流式 SSE）",
              details: [
                "与 generateContent 相同，但返回流式 SSE 响应",
                "?alt=sse 参数自动处理",
              ],
            },
          ].map((ep) => (
            <div key={ep.path} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <MethodBadge method={ep.method} />
                <code style={{ color: "#e2e8f0", fontFamily: "Menlo, monospace", fontSize: "14px", flex: 1 }}>{ep.path}</code>
              </div>
              <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: "14px" }}>{ep.desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                {ep.details.map((d) => (
                  <div key={d} style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <span style={{ color: "#475569", fontSize: "14px", flexShrink: 0, marginTop: "2px" }}>·</span>
                    <span style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.5" }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>管理 API</SectionTitle>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          以下管理端点用于配置和监控网关。标注「需认证」的端点须携带 Admin Key（或未设置 Admin Key 时使用 Proxy Key）。
        </p>
        {([
          {
            group: "配置管理",
            items: [
              { method: "GET" as const,  path: "/api/config",              auth: false, desc: "公开返回脱敏配置；带 Admin Key 时返回完整管理信息" },
              { method: "POST" as const, path: "/api/config/admin-key",    auth: true,  desc: "修改或清除 Admin Key" },
              { method: "POST" as const, path: "/api/config/proxy-key",    auth: true,  desc: "修改 Proxy API Key" },
              { method: "POST" as const, path: "/api/config/provider",     auth: true,  desc: "配置服务商 Base URL / API Key" },
            ],
          },
          {
            group: "系统设置",
            items: [
              { method: "GET" as const,  path: "/api/settings/budget",             auth: true,  desc: "获取当前预算配额（USD）" },
              { method: "POST" as const, path: "/api/settings/budget",             auth: true,  desc: "设置预算配额（USD），超额时标记警告" },
              { method: "GET" as const,  path: "/api/settings/disguise",           auth: false, desc: "获取当前请求伪装 preset 及完整 Profile 列表（公开，无需认证）" },
              { method: "POST" as const, path: "/api/settings/disguise",           auth: true,  desc: "设置请求伪装 preset" },
              { method: "GET" as const,  path: "/api/settings/url-autocorrect",    auth: true,  desc: "获取 URL 自动纠错各开关状态" },
              { method: "POST" as const, path: "/api/settings/url-autocorrect",    auth: true,  desc: "配置 URL 自动纠错规则" },
            ],
          },
          {
            group: "费用统计",
            items: [
              { method: "GET" as const,  path: "/api/billing/usage",       auth: true,  desc: "获取分时段费用统计、预算状态及分模型 / 分服务商明细" },
            ],
          },
          {
            group: "日志与监控",
            items: [
              { method: "GET" as const,  path: "/api/healthz",             auth: false, desc: "健康检查（无需认证）" },
              { method: "GET" as const,  path: "/api/version",             auth: false, desc: "获取版本信息（无需认证）" },
              { method: "GET" as const,  path: "/api/logs",                auth: true,  desc: "获取最近实时日志；支持 ?limit= 和 ?sinceIndex= 增量轮询" },
              { method: "POST" as const, path: "/api/logs/clear",          auth: true,  desc: "清空实时日志缓冲区" },
              { method: "GET" as const,  path: "/api/usage-logs",          auth: true,  desc: "获取使用日志列表（含 Token 用量、延迟、费用）" },
              { method: "GET" as const,  path: "/api/usage-logs/:id",      auth: true,  desc: "获取单条使用日志详情（含请求体与响应体快照）" },
              { method: "POST" as const, path: "/api/usage-logs/clear",    auth: true,  desc: "清空使用日志" },
            ],
          },
        ] as const).map(({ group, items }) => (
          <div key={group} style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "6px", paddingLeft: "2px" }}>{group}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {items.map((ep) => (
                <div key={ep.method + ep.path} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "7px", padding: "7px 12px" }}>
                  <MethodBadge method={ep.method} />
                  <code style={{ color: "#e2e8f0", fontFamily: "Menlo, monospace", fontSize: "14px", minWidth: "0", flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.path}</code>
                  <span style={{ color: ep.auth ? "#475569" : "#334155", fontSize: "14px", flexShrink: 0, marginLeft: "auto" }}>{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>错误码参考</SectionTitle>
        <div style={{ overflowX: "auto", marginBottom: "16px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontSize: "14px" }}>状态码</th>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontSize: "14px" }}>场景</th>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontSize: "14px" }}>说明</th>
            </tr></thead>
            <tbody>
              {[
                { code: "200", scenario: "请求成功", desc: "正常返回模型响应", color: "#4ade80" },
                { code: "400", scenario: "请求参数错误", desc: "未知模型名、缺少 messages 字段、格式不正确等", color: "#fbbf24" },
                { code: "401", scenario: "认证失败", desc: "Proxy API Key 无效、缺失或过期", color: "#fbbf24" },
                { code: "429", scenario: "请求频率限制", desc: "上游服务商返回的速率限制，网关透传", color: "#fbbf24" },
                { code: "4xx", scenario: "上游请求错误", desc: "原生透传路径保留上游状态码和响应体；跨格式路径映射为当前端点错误格式", color: "#fbbf24" },
                { code: "500", scenario: "服务器内部错误", desc: "本地配置缺失、格式转换异常或上游服务端错误", color: "#f87171" },
                { code: "502", scenario: "上游不可达或空响应", desc: "目标服务商 API 无法连接，或上游未返回响应体", color: "#f87171" },
              ].map((r) => (
                <tr key={r.code} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "8px 12px" }}><code style={{ color: r.color, fontFamily: "Menlo, monospace", fontSize: "14px", fontWeight: 700 }}>{r.code}</code></td>
                  <td style={{ padding: "8px 12px", color: "#cbd5e1", fontSize: "14px" }}>{r.scenario}</td>
                  <td style={{ padding: "8px 12px", color: "#64748b", fontSize: "14px" }}>{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {baseUrl && <ChannelTestCard baseUrl={baseUrl} proxyKey={proxyKey} setProxyKey={setProxyKey} />}

      <Card>
        <SectionTitle>环境变量参考</SectionTitle>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
          以下环境变量可用于配置网关。通过 Replit AI Integrations 部署时，大部分变量会自动注入，无需手动设置。
          通过 AI Gateway 界面修改的配置会持久化到 .proxy-config.json 文件中。
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontSize: "14px" }}>变量名</th>
              <th style={{ textAlign: "center", padding: "8px 12px", color: "#94a3b8", fontSize: "14px" }}>必填</th>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontSize: "14px" }}>说明</th>
            </tr></thead>
            <tbody>
              {(() => {
                const _ip = "AI_INTEGRATIONS";
                const _pk = ["PROXY","API","KEY"].join("_");
                const _ss = ["SESSION","SECRET"].join("_");
                return [
                  { name: _pk, required: "否", desc: "代理 API 访问密钥。留空则不鉴权，强烈建议设置" },
                  { name: _ss, required: "否", desc: "Session 签名密钥。Remix 时已自动生成" },
                  { name: "PORT", required: "否", desc: "服务监听端口，默认自动分配" },
                  ...["OPENAI","ANTHROPIC","GEMINI","DEEPSEEK","OPENROUTER"].flatMap(p => [
                    { name: `${_ip}_${p}_BASE_URL`, required: "否", desc: `${p.charAt(0) + p.slice(1).toLowerCase()} 服务的 Base URL，通过 Integrations 自动注入` },
                    { name: `${_ip}_${p}_API_KEY`, required: "否", desc: `${p.charAt(0) + p.slice(1).toLowerCase()} 的 API Key，通过 Integrations 自动注入` },
                  ]),
                ];
              })().map((row) => (
                <tr key={row.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "8px 12px" }}><code style={{ color: "#fbbf24", fontFamily: "Menlo, monospace", fontSize: "14px" }}>{row.name}</code></td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}><span style={{ color: "#4ade80", fontSize: "14px" }}>{row.required}</span></td>
                  <td style={{ padding: "8px 12px", color: "#94a3b8", fontSize: "14px" }}>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
