import { useState, useEffect } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { CopyButton } from "../components/CopyButton";
import { ToggleSwitch } from "../components/ToggleSwitch";
import type { SystemConfig, ProviderConfigUpdateBody } from "../data/types";

interface DisguiseProfile { id: string; label: string; desc: string; isSpecial?: boolean; headers?: Record<string, string>; }

const FALLBACK_DISGUISE_PROFILES: DisguiseProfile[] = [
  { id: "none", label: "不伪装", desc: "使用原始请求头，不做任何修改", headers: {} },
  { id: "auto", label: "自动（推荐）", desc: "综合考虑入站请求路径与目标服务商，自动选择最匹配的 SDK 请求头，并为 SDK 类伪装自动注入 Replit 环境标识", isSpecial: true, headers: {} },
  { id: "auto-no-replit", label: "自动（不含 Replit Headers）", desc: "与「自动」相同的智能路由逻辑，但不注入任何 Replit 专属 Headers", isSpecial: true, headers: {} },
  { id: "openai-sdk", label: "OpenAI SDK (Node.js)", desc: "伪装为官方 OpenAI Node.js SDK 请求（openai@6.34.0）", headers: { "user-agent": "OpenAI/JS 6.34.0", "x-stainless-lang": "js", "x-stainless-package-version": "6.34.0", "x-stainless-runtime": "node" } },
  { id: "openai-sdk-py", label: "OpenAI SDK (Python)", desc: "伪装为官方 OpenAI Python SDK 请求（openai==2.32.0，同步客户端）", headers: { "user-agent": "OpenAI/Python 2.32.0", "x-stainless-lang": "python", "x-stainless-package-version": "2.32.0", "x-stainless-runtime": "CPython" } },
  { id: "openai-sdk-py-async", label: "OpenAI SDK (Python, async)", desc: "伪装为官方 OpenAI Python SDK 异步客户端请求（openai==2.32.0，AsyncOpenAI）", headers: { "user-agent": "OpenAI/Python 2.32.0", "x-stainless-lang": "python", "x-stainless-package-version": "2.32.0", "x-stainless-runtime": "CPython", "x-stainless-async": "async" } },
  { id: "openai-sdk-bun", label: "OpenAI SDK (Bun)", desc: "伪装为官方 OpenAI Node.js SDK 在 Bun 运行时发出的请求（openai@6.34.0，bun@1.3.13）", headers: { "user-agent": "OpenAI/JS 6.34.0", "x-stainless-lang": "js", "x-stainless-runtime": "bun", "x-stainless-runtime-version": "1.3.13" } },
  { id: "openai-sdk-deno", label: "OpenAI SDK (Deno)", desc: "伪装为官方 OpenAI Node.js SDK 在 Deno 运行时发出的请求（openai@6.34.0，deno@2.7.12）", headers: { "user-agent": "Deno/2.7.12", "x-stainless-lang": "js", "x-stainless-runtime": "deno", "x-stainless-runtime-version": "2.7.12" } },
  { id: "anthropic-sdk", label: "Anthropic SDK (Node.js)", desc: "伪装为官方 Anthropic Node.js SDK 请求（@anthropic-ai/sdk@0.90.0）", headers: { "user-agent": "Anthropic/JS 0.90.0", "anthropic-version": "2023-06-01", "x-stainless-lang": "js", "x-stainless-package-version": "0.90.0" } },
  { id: "anthropic-sdk-py", label: "Anthropic SDK (Python)", desc: "伪装为官方 Anthropic Python SDK 请求（anthropic==0.96.0，同步客户端）", headers: { "user-agent": "Anthropic/Python 0.96.0", "anthropic-version": "2023-06-01", "x-stainless-lang": "python", "x-stainless-package-version": "0.96.0" } },
  { id: "anthropic-sdk-py-async", label: "Anthropic SDK (Python, async)", desc: "伪装为官方 Anthropic Python SDK 异步客户端请求（anthropic==0.96.0，AsyncAnthropic）", headers: { "user-agent": "Anthropic/Python 0.96.0", "anthropic-version": "2023-06-01", "x-stainless-lang": "python", "x-stainless-async": "async" } },
  { id: "anthropic-sdk-bun", label: "Anthropic SDK (Bun)", desc: "伪装为官方 Anthropic Node.js SDK 在 Bun 运行时发出的请求（@anthropic-ai/sdk@0.90.0，bun@1.3.13）", headers: { "user-agent": "Anthropic/JS 0.90.0", "anthropic-version": "2023-06-01", "x-stainless-runtime": "bun", "x-stainless-runtime-version": "1.3.13" } },
  { id: "gemini-sdk", label: "Google GenAI SDK (Node.js)", desc: "伪装为官方 Google Generative AI Node.js SDK 请求（@google/genai@1.50.1）", headers: { "user-agent": "google-genai-sdk/1.50.1 gl-node/...", "x-goog-api-client": "genai-js/1.50.1 gl-node/..." } },
  { id: "gemini-sdk-py", label: "Google GenAI SDK (Python)", desc: "伪装为官方 Google Generative AI Python SDK 请求（google-genai==1.73.1），使用 httpx/0.28.1 作为底层客户端", headers: { "user-agent": "python-httpx/0.28.1", "x-goog-api-client": "genai-py/1.73.1 gl-python/... httpx/0.28.1" } },
  { id: "openrouter-sdk", label: "OpenRouter (Node.js)", desc: "伪装为通过 OpenRouter 官方客户端发出的 Node.js 请求", headers: { "user-agent": "OpenAI/JS 6.34.0", "HTTP-Referer": "https://openrouter.ai", "X-Title": "OpenRouter Playground" } },
  { id: "litellm", label: "LiteLLM", desc: "伪装为 LiteLLM 代理发出的请求（litellm==1.83.10，openai==2.24.0）", headers: { "user-agent": "litellm/1.83.10", "x-stainless-lang": "python", "x-stainless-package-version": "2.24.0" } },
  { id: "vercel-ai-sdk", label: "Vercel AI SDK", desc: "伪装为 Vercel AI SDK 发出的 Node.js 请求（ai@6.0.168，使用 Node.js 原生 fetch，不携带 user-agent）", headers: { "accept": "application/json, text/event-stream" } },
  { id: "httpx", label: "Python httpx", desc: "伪装为 Python httpx 库直接发出的请求（httpx==0.28.1），常见于 LangChain、LlamaIndex、CrewAI 等框架", headers: { "user-agent": "python-httpx/0.28.1", "accept": "application/json" } },
  { id: "curl", label: "curl", desc: "伪装为 curl 命令行工具请求（curl/8.19.0）", headers: { "user-agent": "curl/8.19.0", "accept": "*/*" } },
  { id: "python-requests", label: "Python requests", desc: "伪装为 Python requests 库发出的请求（requests==2.33.1）", headers: { "user-agent": "python-requests/2.33.1", "accept": "*/*" } },
  { id: "browser-chrome", label: "Chrome 浏览器", desc: "伪装为 Chrome 147 浏览器通过 fetch() 发出的请求", headers: { "user-agent": "Mozilla/5.0 ... Chrome/147.0.0.0 Safari/537.36", "sec-ch-ua": "\"Chromium\";v=\"147\", \"Google Chrome\";v=\"147\", \"Not-A.Brand\";v=\"24\"" } },
];

