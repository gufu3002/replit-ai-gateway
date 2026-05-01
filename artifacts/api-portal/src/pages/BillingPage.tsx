import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Dropdown } from "../components/Dropdown";
import { PROVIDER_HEX_COLORS } from "../data/models";

interface BillingPageProps {
  adminKey: string;
  setAdminKey: (key: string) => void;
  baseUrl: string;
  activeTab: string;
}

type Currency = "usd" | "cny" | "eur" | "gbp" | "jpy" | "krw" | "hkd" | "sgd";

const CURRENCY_LABELS: Record<Currency, string> = {
  usd: "USD $", cny: "CNY ¥", eur: "EUR €", gbp: "GBP £",
  jpy: "JPY ¥", krw: "KRW ₩", hkd: "HKD $", sgd: "SGD $",
};
const CURRENCY_SYMBOLS: Record<Currency, string> = {
  usd: "$", cny: "¥", eur: "€", gbp: "£", jpy: "¥", krw: "₩", hkd: "$", sgd: "$",
};

interface PeriodStats {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalRequestBodyBytes: number;
  avgRequestBodyBytes: number;
  successCount: number;
  errorCount: number;
  errorRate: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgDurationMs: number;
  avgFirstTokenMs: number | null;
  estimatedCostUsd: number | null;
  estimatedCost: number | null;
  avgCostUsdPerRequest: number | null;
  avgCostPerRequest: number | null;
  currency: string;
}

interface ModelRow extends PeriodStats {
  model: string;
  provider: string;
  pricing: { inputPer1M: number; outputPer1M: number; currency: string } | null;
}

interface ProviderRow extends PeriodStats {
  provider: string;
}

interface BillingData {
  generated_at: string;
  server_started_at: string;
  cache_age_ms: number;
  cache_ttl_ms: number;
  total_session_requests: number;
  ring_buffer_requests: number;
  currency: string;
  budget: {
    quota: number;
    quota_usd: number;
    used: number;
    used_usd: number;
    remaining: number;
    remaining_usd: number;
    usage_ratio: number;
    warn: boolean;
    exceeded: boolean;
    cost_is_partial: boolean;
    currency: string;
  };
  period: {
    since_startup?: PeriodStats;
    last_1h?: PeriodStats;
    last_24h?: PeriodStats;
    last_7d?: PeriodStats;
  };
  by_model?: ModelRow[];
  by_provider?: ProviderRow[];
  meta: {
    since_startup_note: string;
    cost_estimate_partial: boolean;
    pricing_note: string;
    pricing_updated: string;
    fx_rates_note: string;
    ring_buffer_cap: number;
    budget_warn_threshold: string;
  };
}

function fmtCost(val: number | null | undefined, sym: string): string {
  if (val == null) return "—";
  if (val === 0) return `${sym}0`;
  if (val < 0.0001) return `< ${sym}0.0001`;
  if (val < 0.01) return `${sym}${val.toFixed(4)}`;
  if (val < 1) return `${sym}${val.toFixed(3)}`;
  if (val < 100) return `${sym}${val.toFixed(2)}`;
  return `${sym}${Math.round(val).toLocaleString()}`;
}

function fmtTokens(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return iso; }
}

function providerColor(provider: string): string {
  return PROVIDER_HEX_COLORS[provider as keyof typeof PROVIDER_HEX_COLORS] ?? "#64748b";
}

const PERIOD_LABELS: Record<string, string> = {
  since_startup: "本次启动",
  last_1h: "最近 1 小时",
  last_24h: "最近 24 小时",
  last_7d: "最近 7 天",
};

