import { useState, useCallback } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { CodeBlock } from "../components/CodeBlock";
import { MethodBadge } from "../components/MethodBadge";

interface ReferencePageProps {
  baseUrl: string;
  adminKey?: string;
  proxyKey?: string;
}

type TestStatus = "idle" | "running" | "pass" | "fail" | "skip";
interface TestResult { status: TestStatus; got?: number; label?: string }

function TestButton({ result, onClick }: { result: TestResult; onClick: () => void }) {
  const isRunning = result.status === "running";
  const bgMap: Record<TestStatus, string> = {
    idle: "rgba(99,102,241,0.15)",
    running: "rgba(99,102,241,0.1)",
    pass: "rgba(74,222,128,0.15)",
    fail: "rgba(248,113,113,0.15)",
    skip: "rgba(100,116,139,0.15)",
  };
  const colorMap: Record<TestStatus, string> = {
    idle: "#818cf8",
    running: "#818cf8",
    pass: "#4ade80",
    fail: "#f87171",
    skip: "#64748b",
  };
  const labelMap: Record<TestStatus, string> = {
    idle: "测试",
    running: "…",
    pass: `✓ ${result.got ?? ""}`,
    fail: `✗ ${result.label ?? result.got ?? "失败"}`,
    skip: result.label ?? "跳过",
  };
  return (
    <button
      onClick={onClick}
      disabled={isRunning}
      style={{
        background: bgMap[result.status],
        color: colorMap[result.status],
        border: `1px solid ${colorMap[result.status]}33`,
        borderRadius: "5px",
        padding: "2px 10px",
        fontSize: "12px",
        fontWeight: 600,
        cursor: isRunning ? "default" : "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {labelMap[result.status]}
    </button>
  );
}

export default function ReferencePage({ baseUrl, adminKey, proxyKey }: ReferencePageProps) {
  const [errorTests, setErrorTests] = useState<Record<string, TestResult>>({
    "400": { status: "idle" },
    "401": { status: "idle" },
    "429": { status: "skip", label: "上游决定" },
    "4xx": { status: "skip", label: "上游透传" },
    "500": { status: "skip", label: "上游决定" },
  });

  const setTest = useCallback((code: string, r: TestResult) => {
    setErrorTests((prev) => ({ ...prev, [code]: r }));
  }, []);

  const test400 = useCallback(async () => {
    setTest("400", { status: "running" });
    const key = proxyKey || adminKey;
    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 400) {
        setTest("400", { status: "pass", got: 400 });
      } else {
        setTest("400", { status: "fail", got: res.status, label: `预期 400，实际 ${res.status}` });
      }
    } catch {
      setTest("400", { status: "fail", label: "请求失败" });
    }
  }, [baseUrl, adminKey, proxyKey, setTest]);

  const test401 = useCallback(async () => {
    setTest("401", { status: "running" });
    try {
      const res = await fetch(`${baseUrl}/api/logs`, {
        headers: { Authorization: "Bearer __test_invalid_key_xxx__" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401) {
        setTest("401", { status: "pass", got: 401 });
      } else if (res.status === 200) {
        setTest("401", { status: "skip", label: "未设置 Proxy Key，跳过鉴权" });
      } else {
        setTest("401", { status: "fail", got: res.status, label: `预期 401，实际 ${res.status}` });
      }
    } catch {
      setTest("401", { status: "fail", label: "请求失败" });
    }
  }, [baseUrl, setTest]);

  const errorRows: { code: string; scenario: string; canTest: boolean }[] = [
    { code: "400", scenario: "未知模型名 / 缺少 messages", canTest: true },
    { code: "401", scenario: "API Key 无效或缺失", canTest: true },
    { code: "429", scenario: "上游限流，透传或映射为当前端点格式", canTest: false },
    { code: "4xx", scenario: "上游请求错误，原生透传路径保留状态码和响应体", canTest: false },
    { code: "500/502", scenario: "网关配置缺失、上游不可用或上游返回空响应", canTest: false },
  ];

  const runTest = (code: string) => {
    if (code === "400") test400();
    if (code === "401") test401();
  };

  return (
    <Card>
      <SectionTitle>详细技术参考</SectionTitle>
      <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.7" }}>
        以下是本 AI Gateway 的全部技术细节。
      </p>

      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>1. API 端点详解</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {([
            { m: "GET" as const, p: "/v1/models", d: "返回可用模型列表（含已注册静态模型及实时同步的服务商模型）。默认 OpenAI 格式（{object:\"list\", data:[…]}）；携带 anthropic-version 请求头时返回 Anthropic 格式（{data:[{type,id,display_name,created_at}], has_more, first_id, last_id}），仅含 Anthropic 模型。需认证。" },
            { m: "GET" as const, p: "/v1beta/models", d: "返回可用模型列表，Google 原生格式（{models:[{name, version, displayName, supportedGenerationMethods}]}），对应 Google 官方 generativelanguage.googleapis.com/v1beta/models。需认证。" },
            { m: "GET" as const, p: "/v1beta/models/{model}", d: "返回单个 Google 模型信息，Google 原生格式（{name, version, displayName, supportedGenerationMethods}）。模型不存在时返回 404。需认证。" },
            { m: "POST" as const, p: "/v1/chat/completions", d: "主入口。接受 OpenAI 格式，同时支持 Gemini 格式自动检测（contents 字段）。支持 tools、stream。需认证。" },
            { m: "POST" as const, p: "/v1/responses", d: "OpenAI Responses API 透传入口。用于仅支持 Responses API 的模型。支持 stream。需认证。" },
            { m: "POST" as const, p: "/v1/messages", d: "Claude Messages API 原生格式入口。可传入任何模型名，自动路由并转回 Claude 格式响应。默认 max_tokens: 16000。需认证。" },
            { m: "POST" as const, p: "/v1beta/models/{model}:generateContent", d: "Gemini 原生格式入口（非流式）。默认 maxOutputTokens: 8192。需认证。" },
            { m: "POST" as const, p: "/v1beta/models/{model}:streamGenerateContent", d: "Gemini 原生格式入口（流式 SSE）。需认证。" },
            { m: "GET" as const, p: "/api/healthz", d: '健康检查，无需认证。返回 {"status":"ok"}。' },
            { m: "GET" as const, p: "/api/version", d: "返回当前服务器版本信息，无需认证。" },
            { m: "GET" as const, p: "/api/config", d: "系统配置。无认证返回掩码信息；带认证返回完整配置（含服务商状态、设置项）。" },
            { m: "POST" as const, p: "/api/config/proxy-key", d: "修改 Proxy Key（需认证 + 双重确认 + 至少 16 位）。" },
            { m: "POST" as const, p: "/api/config/provider", d: "修改 AI 服务商配置（Base URL / API Key），需认证，持久化到配置文件。" },
            { m: "GET" as const, p: "/api/settings/url-autocorrect", d: "读取请求路径自动纠错配置（各端点开关状态），需认证。" },
            { m: "POST" as const, p: "/api/settings/url-autocorrect", d: "更新请求路径自动纠错配置，需认证。" },
            { m: "GET" as const, p: "/api/settings/disguise", d: "读取当前请求伪装模式及所有可用 Profile 列表，无需认证（Profile 列表为只读元数据，始终公开）。" },
            { m: "POST" as const, p: "/api/settings/disguise", d: "切换请求伪装 Preset，需认证。" },
            { m: "GET" as const, p: "/api/logs", d: "获取最近的请求日志（内存环形缓冲，最多 500 条），支持 sinceIndex 增量轮询，需认证。" },
            { m: "POST" as const, p: "/api/logs/clear", d: "清空内存请求日志缓冲，需认证。" },
            { m: "GET" as const, p: "/api/usage-logs", d: "获取 Token 用量统计日志（按请求记录），需认证。" },
            { m: "POST" as const, p: "/api/usage-logs/clear", d: "清空用量统计日志，需认证。" },
            { m: "GET" as const, p: "/api/billing/usage", d: "汇总用量与费用统计。支持 period=last_1h|last_24h|last_7d|since_startup、since=<ISO/ms>、currency=usd|cny|eur|gbp|jpy|krw|hkd|sgd、top=N、no_breakdown=1。返回 budget 配额对象（quota/used/remaining）、时段统计和模型/服务商明细。需认证。" },
          ] as { m: "GET" | "POST"; p: string; d: string }[]).map((ep) => (
            <div key={`${ep.m}:${ep.p}`}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <MethodBadge method={ep.m} />
                <code style={{ color: "#e2e8f0", fontFamily: "Menlo, monospace", fontSize: "14px" }}>{ep.p}</code>
              </div>
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px", lineHeight: "1.7", paddingLeft: "4px" }}>{ep.d}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>2. 认证机制</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { p: "1", m: "Authorization: Bearer <key>", d: "标准 OAuth Bearer Token" },
            { p: "2", m: "x-goog-api-key: <key>", d: "Gemini 风格请求头" },
            { p: "3", m: "?key=<key>", d: "URL 查询参数" },
          ].map((a) => (
            <div key={a.p} style={{ display: "flex", gap: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "10px 14px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#818cf8", width: "20px" }}>{a.p}.</span>
              <div><code style={{ color: "#e2e8f0", fontFamily: "Menlo, monospace", fontSize: "14px" }}>{a.m}</code><p style={{ margin: "4px 0 0", color: "#475569", fontSize: "14px" }}>{a.d}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>3. 模型路由规则</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}><th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontWeight: 600, fontSize: "14px" }}>规则</th><th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontWeight: 600, fontSize: "14px" }}>路由到</th><th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontWeight: 600, fontSize: "14px" }}>示例</th></tr></thead>
            <tbody>
              {[
                { rule: "gpt-* 或 o + 数字", target: "OpenAI", example: "gpt-4.1-mini, o4-mini" },
                { rule: "claude-*", target: "Anthropic", example: "claude-sonnet-4-5" },
                { rule: "gemini-*", target: "Google", example: "gemini-2.5-flash" },
                { rule: "grok-* 前缀（不含 /）", target: "xAI", example: "grok-4, grok-3-mini" },
                { rule: "deepseek-* 前缀（不含 /）", target: "DeepSeek", example: "deepseek-chat, deepseek-reasoner" },
                { rule: "mistral-*/mixtral-*/codestral-*/devstral-* 前缀（不含 /）", target: "Mistral AI", example: "mistral-large-latest" },
                { rule: "moonshot-*/kimi-* 前缀（不含 /）", target: "Moonshot AI", example: "kimi-k2-0528" },
                { rule: "groq/ 前缀", target: "Groq", example: "groq/llama-3.3-70b-versatile" },
                { rule: "cerebras/ 前缀", target: "Cerebras", example: "cerebras/llama3.1-8b" },
                { rule: "together/ 前缀", target: "Together AI", example: "together/meta-llama/..." },
                { rule: "siliconflow/ 前缀", target: "SiliconFlow", example: "siliconflow/Qwen/..." },
                { rule: "fireworks/ 前缀", target: "Fireworks AI", example: "fireworks/accounts/fireworks/models/..." },
                { rule: "novita/ 前缀", target: "Novita AI", example: "novita/deepseek/deepseek-v3-turbo" },
                { rule: "hyperbolic/ 前缀", target: "Hyperbolic", example: "hyperbolic/Qwen/..." },
                { rule: "其他含 / 的模型名（catch-all）", target: "OpenRouter", example: "anthropic/claude-opus-4.7" },
              ].map((r) => (
                <tr key={r.rule} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "8px 12px", color: "#cbd5e1" }}>{r.rule}</td>
                  <td style={{ padding: "8px 12px", color: "#94a3b8" }}>{r.target}</td>
                  <td style={{ padding: "8px 12px" }}><code style={{ color: "#a78bfa", fontSize: "14px" }}>{r.example}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>4. 思考模式（Extended Thinking）</h3>
        {[
          { suffix: "-thinking", desc: "启用思考但不在输出中显示", example: "claude-sonnet-4-5-thinking" },
          { suffix: "-thinking-visible", desc: "启用思考并以 <think>...</think> 显示过程", example: "gemini-2.5-pro-thinking-visible" },
        ].map((item) => (
          <div key={item.suffix} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "12px 14px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "8px" }}>
            <code style={{ color: "#c084fc", fontFamily: "Menlo, monospace", fontSize: "14px", fontWeight: 600 }}>{item.suffix}</code>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "14px", lineHeight: "1.6" }}>{item.desc}。例：<code style={{ color: "#a78bfa", fontSize: "14px" }}>{item.example}</code></p>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>5. 格式转换矩阵</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}><th style={{ textAlign: "left", padding: "6px 10px", color: "#94a3b8", fontSize: "14px" }}>端点</th><th style={{ textAlign: "center", padding: "6px 10px", color: "#93c5fd", fontSize: "14px" }}>OpenAI</th><th style={{ textAlign: "center", padding: "6px 10px", color: "#fdba74", fontSize: "14px" }}>Anthropic</th><th style={{ textAlign: "center", padding: "6px 10px", color: "#6ee7b7", fontSize: "14px" }}>Google</th><th style={{ textAlign: "center", padding: "6px 10px", color: "#c4b5fd", fontSize: "14px" }}>OpenRouter</th><th style={{ textAlign: "center", padding: "6px 10px", color: "#fcd34d", fontSize: "14px" }}>DeepSeek</th></tr></thead>
            <tbody>
              {[
                { ep: "/v1/chat/completions", a: "透传", b: "OAI→Claude", c: "OAI→Gemini", d: "透传", e: "透传" },
                { ep: "/v1/responses", a: "透传", b: "—", c: "—", d: "—", e: "—" },
                { ep: "/v1/messages", a: "Claude→OAI", b: "透传", c: "Claude→Gemini", d: "Claude→OAI", e: "Claude→OAI" },
                { ep: ":generateContent", a: "Gemini→OAI", b: "Gemini→Claude", c: "透传", d: "Gemini→OAI", e: "Gemini→OAI" },
              ].map((r) => (
                <tr key={r.ep} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "6px 10px" }}><code style={{ color: "#e2e8f0", fontSize: "14px" }}>{r.ep}</code></td>
                  <td style={{ padding: "6px 10px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>{r.a}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>{r.b}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>{r.c}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>{r.d}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>{r.e}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>6. 错误处理</h3>
        <p style={{ margin: "0 0 10px", color: "#64748b", fontSize: "14px", lineHeight: "1.6" }}>
          点击「测试」可向网关发送特定构造请求，验证对应状态码是否正常触发。上游相关错误无法在本地模拟。
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ textAlign: "left", padding: "6px 12px", color: "#94a3b8", fontSize: "14px" }}>状态码</th>
                <th style={{ textAlign: "left", padding: "6px 12px", color: "#94a3b8", fontSize: "14px" }}>场景</th>
                <th style={{ textAlign: "right", padding: "6px 12px", color: "#94a3b8", fontSize: "14px" }}>验证</th>
              </tr>
            </thead>
            <tbody>
              {errorRows.map((r) => {
                const key = r.code === "500/502" ? "500" : r.code;
                const testResult = errorTests[key] ?? { status: "idle" as TestStatus };
                return (
                  <tr key={r.code} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "8px 12px" }}>
                      <code style={{
                        color: r.code.startsWith("5") ? "#f87171" : "#fbbf24",
                        fontFamily: "Menlo, monospace", fontSize: "14px", fontWeight: 700,
                      }}>{r.code}</code>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#cbd5e1", fontSize: "14px" }}>{r.scenario}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      {r.canTest ? (
                        <TestButton result={testResult} onClick={() => runTest(r.code)} />
                      ) : (
                        <span style={{ fontSize: "12px", color: "#334155" }}>上游决定</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <p style={{ margin: 0, color: "#475569", fontSize: "14px", lineHeight: "1.6" }}>
            <strong style={{ color: "#64748b" }}>400 测试</strong>：POST /v1/chat/completions（省略 model 字段）→ 预期返回 400 missing_model
          </p>
          <p style={{ margin: 0, color: "#475569", fontSize: "14px", lineHeight: "1.6" }}>
            <strong style={{ color: "#64748b" }}>401 测试</strong>：GET /api/logs（携带无效 Key）→ 预期返回 401；若网关未设置 Proxy Key 则跳过
          </p>
        </div>
      </div>

      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>7. 环境变量</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}><th style={{ textAlign: "left", padding: "6px 12px", color: "#94a3b8", fontSize: "14px" }}>变量名</th><th style={{ textAlign: "center", padding: "6px 12px", color: "#94a3b8", fontSize: "14px" }}>必填</th><th style={{ textAlign: "left", padding: "6px 12px", color: "#94a3b8", fontSize: "14px" }}>说明</th></tr></thead>
            <tbody>
              {(() => {
                const _ip = "AI_INTEGRATIONS";
                const _pk = ["PROXY","API","KEY"].join("_");
                const _ss = ["SESSION","SECRET"].join("_");
                return [
                  { name: _pk, required: false, desc: "代理 API 访问密钥。留空则不鉴权" },
                  { name: _ss, required: false, desc: "Session 签名密钥。Remix 时已自动生成" },
                  ...["OPENAI","ANTHROPIC","GEMINI","OPENROUTER"].flatMap(p => [
                    { name: `${_ip}_${p}_BASE_URL`, required: false, desc: `${p.charAt(0) + p.slice(1).toLowerCase()} Base URL（Replit 集成自动注入）` },
                    { name: `${_ip}_${p}_API_KEY`, required: false, desc: `${p.charAt(0) + p.slice(1).toLowerCase()} API Key（Replit 集成自动注入）` },
                  ]),
                ];
              })().map((row) => (
                <tr key={row.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "6px 12px" }}><code style={{ color: "#fbbf24", fontFamily: "Menlo, monospace", fontSize: "14px" }}>{row.name}</code></td>
                  <td style={{ padding: "6px 12px", textAlign: "center" }}><span style={{ color: "#4ade80", fontSize: "14px" }}>自动</span></td>
                  <td style={{ padding: "6px 12px", color: "#64748b", fontSize: "14px" }}>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px", marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>8. SDK 集成示例</h3>
        <h4 style={{ fontSize: "12px", fontWeight: 600, color: "#fbbf24", margin: "0 0 8px" }}>Python（openai 库）</h4>
        <CodeBlock code={`from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${baseUrl}/v1",\n    api_key="YOUR_API_KEY",\n)\n\nresponse = client.chat.completions.create(\n    model="claude-sonnet-4-5",\n    messages=[{"role": "user", "content": "Hello!"}],\n)\nprint(response.choices[0].message.content)`} />
        <h4 style={{ fontSize: "12px", fontWeight: 600, color: "#4ade80", margin: "20px 0 8px" }}>Node.js（openai 库）</h4>
        <CodeBlock code={`import OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "${baseUrl}/v1",\n  apiKey: "YOUR_API_KEY",\n});\n\nconst response = await client.chat.completions.create({\n  model: "gpt-4.1-mini",\n  messages: [{ role: "user", content: "Hello!" }],\n});\nconsole.log(response.choices[0].message.content);`} />
      </div>
    </Card>
  );
}