interface SettingsPageProps {
  adminKey: string;
  setAdminKey: (key: string) => void;
  baseUrl: string;
  urlACConfig: { chatCompletions: boolean; messages: boolean; models: boolean; geminiGenerate: boolean; geminiStream: boolean; global: boolean };
  urlACLoading: boolean;
  toggleUrlAC: (field: "chatCompletions" | "messages" | "models" | "geminiGenerate" | "geminiStream" | "global") => void;
  sysConfig: SystemConfig | null;
  fetchConfig: () => void;
}

export default function SettingsPage({
  adminKey, setAdminKey, baseUrl,
  urlACConfig, urlACLoading, toggleUrlAC,
  sysConfig, fetchConfig,
}: SettingsPageProps) {
  const [newProxyKey, setNewProxyKey] = useState("");
  const [confirmProxyKey, setConfirmProxyKey] = useState("");
  const [proxyKeyMsg, setProxyKeyMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [proxyKeySaving, setProxyKeySaving] = useState(false);

  const [newAdminKey, setNewAdminKey] = useState("");
  const [confirmAdminKey, setConfirmAdminKey] = useState("");
  const [adminKeyMsg, setAdminKeyMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [adminKeySaving, setAdminKeySaving] = useState(false);

  const [providerEdits, setProviderEdits] = useState<Record<string, { baseUrl: string; apiKey: string }>>({});
  const [providerSaveMsg, setProviderSaveMsg] = useState<Record<string, { type: "ok" | "err"; text: string }>>({});

  const [disguisePreset, setDisguisePreset] = useState<string>("none");
  const [savedDisguisePreset, setSavedDisguisePreset] = useState<string>("none");
  const [disguiseProfiles, setDisguiseProfiles] = useState<DisguiseProfile[]>([]);
  const [disguiseSaving, setDisguiseSaving] = useState(false);
  const [disguiseMsg, setDisguiseMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [expandedMode, setExpandedMode] = useState<string | null>(null);
  const [showAllProfiles, setShowAllProfiles] = useState(false);
  const [expandedSdkBadge, setExpandedSdkBadge] = useState<string | null>(null);

  const [budgetQuota, setBudgetQuota] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetMsg, setBudgetMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!adminKey) return;
    fetch(`${baseUrl}/api/settings/budget`, { headers: { Authorization: `Bearer ${adminKey}` } })
      .then(r => r.ok ? r.json() : null)
      .then((d: { budgetQuotaUsd: number } | null) => {
        if (d) { setBudgetQuota(d.budgetQuotaUsd); setBudgetInput(String(d.budgetQuotaUsd)); }
      })
      .catch(() => {});
  }, [baseUrl, adminKey]);

  const saveBudget = async () => {
    const val = parseFloat(budgetInput);
    if (!Number.isFinite(val) || val < 0) { setBudgetMsg({ type: "err", text: "请输入有效的非负数字" }); return; }
    setBudgetSaving(true); setBudgetMsg(null);
    try {
      const r = await fetch(`${baseUrl}/api/settings/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(adminKey ? { Authorization: `Bearer ${adminKey}` } : {}) },
        body: JSON.stringify({ budgetQuotaUsd: val }),
      });
      const d = await r.json() as { budgetQuotaUsd?: number; error?: { message: string } };
      if (!r.ok) { setBudgetMsg({ type: "err", text: d.error?.message || "保存失败" }); }
      else { setBudgetQuota(d.budgetQuotaUsd!); setBudgetMsg({ type: "ok", text: "预算配额已更新" }); }
    } catch { setBudgetMsg({ type: "err", text: "网络错误" }); }
    finally { setBudgetSaving(false); }
  };

  useEffect(() => {
    fetch(`${baseUrl}/api/settings/disguise`)
      .then(r => {
        if (!r.ok) throw new Error("Failed to load disguise profiles");
        return r.json();
      })
      .then((d: { preset: string; profiles: DisguiseProfile[] } | null) => {
        if (d?.profiles?.length) { setDisguisePreset(d.preset); setSavedDisguisePreset(d.preset); setDisguiseProfiles(d.profiles); }
        else { setDisguiseProfiles(FALLBACK_DISGUISE_PROFILES); }
      })
      .catch(() => { setDisguiseProfiles(FALLBACK_DISGUISE_PROFILES); });
  }, [baseUrl]);

  return (
    <>
      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>Base URL</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <code style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "10px 16px", fontFamily: "Menlo, monospace", fontSize: "14px", color: "#ddd6fe", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{baseUrl}</code>
          <CopyButton text={baseUrl} label="复制 URL" />
        </div>
        <p style={{ margin: "10px 0 0", fontSize: "14px", color: "#475569" }}>
          在任意 OpenAI 兼容客户端中设为 <strong style={{ color: "#94a3b8" }}>Base URL</strong> 即可使用本网关。
        </p>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>Admin Key</SectionTitle>
        <div style={{ marginBottom: "14px" }}>
          <label style={{ fontSize: "14px", color: "#64748b", display: "block", marginBottom: "6px" }}>
            输入 Admin Key 以管理以下设置
            {sysConfig && !sysConfig.adminKeyConfigured && (
              <span style={{ marginLeft: "8px", fontSize: "14px", color: "#fbbf24" }}>
                （未设置独立 Admin Key，当前使用 Proxy Key 验证）
              </span>
            )}
          </label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="输入你的 Admin Key"
            autoComplete="current-password"
            spellCheck={false}
            style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 12px", color: "#e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
          />
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
            当 Admin Key 未配置时，Proxy Key 同时具备管理权限。如需分离，请单独配置 Admin Key。
          </p>
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>修改 Admin Key</SectionTitle>
        <p style={{ margin: "0 0 4px", color: "#475569", fontSize: "14px", lineHeight: "1.5" }}>
          Admin Key 是用于管理设置的独立凭证，与 AI 代理使用的 Proxy Key 分离。
        </p>
        <p style={{ margin: "0 0 12px", color: "#475569", fontSize: "14px", lineHeight: "1.5" }}>
          留空可清除 Admin Key，此时回退为 Proxy Key 验证（单人部署模式）。需先在上方输入当前 Admin Key 完成身份验证。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#64748b", fontSize: "14px", width: "64px", flexShrink: 0 }}>新 Key</span>
            <input
              type="password"
              value={newAdminKey}
              onChange={(e) => { setNewAdminKey(e.target.value); setAdminKeyMsg(null); }}
              placeholder="至少 6 位，留空表示清除"
              disabled={!adminKey}
              style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "7px 10px", color: "#e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box", opacity: adminKey ? 1 : 0.4 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#64748b", fontSize: "14px", width: "64px", flexShrink: 0 }}>确认 Key</span>
            <input
              type="password"
              value={confirmAdminKey}
              onChange={(e) => { setConfirmAdminKey(e.target.value); setAdminKeyMsg(null); }}
              placeholder="再次输入新 Admin Key"
              disabled={!adminKey}
              style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "7px 10px", color: "#e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box", opacity: adminKey ? 1 : 0.4 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
            <button
              disabled={!adminKey || adminKeySaving}
              onClick={async () => {
                if (!adminKey) return;
                if (newAdminKey !== "" && newAdminKey.length < 6) { setAdminKeyMsg({ type: "err", text: "新 Admin Key 至少 6 位（或留空以清除）" }); return; }
                if (newAdminKey !== confirmAdminKey) { setAdminKeyMsg({ type: "err", text: "两次输入不一致" }); return; }
                setAdminKeySaving(true); setAdminKeyMsg(null);
                try {
                  const res = await fetch(`${baseUrl}/api/config/admin-key`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
                    body: JSON.stringify({ newKey: newAdminKey, confirmKey: confirmAdminKey }),
                  });
                  const d = await res.json();
                  if (res.ok) {
                    if (newAdminKey === "") {
                      setAdminKeyMsg({ type: "ok", text: "Admin Key 已清除，将回退为 Proxy Key 验证" });
                    } else {
                      setAdminKeyMsg({ type: "ok", text: "Admin Key 已更新，请用新 Admin Key 重新登录" });
                      setAdminKey(newAdminKey);
                    }
                    setNewAdminKey(""); setConfirmAdminKey("");
                    fetchConfig();
                  } else {
                    setAdminKeyMsg({ type: "err", text: d.error?.message || "修改失败" });
                  }
                } catch { setAdminKeyMsg({ type: "err", text: "网络错误" }); }
                setAdminKeySaving(false);
              }}
              style={{ padding: "7px 18px", borderRadius: "8px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: !adminKey ? "#6366f1" : "#a5b4fc", fontSize: "14px", fontWeight: 600, cursor: !adminKey ? "not-allowed" : "pointer", opacity: !adminKey ? 0.4 : 1, transition: "all 0.2s" }}
            >{adminKeySaving ? "保存中..." : "确认修改"}</button>
            {adminKeyMsg && (
              <span style={{ fontSize: "14px", color: adminKeyMsg.type === "ok" ? "#34d399" : "#f87171" }}>{adminKeyMsg.text}</span>
            )}
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>修改 Proxy Key</SectionTitle>
        <p style={{ margin: "0 0 12px", color: "#475569", fontSize: "14px", lineHeight: "1.5" }}>
          Proxy Key 是 AI 请求的凭证，供客户端调用 <code style={{ fontFamily: "Menlo, monospace", fontSize: "14px", color: "#a78bfa" }}>/v1/*</code> 端点使用。修改后旧 Key 立即失效。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#64748b", fontSize: "14px", width: "64px", flexShrink: 0 }}>新 Key</span>
            <input
              type="password"
              value={newProxyKey}
              onChange={(e) => { setNewProxyKey(e.target.value); setProxyKeyMsg(null); }}
              placeholder="至少 6 位"
              disabled={!adminKey}
              style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "7px 10px", color: "#e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box", opacity: adminKey ? 1 : 0.4 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#64748b", fontSize: "14px", width: "64px", flexShrink: 0 }}>确认 Key</span>
            <input
              type="password"
              value={confirmProxyKey}
              onChange={(e) => { setConfirmProxyKey(e.target.value); setProxyKeyMsg(null); }}
              placeholder="再次输入新 Proxy Key"
              disabled={!adminKey}
              style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "7px 10px", color: "#e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box", opacity: adminKey ? 1 : 0.4 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
            <button
              disabled={!adminKey || proxyKeySaving}
              onClick={async () => {
                if (!adminKey) return;
                if (newProxyKey.length < 6) { setProxyKeyMsg({ type: "err", text: "新 Proxy Key 至少 6 位" }); return; }
                if (newProxyKey !== confirmProxyKey) { setProxyKeyMsg({ type: "err", text: "两次输入不一致" }); return; }
                setProxyKeySaving(true); setProxyKeyMsg(null);
                try {
                  const res = await fetch(`${baseUrl}/api/config/proxy-key`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
                    body: JSON.stringify({ newKey: newProxyKey, confirmKey: confirmProxyKey }),
                  });
                  const d = await res.json();
                  if (res.ok) {
                    setProxyKeyMsg({ type: "ok", text: "Proxy Key 已更新，请通知使用者更新其客户端配置" });
                    setNewProxyKey(""); setConfirmProxyKey("");
                    fetchConfig();
                  } else {
                    setProxyKeyMsg({ type: "err", text: d.error?.message || "修改失败" });
                  }
                } catch { setProxyKeyMsg({ type: "err", text: "网络错误" }); }
                setProxyKeySaving(false);
              }}
              style={{ padding: "7px 18px", borderRadius: "8px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: !adminKey ? "#6366f1" : "#a5b4fc", fontSize: "14px", fontWeight: 600, cursor: !adminKey ? "not-allowed" : "pointer", opacity: !adminKey ? 0.4 : 1, transition: "all 0.2s" }}
            >{proxyKeySaving ? "保存中..." : "确认修改"}</button>
            {proxyKeyMsg && (
              <span style={{ fontSize: "14px", color: proxyKeyMsg.type === "ok" ? "#34d399" : "#f87171" }}>{proxyKeyMsg.text}</span>
            )}
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>预算警告配置</SectionTitle>
        <p style={{ margin: "0 0 12px", color: "#475569", fontSize: "14px", lineHeight: "1.5" }}>
          设置本次会话的费用预算上限（美元）。当估算费用达到 80% 时触发警告，超出时标记为超额。
          费用估算基于公开定价表，未知模型不计入统计。
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "0 0 auto" }}>
            <span style={{ fontSize: "14px", color: "#94a3b8" }}>$</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={budgetInput}
              onChange={e => { setBudgetInput(e.target.value); setBudgetMsg(null); }}
              disabled={!adminKey}
              placeholder="10.00"
              style={{ width: "100px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "7px 10px", color: "#e2e8f0", fontSize: "14px", outline: "none" }}
            />
            <span style={{ fontSize: "14px", color: "#64748b" }}>USD / 会话</span>
          </div>
          <button
            onClick={saveBudget}
            disabled={!adminKey || budgetSaving}
            style={{ padding: "7px 18px", borderRadius: "8px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: !adminKey ? "#6366f1" : "#a5b4fc", fontSize: "14px", fontWeight: 600, cursor: !adminKey ? "not-allowed" : "pointer", opacity: !adminKey ? 0.4 : 1 }}
          >{budgetSaving ? "保存中..." : "保存"}</button>
          {budgetMsg && <span style={{ fontSize: "14px", color: budgetMsg.type === "ok" ? "#34d399" : "#f87171" }}>{budgetMsg.text}</span>}
          {budgetQuota !== null && !budgetMsg && (
            <span style={{ fontSize: "14px", color: "#64748b" }}>当前配额：${budgetQuota.toFixed(2)}</span>
          )}
        </div>
        {!adminKey && (
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#64748b" }}>需要先在上方输入 Admin Key 才能修改预算配额。</p>
        )}
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>AI 服务商配置</SectionTitle>
        <p style={{ margin: "0 0 12px", color: "#475569", fontSize: "14px", lineHeight: "1.5" }}>配置各 AI 服务商的 Base URL 和 API Key。已通过 Replit AI Integrations 自动配置的服务商无需手动填写。</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {([
            { key: "openai",      label: "OpenAI",       defaultBase: "https://api.openai.com/v1",                   note: "通过 Replit AI Integrations 自动配置" },
            { key: "anthropic",   label: "Anthropic",    defaultBase: "https://api.anthropic.com",                    note: "通过 Replit AI Integrations 自动配置" },
            { key: "gemini",      label: "Google",       defaultBase: "https://generativelanguage.googleapis.com",    note: "通过 Replit AI Integrations 自动配置" },
            { key: "openrouter",  label: "OpenRouter",   defaultBase: "https://openrouter.ai/api/v1",                 note: "通过 Replit AI Integrations 自动配置" },
            { key: "xai",         label: "xAI (Grok)",   defaultBase: "https://api.x.ai/v1",                          note: "从 console.x.ai 获取 API Key" },
            { key: "deepseek",    label: "DeepSeek",     defaultBase: "https://api.deepseek.com/v1",                  note: "从 platform.deepseek.com 获取 API Key" },
            { key: "mistral",     label: "Mistral AI",   defaultBase: "https://api.mistral.ai/v1",                    note: "从 console.mistral.ai 获取 API Key" },
            { key: "moonshot",    label: "Moonshot AI",  defaultBase: "https://api.moonshot.cn/v1",                   note: "从 platform.moonshot.cn 获取 API Key" },
            { key: "groq",        label: "Groq",         defaultBase: "https://api.groq.com/openai/v1",               note: "从 console.groq.com 获取 API Key；模型名加 groq/ 前缀" },
            { key: "cerebras",    label: "Cerebras",     defaultBase: "https://api.cerebras.ai/v1",                   note: "从 cloud.cerebras.ai 获取 API Key；模型名加 cerebras/ 前缀" },
            { key: "together",    label: "Together AI",  defaultBase: "https://api.together.xyz/v1",                  note: "从 api.together.ai 获取 API Key；模型名加 together/ 前缀" },
            { key: "siliconflow", label: "SiliconFlow",  defaultBase: "https://api.siliconflow.cn/v1",                note: "从 cloud.siliconflow.cn 获取 API Key；模型名加 siliconflow/ 前缀" },
            { key: "fireworks",   label: "Fireworks AI", defaultBase: "https://api.fireworks.ai/inference/v1",         note: "从 fireworks.ai 获取 API Key；模型名加 fireworks/ 前缀" },
            { key: "novita",      label: "Novita AI",    defaultBase: "https://api.novita.ai/v3/openai",               note: "从 novita.ai 获取 API Key；模型名加 novita/ 前缀" },
            { key: "hyperbolic",  label: "Hyperbolic",   defaultBase: "https://api.hyperbolic.xyz/v1",                 note: "从 app.hyperbolic.xyz 获取 API Key；模型名加 hyperbolic/ 前缀" },
          ] as const).map((prov) => {
            const cfg = sysConfig?.providers?.[prov.key];
            const edit = providerEdits[prov.key] || { baseUrl: cfg?.baseUrl ?? "", apiKey: "" };
            const msg = providerSaveMsg[prov.key];
            return (
              <div key={prov.key} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "#cbd5e1", fontSize: "14px" }}>{prov.label}</span>
                    {prov.note && <div style={{ fontSize: "14px", color: "#475569", marginTop: "2px" }}>{prov.note}</div>}
                  </div>
                  <span style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "4px", background: cfg?.configured ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: cfg?.configured ? "#34d399" : "#f87171", border: `1px solid ${cfg?.configured ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, flexShrink: 0, marginLeft: "8px" }}>{cfg?.configured ? "已配置" : "未配置"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#64748b", fontSize: "14px", width: "60px", flexShrink: 0 }}>Base URL</span>
                    <input value={providerEdits[prov.key]?.baseUrl ?? cfg?.baseUrl ?? ""} onChange={(e) => setProviderEdits((p) => ({ ...p, [prov.key]: { ...edit, baseUrl: e.target.value } }))} placeholder={prov.defaultBase} style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "6px 10px", color: "#e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#64748b", fontSize: "14px", width: "60px", flexShrink: 0 }}>API Key</span>
                    <input type="password" value={providerEdits[prov.key]?.apiKey ?? ""} onChange={(e) => setProviderEdits((p) => ({ ...p, [prov.key]: { ...edit, apiKey: e.target.value } }))} placeholder={cfg?.apiKey || "输入 API Key"} style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "6px 10px", color: "#e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <button
                    onClick={async () => {
                      const body: ProviderConfigUpdateBody = { provider: prov.key };
                      const e = providerEdits[prov.key];
                      if (e?.baseUrl !== undefined) body.baseUrl = e.baseUrl;
                      if (e?.apiKey) body.apiKey = e.apiKey;
                      try {
                        const res = await fetch(`${baseUrl}/api/config/provider`, { method: "POST", headers: { "Content-Type": "application/json", ...(adminKey ? { Authorization: `Bearer ${adminKey}` } : {}) }, body: JSON.stringify(body) });
                        if (res.ok) { setProviderSaveMsg((p) => ({ ...p, [prov.key]: { type: "ok", text: "已保存" } })); setProviderEdits((p) => { const n = { ...p }; delete n[prov.key]; return n; }); fetchConfig(); }
                        else { const d = await res.json(); setProviderSaveMsg((p) => ({ ...p, [prov.key]: { type: "err", text: d.error?.message || "保存失败" } })); }
                      } catch { setProviderSaveMsg((p) => ({ ...p, [prov.key]: { type: "err", text: "网络错误" } })); }
                    }}
                    disabled={!adminKey}
                    style={{ padding: "6px 12px", borderRadius: "6px", alignSelf: "flex-end", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: !adminKey ? "#6366f1" : "#a5b4fc", fontSize: "14px", fontWeight: 600, cursor: !adminKey ? "not-allowed" : "pointer", opacity: !adminKey ? 0.4 : 1, transition: "all 0.2s" }}
                  >保存</button>
                </div>
                {msg && <div style={{ marginTop: "6px", padding: "4px 10px", borderRadius: "4px", fontSize: "14px", background: msg.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: msg.type === "ok" ? "#34d399" : "#f87171" }}>{msg.text}</div>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <SectionTitle style={{ margin: 0 }}>请求伪装模式</SectionTitle>
          {savedDisguisePreset === "none" ? (
            <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "20px", background: "rgba(100,116,139,0.15)", border: "1px solid rgba(100,116,139,0.3)", color: "#64748b", fontWeight: 600, letterSpacing: "0.02em", flexShrink: 0 }}>
              ● 已关闭
            </span>
          ) : (
            <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "20px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", color: "#34d399", fontWeight: 600, letterSpacing: "0.02em", flexShrink: 0, maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              ● 已开启 · {disguiseProfiles.find(p => p.id === savedDisguisePreset)?.label ?? savedDisguisePreset}
            </span>
          )}
        </div>
        <p style={{ margin: "0 0 12px", color: "#475569", fontSize: "14px", lineHeight: "1.5" }}>
          对中转至上游服务商的原始 HTTP 请求注入特定 Headers，使其看起来像来自指定 SDK 或客户端。适用于 OpenRouter、DeepSeek 等直连路由。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
          {disguiseProfiles.filter(p =>
            showAllProfiles
            || p.id === "none"
            || p.id === "auto"
            || p.id === "auto-no-replit"
          ).map((p) => {
            const active = disguisePreset === p.id;
            const expanded = expandedMode === p.id;
            const headerEntries = Object.entries(p.headers ?? {});
            const hasHeaders = headerEntries.length > 0;
            const isAutoVariant = p.isSpecial;

            return (
              <div
                key={p.id}
                style={{
                  background: active ? "rgba(99,102,241,0.12)" : "rgba(0,0,0,0.2)",
                  border: `1px solid ${active ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: "8px",
                  transition: "all 0.15s",
                  overflow: "hidden",
                }}
              >
                <div
                  role="button"
                  tabIndex={adminKey ? 0 : -1}
                  aria-disabled={!adminKey}
                  onClick={() => { if (adminKey) setDisguisePreset(p.id); }}
                  onKeyDown={(e) => { if (adminKey && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setDisguisePreset(p.id); } }}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 14px",
                    cursor: adminKey ? "pointer" : active ? "default" : "not-allowed",
                    opacity: adminKey || active ? 1 : 0.45,
                  }}
                >
                  <div style={{
                    width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${active ? "#6366f1" : "rgba(255,255,255,0.2)"}`,
                    background: active ? "#6366f1" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {active && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff" }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: active ? "#a5b4fc" : "#cbd5e1", fontSize: "14px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "5px" }}>
                      {p.label}
                      {isAutoVariant && (
                        <span style={{ fontSize: "12px", padding: "1px 6px", borderRadius: "6px", background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", fontWeight: 600 }}>智能</span>
                      )}
                      {p.id === "auto" && (
                        <span style={{ fontSize: "12px", padding: "1px 6px", borderRadius: "6px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399", fontWeight: 600 }}>默认</span>
                      )}
                    </div>
                    <div style={{ color: "#475569", fontSize: "14px", marginTop: "2px", lineHeight: "1.4" }}>
                      {p.desc}
                    </div>
                    {isAutoVariant && (
                      <div style={{ marginTop: "5px", fontSize: "14px", color: "#334155", fontFamily: "Menlo, monospace", background: "rgba(0,0,0,0.25)", borderRadius: "4px", padding: "3px 8px", display: "inline-block" }}>
                        /v1/messages → anthropic-sdk · Gemini → gemini-sdk · OpenAI → openai-sdk · OpenRouter → openrouter-sdk
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedMode(expanded ? null : p.id); }}
                    title={expanded ? "收起请求头" : "查看请求头"}
                    style={{
                      flexShrink: 0, background: "none", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "5px", padding: "3px 7px", cursor: "pointer",
                      color: expanded ? "#a5b4fc" : "#475569", fontSize: "14px",
                      transition: "all 0.15s", lineHeight: 1,
                    }}
                  >
                    {expanded ? "▾ Headers" : "▸ Headers"}
                  </button>
                </div>
                {expanded && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "10px 14px", background: "rgba(0,0,0,0.2)" }}>
                    {!hasHeaders ? (
                      <span style={{ fontSize: "14px", color: "#64748b", fontStyle: "italic" }}>此模式根据请求动态选择 Headers，展开具体模式可查看各 SDK 的注入内容</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        {headerEntries.map(([k, v]) => (
                          <div key={k} style={{ display: "flex", alignItems: "baseline", gap: "8px", fontSize: "14px", fontFamily: "Menlo, monospace" }}>
                            <span style={{ color: "#94a3b8", flexShrink: 0, minWidth: "220px" }}>{k}</span>
                            <span style={{ color: "#ddd6fe", wordBreak: "break-all" }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button
            onClick={() => setShowAllProfiles(v => !v)}
            className="btn-ghost-subtle"
            style={{
              alignSelf: "flex-start", background: "none", border: "1px solid",
              borderRadius: "6px", padding: "5px 12px", cursor: "pointer",
              fontSize: "14px", fontWeight: 500, lineHeight: 1.4,
            }}
          >
            {showAllProfiles ? "▴ 收起更多选项" : `▾ 展开全部选项（共 ${disguiseProfiles.length} 个）`}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={async () => {
              if (!adminKey) return;
              setDisguiseSaving(true); setDisguiseMsg(null);
              try {
                const res = await fetch(`${baseUrl}/api/settings/disguise`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
                  body: JSON.stringify({ preset: disguisePreset }),
                });
                const d = await res.json();
                if (res.ok) { setSavedDisguisePreset(d.preset); setDisguiseMsg({ type: "ok", text: `已应用：${disguiseProfiles.find(p => p.id === d.preset)?.label || d.preset}` }); }
                else { setDisguiseMsg({ type: "err", text: d.error?.message || "保存失败" }); }
              } catch { setDisguiseMsg({ type: "err", text: "网络错误" }); }
              setDisguiseSaving(false);
            }}
            disabled={!adminKey || disguiseSaving}
            style={{ padding: "7px 18px", borderRadius: "8px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: !adminKey ? "#6366f1" : "#a5b4fc", fontSize: "14px", fontWeight: 600, cursor: !adminKey ? "not-allowed" : "pointer", opacity: !adminKey ? 0.4 : 1, transition: "all 0.2s" }}
          >{disguiseSaving ? "保存中..." : "应用伪装"}</button>
          {disguiseMsg && (
            <span style={{ fontSize: "14px", color: disguiseMsg.type === "ok" ? "#34d399" : "#f87171" }}>{disguiseMsg.text}</span>
          )}
        </div>

        <div style={{ marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "14px" }}>
          <div style={{ fontSize: "14px", color: "#475569", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#fbbf24" }}>⚠</span>
            当前伪装中硬编码的 SDK 版本号，如有新版本发布请手动更新 <code style={{ fontFamily: "Menlo, monospace", fontSize: "14px", background: "rgba(0,0,0,0.3)", padding: "1px 5px", borderRadius: "3px", color: "#a78bfa" }}>disguise.ts</code>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {([
              { label: "openai (JS)", version: "openai@6.34.0", link: "https://github.com/openai/openai-node/releases", profileId: "openai-sdk" },
              { label: "openai (Py)", version: "openai==2.32.0", link: "https://github.com/openai/openai-python/releases", profileId: "openai-sdk-py" },
              { label: "anthropic (JS)", version: "@anthropic-ai/sdk@0.90.0", link: "https://github.com/anthropics/anthropic-sdk-typescript/releases", profileId: "anthropic-sdk" },
              { label: "anthropic (Py)", version: "anthropic==0.96.0", link: "https://github.com/anthropics/anthropic-sdk-python/releases", profileId: "anthropic-sdk-py" },
              { label: "genai (JS)", version: "@google/genai@1.50.1", link: "https://github.com/googleapis/js-genai/releases", profileId: "gemini-sdk" },
              { label: "httpx (Py)", version: "httpx==0.28.1", link: "https://github.com/encode/httpx/releases", profileId: "httpx" },
              { label: "litellm", version: "litellm==1.83.10", link: "https://github.com/BerriAI/litellm/releases", profileId: "litellm" },
            ] as const).map((sdk) => {
              const profile = disguiseProfiles.find(p => p.id === sdk.profileId);
              const hdrs = Object.entries(profile?.headers ?? {});
              const isExpanded = expandedSdkBadge === sdk.profileId;
              return (
                <div
                  key={sdk.label}
                  style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "7px", overflow: "hidden", transition: "border-color 0.15s" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px" }}>
                    <a
                      href={sdk.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "flex", flexDirection: "column", gap: "1px", textDecoration: "none", flex: 1 }}
                    >
                      <span style={{ fontSize: "14px", color: "#94a3b8" }}>{sdk.label}</span>
                      <span style={{ fontFamily: "Menlo, monospace", fontSize: "14px", fontWeight: 600, color: "#a78bfa" }}>{sdk.version} ↗</span>
                    </a>
                    <button
                      onClick={() => setExpandedSdkBadge(isExpanded ? null : sdk.profileId)}
                      style={{
                        flexShrink: 0, background: "none", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "5px", padding: "3px 8px", cursor: "pointer",
                        color: isExpanded ? "#a5b4fc" : "#475569", fontSize: "14px",
                        transition: "all 0.15s", lineHeight: 1.4,
                        borderColor: isExpanded ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)",
                      }}
                    >
                      {isExpanded ? "▾ Headers" : "▸ Headers"}
                    </button>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "8px 12px", background: "rgba(0,0,0,0.2)" }}>
                      {hdrs.length === 0 ? (
                        <span style={{ fontSize: "14px", color: "#64748b", fontStyle: "italic" }}>此模式不注入任何请求头</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          {hdrs.map(([k, v]) => (
                            <div key={k} style={{ display: "flex", alignItems: "baseline", gap: "8px", fontSize: "14px", fontFamily: "Menlo, monospace" }}>
                              <span style={{ color: "#94a3b8", flexShrink: 0, minWidth: "200px" }}>{k}</span>
                              <span style={{ color: "#ddd6fe", wordBreak: "break-all" }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <SectionTitle>请求路径自动纠错</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "#cbd5e1", fontSize: "14px", marginBottom: "4px" }}>全局开关</div>
            <p style={{ margin: 0, color: "#475569", fontSize: "14px", lineHeight: "1.5" }}>总开关关闭后，所有端点的自动纠错均不生效。</p>
          </div>
          <ToggleSwitch enabled={urlACConfig.global} onToggle={() => toggleUrlAC("global")} disabled={urlACLoading || !adminKey} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", opacity: urlACConfig.global ? 1 : 0.4, pointerEvents: urlACConfig.global ? "auto" : "none", transition: "opacity 0.2s" }}>
          {([
            { key: "chatCompletions" as const, label: "/v1/chat/completions", desc: "/v1/v1 去重、/api/v1 去前缀、/completion→completions 等" },
            { key: "messages" as const, label: "/v1/messages", desc: "/message→/messages 等" },
            { key: "models" as const, label: "/v1/models", desc: "/model→/models 等" },
            { key: "geminiGenerate" as const, label: "/v1beta/models/{model}:generateContent", desc: ":generateContent 路径大小写纠错 + 补全 /v1beta 前缀" },
            { key: "geminiStream" as const, label: "/v1beta/models/{model}:streamGenerateContent", desc: ":streamGenerateContent 路径大小写纠错 + 补全 /v1beta 前缀" },
          ]).map((item) => (
            <div key={item.key} style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 14px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "#cbd5e1", fontSize: "14px", marginBottom: "2px" }}>{item.label}</div>
                <div style={{ color: "#475569", fontSize: "14px", lineHeight: "1.4" }}>{item.desc}</div>
              </div>
              <ToggleSwitch enabled={urlACConfig[item.key]} onToggle={() => toggleUrlAC(item.key)} disabled={urlACLoading || !adminKey} size="small" />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