function PeriodCard({ label, stats, sym, isStartup, costPartial }: {
  label: string;
  stats: PeriodStats;
  sym: string;
  isStartup?: boolean;
  costPartial?: boolean;
}) {
  const hasData = stats.requests > 0;
  return (
    <div style={{
      background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "10px", padding: "14px 16px",
    }}>
      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <span>{label}</span>
        {isStartup && costPartial && (
          <span style={{ color: "#fbbf24", fontSize: "12px", fontWeight: 500, textTransform: "none", letterSpacing: "normal" }}>费用部分估算</span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {[
          { label: "请求数", value: hasData ? stats.requests.toLocaleString() : "—" },
          { label: "成功率", value: hasData ? `${((1 - stats.errorRate) * 100).toFixed(1)}%` : "—", err: hasData && stats.errorRate > 0.1 },
          { label: "总 Token", value: hasData ? fmtTokens(stats.totalTokens) : "—" },
          { label: "估算费用", value: hasData ? fmtCost(stats.estimatedCost, sym) : "—", highlight: hasData && !!stats.estimatedCost },
          { label: "输入 Token", value: hasData ? fmtTokens(stats.inputTokens) : "—" },
          { label: "输出 Token", value: hasData ? fmtTokens(stats.outputTokens) : "—" },
          { label: "均延迟", value: hasData && stats.avgDurationMs > 0 ? fmtMs(stats.avgDurationMs) : "—" },
          { label: "首 Token", value: hasData && stats.avgFirstTokenMs != null ? fmtMs(stats.avgFirstTokenMs) : "—" },
        ].map((row) => (
          <div key={row.label}>
            <div style={{ fontSize: "12px", color: "#475569", marginBottom: "2px" }}>{row.label}</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: row.err ? "#f87171" : row.highlight ? "#4ade80" : "#cbd5e1" }}>{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const BUDGET_PRESETS = [1, 2, 5, 10, 20, 50, 100];

export default function BillingPage({ adminKey, setAdminKey, baseUrl, activeTab }: BillingPageProps) {
  const queryClient = useQueryClient();
  const [localAdminKey, setLocalAdminKey] = useState(adminKey);
  const [currency, setCurrency] = useState<Currency>("usd");
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetFeedback, setBudgetFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Keep the password-style input mirrored when adminKey changes from the parent
  // (e.g. set on another page). Prop is the source of truth; localAdminKey only
  // backs the input element so typing without committing does not refetch.
  useEffect(() => { setLocalAdminKey(adminKey); }, [adminKey]);

  const billingQuery = useQuery<BillingData, Error>({
    queryKey: ["billing/usage", baseUrl, currency, adminKey],
    enabled: !!adminKey && activeTab === "billing",
    staleTime: 25_000, // server caches for 30s; refetch slightly earlier
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/billing/usage?currency=${currency}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      return res.json() as Promise<BillingData>;
    },
  });

  const data = billingQuery.data ?? null;
  const loading = billingQuery.isFetching;
  const lastFetched = billingQuery.dataUpdatedAt ? new Date(billingQuery.dataUpdatedAt) : null;
  const error: string | null = (() => {
    if (!billingQuery.error) return null;
    const msg = billingQuery.error.message;
    if (msg === "UNAUTHORIZED") return "Admin Key 无效或权限不足";
    if (msg.startsWith("HTTP_")) return `请求失败：HTTP ${msg.slice(5)}`;
    if (billingQuery.error.name === "TimeoutError") return "请求超时";
    return "网络错误";
  })();

  const refetchBilling = () => billingQuery.refetch();

  const handleKeyCommit = (key: string) => {
    setAdminKey(key);
    // queryKey includes adminKey, so changing it triggers an automatic refetch.
    // 持久化由 useAdminKey 内部完成，无需手动调用 writeAdminKey。
  };

  const handleCurrencyChange = (cur: Currency) => {
    setCurrency(cur);
    // queryKey includes currency, so refetch is automatic when adminKey present.
  };

  const openBudgetEditor = () => {
    const currentUsd = data?.budget?.quota_usd ?? 10;
    setBudgetInput(String(currentUsd));
    setBudgetFeedback(null);
    setBudgetEditing(true);
  };

  const cancelBudgetEdit = () => {
    setBudgetEditing(false);
    setBudgetFeedback(null);
  };

  const saveBudgetMutation = useMutation<number, Error, number>({
    mutationFn: async (val: number) => {
      const res = await fetch(`${baseUrl}/api/settings/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localAdminKey}` },
        body: JSON.stringify({ budgetQuotaUsd: val }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }
      return val;
    },
    onSuccess: (val) => {
      setBudgetFeedback({ ok: true, msg: `已更新为 $${val}` });
      setBudgetEditing(false);
      // Server has a 30s cache; delay slightly before invalidating so the
      // refetch picks up the post-write state instead of the cached pre-write one.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["billing/usage", baseUrl] });
      }, 350);
    },
    onError: (err) => {
      setBudgetFeedback({
        ok: false,
        msg: err.message === "UNAUTHORIZED" ? "Admin Key 无效"
          : err.name === "TimeoutError" ? "请求超时"
          : err.message || "网络错误",
      });
    },
  });

  const budgetSaving = saveBudgetMutation.isPending;

  const saveBudget = () => {
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val < 0) {
      setBudgetFeedback({ ok: false, msg: "请输入有效的非负数（USD）" });
      return;
    }
    setBudgetFeedback(null);
    saveBudgetMutation.mutate(val);
  };

  const sym = CURRENCY_SYMBOLS[currency];
  const budget = data?.budget;
  const usagePct = budget ? Math.min(budget.usage_ratio * 100, 100) : 0;
  const barColor = budget?.exceeded ? "#f87171" : budget?.warn ? "#fbbf24" : "#4ade80";
  const topModels = (data?.by_model ?? []).filter(m => m.requests > 0).slice(0, 15);
  const topProviders = (data?.by_provider ?? []).filter(p => p.requests > 0);
  const maxProviderTokens = Math.max(1, topProviders[0]?.totalTokens ?? 1);

  // Show stale-cache warning if data is older than 25s (cache TTL is 30s)
  const cacheStale = data ? data.cache_age_ms > 25_000 : false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
          <SectionTitle style={{ margin: 0 }}>费用统计</SectionTitle>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="password"
              value={localAdminKey}
              onChange={(e) => setLocalAdminKey(e.target.value)}
              onBlur={() => { if (localAdminKey !== adminKey) handleKeyCommit(localAdminKey); }}
              onKeyDown={(e) => e.key === "Enter" && handleKeyCommit(localAdminKey)}
              placeholder="Admin Key"
              autoComplete="current-password"
              spellCheck={false}
              style={{ width: "148px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "7px", padding: "6px 10px", color: "#e2e8f0", fontSize: "14px", outline: "none" }}
            />
            <Dropdown
              value={currency}
              onChange={(v) => handleCurrencyChange(v as Currency)}
              minWidth="100px"
              options={(Object.keys(CURRENCY_LABELS) as Currency[]).map((c) => ({
                value: c, label: CURRENCY_LABELS[c],
              }))}
            />
            <button
              onClick={() => refetchBilling()}
              disabled={loading}
              style={{
                background: loading ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.15)",
                color: loading ? "#475569" : "#818cf8",
                border: "1px solid rgba(99,102,241,0.3)", borderRadius: "7px",
                padding: "6px 14px", fontSize: "14px", fontWeight: 600,
                cursor: loading ? "default" : "pointer", transition: "all 0.15s",
              }}
            >{loading ? "加载中…" : "刷新"}</button>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "8px", padding: "10px 14px", color: "#f87171", fontSize: "14px", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        {!data && !loading && !error && (
          <p style={{ color: "#475569", fontSize: "14px", textAlign: "center", padding: "24px 0" }}>
            输入 Admin Key 并点击「刷新」以加载费用统计
          </p>
        )}

        {data && budget && (
          <>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0" }}>本次启动预算消耗</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {budget.exceeded && (
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: "4px", padding: "2px 8px" }}>已超限</span>
                  )}
                  {budget.warn && !budget.exceeded && (
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: "4px", padding: "2px 8px" }}>接近上限</span>
                  )}
                  <span style={{ fontSize: "14px", color: barColor, fontWeight: 700 }}>
                    {fmtCost(budget.used, sym)} / {fmtCost(budget.quota, sym)}
                  </span>
                </div>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${usagePct}%`, background: barColor, borderRadius: "4px", transition: "width 0.4s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
                <span style={{ fontSize: "12px", color: "#475569" }}>
                  已用 {(budget.usage_ratio * 100).toFixed(1)}%
                  {budget.cost_is_partial && <span style={{ color: "#fbbf24", marginLeft: "6px" }}>（缓冲区部分估算）</span>}
                </span>
                <span style={{ fontSize: "12px", color: "#475569" }}>
                  剩余 {fmtCost(budget.remaining, sym)}
                </span>
              </div>
            </div>

            {/* ── Budget quota editor ── */}
            {!budgetEditing ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", padding: "8px 12px", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                <span style={{ fontSize: "12px", color: "#475569" }}>预算上限</span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#cbd5e1" }}>${budget.quota_usd}</span>
                <span style={{ fontSize: "12px", color: "#334155" }}>USD</span>
                {budgetFeedback?.ok && (
                  <span style={{ fontSize: "12px", color: "#4ade80", marginLeft: "4px" }}>{budgetFeedback.msg}</span>
                )}
                <button
                  onClick={openBudgetEditor}
                  style={{ marginLeft: "auto", background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "5px", padding: "3px 10px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                >修改</button>
              </div>
            ) : (
              <div style={{ marginBottom: "14px", padding: "12px 14px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "8px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>修改预算上限（USD）</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", color: "#64748b", flexShrink: 0 }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                    autoFocus
                    style={{ width: "100px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "5px 10px", color: "#e2e8f0", fontSize: "14px", outline: "none", fontWeight: 600 }}
                  />
                  <span style={{ fontSize: "12px", color: "#334155" }}>USD</span>
                  <button
                    onClick={saveBudget}
                    disabled={budgetSaving}
                    style={{ background: budgetSaving ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.18)", color: budgetSaving ? "#475569" : "#818cf8", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "6px", padding: "5px 14px", fontSize: "12px", fontWeight: 700, cursor: budgetSaving ? "default" : "pointer" }}
                  >{budgetSaving ? "保存中…" : "保存"}</button>
                  <button
                    onClick={cancelBudgetEdit}
                    disabled={budgetSaving}
                    style={{ background: "transparent", color: "#475569", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}
                  >取消</button>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#334155" }}>快速设置：</span>
                  {BUDGET_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setBudgetInput(String(p))}
                      style={{
                        background: parseFloat(budgetInput) === p ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
                        color: parseFloat(budgetInput) === p ? "#818cf8" : "#64748b",
                        border: `1px solid ${parseFloat(budgetInput) === p ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.07)"}`,
                        borderRadius: "4px", padding: "2px 8px", fontSize: "12px", cursor: "pointer",
                      }}
                    >${p}</button>
                  ))}
                </div>
                {budgetFeedback && !budgetFeedback.ok && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#f87171" }}>{budgetFeedback.msg}</div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              {[
                { k: "total", label: "本次启动请求", value: data.total_session_requests.toLocaleString(), color: "#818cf8" },
                { k: "ring", label: "缓冲区记录", value: data.ring_buffer_requests.toLocaleString(), color: "#94a3b8" },
              ].map((s) => (
                <div key={s.k} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "7px 14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>{s.label}</div>
                </div>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                {lastFetched && (
                  <span style={{ fontSize: "12px", color: "#334155" }}>
                    更新于 {lastFetched.toLocaleTimeString("zh-CN")}
                    {cacheStale && <span style={{ color: "#fbbf24", marginLeft: "5px" }}>缓存中</span>}
                  </span>
                )}
                <span style={{ fontSize: "12px", color: "#1e293b" }}>
                  服务器启动 {fmtDateTime(data.server_started_at)}
                </span>
              </div>
            </div>
          </>
        )}
      </Card>

      {data?.period && (
        <Card>
          <SectionTitle>时段统计</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
            {(["since_startup", "last_1h", "last_24h", "last_7d"] as const).map((key) => {
              const stats = data.period[key];
              if (!stats) return null;
              return (
                <PeriodCard
                  key={key}
                  label={PERIOD_LABELS[key]}
                  stats={stats}
                  sym={sym}
                  isStartup={key === "since_startup"}
                  costPartial={data.meta.cost_estimate_partial}
                />
              );
            })}
          </div>
        </Card>
      )}

      {topProviders.length > 0 && (
        <Card>
          <SectionTitle>服务商用量</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {topProviders.map((p) => {
              const color = providerColor(p.provider);
              const barW = maxProviderTokens > 0 ? (p.totalTokens / maxProviderTokens) * 100 : 0;
              return (
                <div key={p.provider} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color, width: "90px", flexShrink: 0, textTransform: "capitalize" }}>{p.provider}</span>
                    <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${barW}%`, background: color, borderRadius: "2px", opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748b", flexShrink: 0, width: "52px", textAlign: "right" }}>{fmtTokens(p.totalTokens)}</span>
                    <span style={{ fontSize: "12px", color: "#4ade80", flexShrink: 0, width: "70px", textAlign: "right", fontWeight: 600 }}>{fmtCost(p.estimatedCost, sym)}</span>
                    <span style={{ fontSize: "12px", color: "#475569", flexShrink: 0, width: "54px", textAlign: "right" }}>{p.requests} 次</span>
                  </div>
                  <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                    {[
                      { label: "成功率", value: `${((1 - p.errorRate) * 100).toFixed(1)}%`, warn: p.errorRate > 0.1 },
                      { label: "输入", value: fmtTokens(p.inputTokens) },
                      { label: "输出", value: fmtTokens(p.outputTokens) },
                      { label: "均延迟", value: p.avgDurationMs > 0 ? fmtMs(p.avgDurationMs) : "—" },
                      { label: "首 Token", value: p.avgFirstTokenMs != null ? fmtMs(p.avgFirstTokenMs) : "—" },
                    ].map((item) => (
                      <div key={item.label}>
                        <span style={{ fontSize: "12px", color: "#334155" }}>{item.label} </span>
                        <span style={{ fontSize: "12px", color: item.warn ? "#f87171" : "#64748b" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {topModels.length > 0 && (
        <Card>
          <SectionTitle>模型明细（按 Token 量排序）</SectionTitle>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {["模型", "服务商", "请求", "输入", "输出", "成功率", "均延迟", "估算费用"].map((h) => (
                    <th key={h} style={{ textAlign: h === "模型" || h === "服务商" ? "left" : "right", padding: "6px 10px", color: "#64748b", fontWeight: 600, fontSize: "12px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topModels.map((m) => {
                  const color = providerColor(m.provider);
                  return (
                    <tr key={`${m.provider}::${m.model}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "7px 10px" }}>
                        <code style={{ color: "#e2e8f0", fontSize: "14px", fontFamily: "Menlo, monospace" }}>{m.model}</code>
                      </td>
                      <td style={{ padding: "7px 10px" }}>
                        <span style={{ fontSize: "12px", color, fontWeight: 600, textTransform: "capitalize" }}>{m.provider}</span>
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#94a3b8", fontSize: "14px", fontFamily: "Menlo, monospace" }}>{m.requests}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#94a3b8", fontSize: "14px", fontFamily: "Menlo, monospace" }}>{fmtTokens(m.inputTokens)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#94a3b8", fontSize: "14px", fontFamily: "Menlo, monospace" }}>{fmtTokens(m.outputTokens)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontSize: "14px", fontFamily: "Menlo, monospace", color: m.errorRate > 0.1 ? "#f87171" : "#64748b" }}>
                        {((1 - m.errorRate) * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#64748b", fontSize: "14px", fontFamily: "Menlo, monospace" }}>
                        {m.avgDurationMs > 0 ? fmtMs(m.avgDurationMs) : "—"}
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontSize: "14px", fontWeight: m.estimatedCost ? 600 : 400, color: m.estimatedCost ? "#4ade80" : "#334155" }}>
                        {fmtCost(m.estimatedCost, sym)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "10px 0 0", color: "#475569", fontSize: "12px", lineHeight: "1.5" }}>
            费用为参考估算，基于公开定价表（{data?.meta.pricing_updated}）按模型名称匹配。未知模型显示 —。实际计费以各服务商账单为准。
          </p>
        </Card>
      )}

      {data && (
        <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.6", padding: "0 4px" }}>
          本次启动 token 计数来自无上限会话累加器，始终精确。费用估算基于最近 {data.meta.ring_buffer_cap} 条记录（缓冲区），超出部分标记为「缓冲区部分估算」。{data.meta.fx_rates_note}
        </div>
      )}
    </div>
  );
}
