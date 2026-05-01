import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Dropdown } from "../components/Dropdown";
import { ALL_MODELS, PROVIDER_LABELS } from "../data/models";
import { useLiveOpenRouterModels } from "../hooks/useLiveOpenRouterModels";
import { estimateCost, formatCost } from "../data/pricing";
import { DisguiseStatsPanel } from "./usageLogs/DisguiseStatsPanel";
import { PerformancePanel } from "./usageLogs/PerformancePanel";
import { SegmentedControl } from "../components/SegmentedControl";
import { TrendPanel } from "./usageLogs/TrendPanel";
import {
  computeDisguiseStats,
  computePerfStats,
  estimateLoadedCost,
  exportToCsv,
  PROVIDER_COLORS,
} from "./usageLogs/stats";
import type {
  PerfGroupBy,
  ReplayResult,
  ReplayState,
  UsageEntry,
  UsageStats,
} from "./usageLogs/types";

interface UsageLogsPageProps {
  adminKey: string;
  setAdminKey: (key: string) => void;
  proxyKey: string;
  setProxyKey: (key: string) => void;
  baseUrl: string;
  activeTab: string;
  jumpToLogs: (search: string) => void;
  externalHighlightTime?: string;
}

function fmtDuration(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

const ENDPOINT_LABELS: Record<string, string> = {
  "chat/completions": "chat",
  "claude-messages": "messages",
  "gemini-generate": "generate",
  "gemini-stream": "g-stream",
  responses: "responses",
};

const USAGE_AUTO_REFRESH_INTERVAL = 15 * 60 * 1000;

export default function UsageLogsPage({
  adminKey,
  setAdminKey,
  proxyKey,
  setProxyKey,
  baseUrl,
  activeTab,
  jumpToLogs,
  externalHighlightTime,
}: UsageLogsPageProps) {
  const [usageFilter, setUsageFilter] = useState<{
    model: string;
    provider: string;
    status: string;
  }>({ model: "", provider: "", status: "" });
  const [usageAutoRefresh, setUsageAutoRefresh] = useState(false);
  const [showDisguiseStats, setShowDisguiseStats] = useState(false);
  const [showPerfStats, setShowPerfStats] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const [perfGroupBy, setPerfGroupBy] = useState<PerfGroupBy>("provider");
  const [modelSearchInput, setModelSearchInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<{
    entry: UsageEntry;
    x: number;
    y: number;
  } | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRefsMap = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const modelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { models: liveOpenRouterModels } = useLiveOpenRouterModels(baseUrl);
  const allModelsWithLive = useMemo(() => {
    const staticIds = new Set(ALL_MODELS.map((m) => m.id));
    const liveOnly = liveOpenRouterModels.filter((m) => !staticIds.has(m.id));
    return [...ALL_MODELS, ...liveOnly];
  }, [liveOpenRouterModels]);

  const emptyResult = (): ReplayResult => ({
    response: null,
    statusCode: null,
    error: null,
    duration: null,
    loading: false,
    requestHeaders: null,
    upstreamRequestHeaders: null,
    responseHeaders: null,
    method: null,
  });
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [headersVisible, setHeadersVisible] = useState<{
    primary: boolean;
    secondary: boolean;
  }>({ primary: false, secondary: false });

  const usageQuery = useQuery<{ logs: UsageEntry[]; stats: UsageStats }, Error>(
    {
      queryKey: [
        "usage-logs",
        baseUrl,
        adminKey,
        usageFilter.model,
        usageFilter.provider,
        usageFilter.status,
      ],
      enabled: !!adminKey,
      // Only auto-poll on the usage tab when the user has opted in.
      refetchInterval:
        usageAutoRefresh && activeTab === "usage"
          ? USAGE_AUTO_REFRESH_INTERVAL
          : false,
      queryFn: async () => {
        const params = new URLSearchParams({ limit: "200" });
        if (usageFilter.model) params.set("model", usageFilter.model);
        if (usageFilter.provider) params.set("provider", usageFilter.provider);
        if (usageFilter.status) params.set("status", usageFilter.status);
        const res = await fetch(`${baseUrl}/api/usage-logs?${params}`, {
          headers: { Authorization: `Bearer ${adminKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return {
          logs: (data.logs ?? []) as UsageEntry[],
          stats: (data.stats ?? {
            totalRequests: 0,
            successCount: 0,
            errorCount: 0,
            totalTokens: 0,
          }) as UsageStats,
        };
      },
    },
  );

  const usageLogs = useMemo(
    () => usageQuery.data?.logs ?? [],
    [usageQuery.data],
  );
  const globalStats = useMemo(
    () =>
      usageQuery.data?.stats ?? {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        totalTokens: 0,
      },
    [usageQuery.data],
  );
  const hasFilter = !!(
    usageFilter.model ||
    usageFilter.provider ||
    usageFilter.status
  );
  // When a filter is active, derive stats from the visible rows so the cards
  // and success-rate pill stay consistent with the table. Otherwise reuse the
  // server-side global stats (which include rows beyond the 200-row limit).
  const usageStats = useMemo(() => {
    if (!hasFilter) return globalStats;
    const s = {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      totalTokens: 0,
    };
    for (const e of usageLogs) {
      s.totalRequests++;
      s.totalTokens += e.inputTokens + e.outputTokens;
      if (e.status === "success") s.successCount++;
      else s.errorCount++;
    }
    return s;
  }, [hasFilter, globalStats, usageLogs]);
  const usageLoading = usageQuery.isFetching;
  const fetchUsageLogs = useCallback(() => {
    usageQuery.refetch();
  }, [usageQuery]);

  // 右键行菜单：点击空白 / 滚动 / Esc / 窗口尺寸变化均关闭
  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [rowMenu]);

  useEffect(() => {
    if (!externalHighlightTime || usageLogs.length === 0) return;
    const targetMs = new Date(externalHighlightTime).getTime();
    if (isNaN(targetMs)) return;

    let bestId: string | null = null;
    let bestDiff = Infinity;
    for (const entry of usageLogs) {
      const startMs = new Date(entry.timestamp).getTime();
      const approxEndMs = startMs + (entry.durationMs ?? 0);
      const diff = Math.abs(approxEndMs - targetMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestId = entry.id;
      }
    }

    if (bestId && bestDiff < 30000) {
      setHighlightedId(bestId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(
        () => setHighlightedId(null),
        4000,
      );
    }
  }, [externalHighlightTime, usageLogs]);

  useLayoutEffect(() => {
    if (!highlightedId) return;
    const el = rowRefsMap.current.get(highlightedId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedId]);

  // Auto-refresh interval is handled by useQuery's refetchInterval option above.

  const handleModelSearchChange = (val: string) => {
    setModelSearchInput(val);
    if (modelDebounceRef.current) clearTimeout(modelDebounceRef.current);
    modelDebounceRef.current = setTimeout(() => {
      setUsageFilter((f) => ({ ...f, model: val }));
    }, 400);
  };

  function getReplayUrl(entry: UsageEntry): string {
    switch (entry.endpoint) {
      case "chat/completions":
        return `${baseUrl}/v1/chat/completions`;
      case "claude-messages":
        return `${baseUrl}/v1/messages`;
      case "gemini-generate":
        return `${baseUrl}/v1beta/models/${entry.model}:generateContent`;
      case "gemini-stream":
        return `${baseUrl}/v1beta/models/${entry.model}:streamGenerateContent`;
      case "responses":
        return `${baseUrl}/v1/responses`;
      default:
        return `${baseUrl}/v1/chat/completions`;
    }
  }

  const openReplay = async (entry: UsageEntry) => {
    const key = adminKey;
    let bodyText = "";
    try {
      const res = await fetch(`${baseUrl}/api/usage-logs/${entry.id}`, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
      });
      if (res.ok) {
        const data = (await res.json()) as UsageEntry & {
          requestBody?: Record<string, unknown>;
        };
        if (data.requestBody) {
          const sanitized = { ...data.requestBody, stream: false };
          bodyText = JSON.stringify(sanitized, null, 2);
        }
      }
    } catch {}
    if (!bodyText) {
      bodyText = JSON.stringify(
        {
          model: entry.model,
          messages: [{ role: "user", content: "Hello" }],
          stream: false,
        },
        null,
        2,
      );
    }
    setHeadersVisible({ primary: false, secondary: false });
    setReplay({
      entry,
      bodyText,
      primary: emptyResult(),
      compareEnabled: false,
      compareModel: "",
      secondary: emptyResult(),
    });
  };

  async function sendOneRequest(
    url: string,
    body: Record<string, unknown>,
    key: string,
    method = "POST",
  ): Promise<ReplayResult> {
    const start = Date.now();
    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Gateway-Debug-Headers": "1",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    };
    try {
      const res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: JSON.stringify({ ...body, stream: false }),
        signal: AbortSignal.timeout(120000),
      });
      const duration = Date.now() - start;
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {}
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, name) => {
        responseHeaders[name] = value;
      });
      let upstreamRequestHeaders: Record<string, string> | null = null;
      const upstreamHeadersRaw = res.headers.get(
        "X-Gateway-Upstream-Request-Headers",
      );
      if (upstreamHeadersRaw) {
        try {
          upstreamRequestHeaders = JSON.parse(upstreamHeadersRaw);
        } catch {}
      }
      return {
        response: pretty,
        statusCode: res.status,
        error: res.ok ? null : `HTTP ${res.status}`,
        duration,
        loading: false,
        requestHeaders: reqHeaders,
        upstreamRequestHeaders,
        responseHeaders,
        method,
      };
    } catch (err) {
      return {
        response: null,
        statusCode: null,
        error: err instanceof Error ? err.message : "请求失败",
        duration: Date.now() - start,
        loading: false,
        requestHeaders: reqHeaders,
        upstreamRequestHeaders: null,
        responseHeaders: null,
        method,
      };
    }
  }

  function getCompareUrl(entry: UsageEntry, compareModel: string): string {
    switch (entry.endpoint) {
      case "claude-messages":
        return `${baseUrl}/v1/messages`;
      case "gemini-generate":
        return `${baseUrl}/v1beta/models/${compareModel}:generateContent`;
      case "gemini-stream":
        return `${baseUrl}/v1beta/models/${compareModel}:streamGenerateContent`;
      case "responses":
        return `${baseUrl}/v1/responses`;
      default:
        return `${baseUrl}/v1/chat/completions`;
    }
  }

  const executeReplay = async () => {
    if (!replay) return;
    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(replay.bodyText);
    } catch {
      setReplay((r) =>
        r
          ? {
              ...r,
              primary: { ...r.primary, error: "JSON 格式错误，请检查请求体" },
            }
          : null,
      );
      return;
    }
    const key = proxyKey || adminKey;
    const primaryUrl = getReplayUrl(replay.entry);
    const doCompare = replay.compareEnabled && !!replay.compareModel;
    const primaryBody = {
      ...parsedBody,
      model: replay.entry.model,
      stream: false,
    };
    const secondaryBody = doCompare
      ? { ...parsedBody, model: replay.compareModel, stream: false }
      : null;
    const secondaryUrl = doCompare
      ? getCompareUrl(replay.entry, replay.compareModel)
      : null;

    const loadingResult = (): ReplayResult => ({
      response: null,
      statusCode: null,
      error: null,
      duration: null,
      loading: true,
      requestHeaders: null,
      upstreamRequestHeaders: null,
      responseHeaders: null,
      method: null,
    });
    setReplay((r) =>
      r
        ? {
            ...r,
            primary: loadingResult(),
            secondary: doCompare ? loadingResult() : emptyResult(),
          }
        : null,
    );

    const tasks = [sendOneRequest(primaryUrl, primaryBody, key)];
    if (secondaryBody && secondaryUrl)
      tasks.push(sendOneRequest(secondaryUrl, secondaryBody, key));
    const [primaryResult, secondaryResult] = await Promise.all(tasks);

    setReplay((r) =>
      r
        ? {
            ...r,
            primary: primaryResult,
            secondary: secondaryResult ?? emptyResult(),
          }
        : null,
    );
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const disguiseStats = useMemo(
    () => computeDisguiseStats(usageLogs),
    [usageLogs],
  );
  const perfRows = useMemo(
    () => computePerfStats(usageLogs, perfGroupBy),
    [usageLogs, perfGroupBy],
  );
  const loadedCost = useMemo(() => estimateLoadedCost(usageLogs), [usageLogs]);
  const successRate =
    usageStats.totalRequests > 0
      ? Math.round((usageStats.successCount / usageStats.totalRequests) * 100)
      : null;

  const inputStyle: React.CSSProperties = {
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "7px",
    padding: "6px 10px",
    color: "#e2e8f0",
    fontSize: "14px",
    outline: "none",
  };
  const btnBase: React.CSSProperties = {
    borderRadius: "7px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    whiteSpace: "nowrap",
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes highlightFade { 0%{background:rgba(99,102,241,0.22)} 70%{background:rgba(99,102,241,0.12)} 100%{background:transparent} }
        .usage-row:hover td { background: rgba(255,255,255,0.018) !important; }
        .usage-row td { transition: background 0.1s; vertical-align: middle; }
        .usage-row.highlighted td { animation: highlightFade 4s ease forwards; }
        .usage-row-menu-item { display: block; width: 100%; text-align: left; background: transparent; border: 0; padding: 7px 12px; color: #cbd5e1; font-size: 14px; cursor: pointer; border-radius: 4px; font-family: inherit; }
        .usage-row-menu-item:hover { background: rgba(99,102,241,0.18); color: #e2e8f0; }
        .usage-row-menu-item .usage-row-menu-shortcut { float: right; color: #475569; font-family: Menlo, monospace; font-size: 12px; margin-left: 16px; }
      `}</style>

      <Card style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <SectionTitle style={{ margin: 0 }}>使用日志</SectionTitle>
          <div
            style={{
              display: "flex",
              gap: "7px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="password"
              value={proxyKey}
              onChange={(e) => setProxyKey(e.target.value)}
              placeholder="Proxy Key"
              autoComplete="current-password"
              spellCheck={false}
              style={{ ...inputStyle, width: "120px" }}
            />
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Admin Key"
              autoComplete="current-password"
              spellCheck={false}
              style={{ ...inputStyle, width: "120px" }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                color: "#64748b",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={usageAutoRefresh}
                onChange={(e) => setUsageAutoRefresh(e.target.checked)}
                style={{ accentColor: "#6366f1" }}
              />
              自动刷新（15 分钟）
            </label>
            <button
              onClick={fetchUsageLogs}
              disabled={usageLoading || !adminKey}
              style={{
                ...btnBase,
                padding: "6px 14px",
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#818cf8",
                opacity: adminKey ? 1 : 0.45,
                cursor: adminKey ? "pointer" : "not-allowed",
              }}
            >
              {usageLoading ? "加载中..." : "↻ 刷新"}
            </button>
            <button
              onClick={() => {
                if (usageLogs.length > 0) exportToCsv(usageLogs);
              }}
              disabled={usageLogs.length === 0}
              style={{
                ...btnBase,
                padding: "6px 14px",
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.25)",
                color: "#34d399",
                opacity: usageLogs.length > 0 ? 1 : 0.4,
                cursor: usageLogs.length > 0 ? "pointer" : "not-allowed",
              }}
            >
              ↓ CSV
            </button>
            <button
              onClick={async () => {
                const key = adminKey;
                if (!key) return;
                await fetch(`${baseUrl}/api/usage-logs/clear`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${key}` },
                });
                fetchUsageLogs();
              }}
              style={{
                ...btnBase,
                padding: "6px 14px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171",
              }}
            >
              清空
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "9px",
            marginBottom: "14px",
            flexWrap: "wrap",
          }}
        >
          {(() => {
            const showRate =
              usageStats.totalRequests > 0 && successRate !== null;
            const sColor = !showRate
              ? ""
              : successRate! >= 95
                ? "#10b981"
                : successRate! >= 80
                  ? "#fbbf24"
                  : "#f87171";
            const sBg = !showRate
              ? ""
              : successRate! >= 95
                ? "rgba(16,185,129,0.08)"
                : successRate! >= 80
                  ? "rgba(250,204,21,0.08)"
                  : "rgba(239,68,68,0.08)";
            const sBd = !showRate
              ? ""
              : successRate! >= 95
                ? "rgba(16,185,129,0.2)"
                : successRate! >= 80
                  ? "rgba(250,204,21,0.2)"
                  : "rgba(239,68,68,0.2)";
            const cards = [
              {
                label: "总请求",
                value: usageStats.totalRequests,
                color: "#94a3b8",
                bg: "rgba(148,163,184,0.08)",
                border: "rgba(148,163,184,0.2)",
              },
              {
                label: "成功",
                value: usageStats.successCount,
                color: "#10b981",
                bg: "rgba(16,185,129,0.08)",
                border: "rgba(16,185,129,0.2)",
              },
              {
                label: "失败",
                value: usageStats.errorCount,
                color: "#f87171",
                bg: "rgba(239,68,68,0.08)",
                border: "rgba(239,68,68,0.2)",
              },
              ...(showRate
                ? [
                    {
                      label: "成功率",
                      value: `${successRate}%`,
                      color: sColor,
                      bg: sBg,
                      border: sBd,
                    },
                  ]
                : []),
              {
                label: "总 Tokens",
                value: usageStats.totalTokens.toLocaleString(),
                color: "#fbbf24",
                bg: "rgba(250,204,21,0.08)",
                border: "rgba(250,204,21,0.2)",
              },
            ];
            return cards.map(({ label, value, color, bg, border }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: "8px",
                  padding: "7px 14px",
                  minWidth: "90px",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: 700, color }}>
                  {value}
                </span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {label}
                </span>
              </div>
            ));
          })()}
          {loadedCost.coveredCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(52,211,153,0.06)",
                border: "1px solid rgba(52,211,153,0.18)",
                borderRadius: "8px",
                padding: "7px 14px",
                minWidth: "90px",
              }}
            >
              <span
                style={{ fontSize: "14px", fontWeight: 700, color: "#34d399" }}
              >
                {formatCost(loadedCost.totalCost)}
              </span>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                估算费用（{loadedCost.coveredCount}/{usageLogs.length}）
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "7px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative" }}>
            <input
              placeholder="搜索模型名称"
              value={modelSearchInput}
              onChange={(e) => handleModelSearchChange(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "28px", width: "172px" }}
            />
            <span
              style={{
                position: "absolute",
                left: "9px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#475569",
                fontSize: "14px",
                pointerEvents: "none",
              }}
            >
              ⌕
            </span>
          </div>
          <Dropdown
            value={usageFilter.provider}
            onChange={(v) => setUsageFilter((f) => ({ ...f, provider: v }))}
            placeholder="全部供应商"
            minWidth="140px"
            options={[
              { value: "", label: "全部供应商" },
              ...Object.entries(PROVIDER_LABELS).map(([id, label]) => ({
                value: id,
                label,
              })),
            ]}
          />
          <Dropdown
            value={usageFilter.status}
            onChange={(v) => setUsageFilter((f) => ({ ...f, status: v }))}
            placeholder="全部状态"
            minWidth="120px"
            options={[
              { value: "", label: "全部状态" },
              { value: "success", label: "成功" },
              { value: "error", label: "失败" },
            ]}
          />
          <div style={{ marginLeft: "auto" }}>
            <SegmentedControl
              allowDeselect
              active={
                showTrend
                  ? "trend"
                  : showPerfStats
                    ? "perf"
                    : showDisguiseStats
                      ? "disguise"
                      : null
              }
              onChange={(key) => {
                setShowTrend(key === "trend");
                setShowPerfStats(key === "perf");
                setShowDisguiseStats(key === "disguise");
              }}
              items={[
                { key: "trend", label: "趋势" },
                { key: "perf", label: "性能" },
                { key: "disguise", label: "伪装" },
              ]}
            />
          </div>
        </div>
      </Card>

      {showTrend && <TrendPanel logs={usageLogs} />}
      {showPerfStats && (
        <PerformancePanel
          rows={perfRows}
          logsCount={usageLogs.length}
          groupBy={perfGroupBy}
          setGroupBy={setPerfGroupBy}
        />
      )}
      {showDisguiseStats && (
        <DisguiseStatsPanel
          stats={disguiseStats}
          logsCount={usageLogs.length}
        />
      )}

      <Card>
        {usageLogs.length === 0 ? (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "#334155",
              fontSize: "14px",
            }}
          >
            {!adminKey
              ? "请输入 Admin Key 后点击刷新"
              : usageLoading
                ? "加载中..."
                : "暂无使用日志"}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
                tableLayout: "fixed",
              }}
            >
              {/* 列宽改为百分比，tableLayout:fixed 下随容器宽度等比缩放，
                各列比例锁定 → 不会抖动，整体不需要横向滚动即可看到全部信息。
                百分比基于原 1150px 等价比例换算（Σ ≈ 100%）。 */}
              <colgroup>
                {/* 用户指定分组：模型 18 / 时间 14 / 供应商·费用 各 10 (共 20) /
                  端点·类型·状态·用时·首字·输入·输出·伪装 各 6 (共 48)。
                  12 列合计 100%，操作列未单独分配，由表格剩余空间承载（min-content）。 */}
                <col style={{ width: "14%" }} />
                {/* 时间   */}
                <col style={{ width: "18%" }} />
                {/* 模型   */}
                <col style={{ width: "10%" }} />
                {/* 供应商 */}
                <col style={{ width: "6%" }} />
                {/* 端点   */}
                <col style={{ width: "6%" }} />
                {/* 类型   */}
                <col style={{ width: "6%" }} />
                {/* 状态   */}
                <col style={{ width: "6%" }} />
                {/* 用时   */}
                <col style={{ width: "6%" }} />
                {/* 首字   */}
                <col style={{ width: "6%" }} />
                {/* 输入   */}
                <col style={{ width: "6%" }} />
                {/* 输出   */}
                <col style={{ width: "10%" }} />
                {/* 费用   */}
                <col style={{ width: "6%" }} />
                {/* 伪装   */}
              </colgroup>
              <thead>
                <tr
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {[
                    { label: "时间", pl: 8 },
                    { label: "模型", pl: 14 }, // 6px 内嵌 badge padding 偏移
                    { label: "供应商", pl: 14 }, // 6px 内嵌 badge padding 偏移
                    { label: "端点", pl: 8 },
                    { label: "类型", pl: 8 },
                    { label: "状态", pl: 8 },
                    { label: "用时", pl: 8 },
                    { label: "首字", pl: 8 },
                    { label: "输入", pl: 8 },
                    { label: "输出", pl: 8 },
                    { label: "费用", pl: 8 },
                    { label: "伪装", pl: 13 }, // 5px 内嵌 badge padding 偏移
                  ].map(({ label, pl }, i) => (
                    <th
                      key={i}
                      style={{
                        padding: `6px 8px 6px ${pl}px`,
                        textAlign: "left",
                        color: "#475569",
                        fontWeight: 600,
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usageLogs.map((entry) => {
                  const cost = estimateCost(
                    entry.model,
                    entry.inputTokens,
                    entry.outputTokens,
                  );
                  const provColor =
                    PROVIDER_COLORS[entry.provider] || "#94a3b8";
                  const isSuccess = entry.status === "success";
                  const isHighlighted = entry.id === highlightedId;
                  return (
                    <tr
                      key={entry.id}
                      className={`usage-row${isHighlighted ? " highlighted" : ""}`}
                      ref={(el) => {
                        if (el) rowRefsMap.current.set(entry.id, el);
                        else rowRefsMap.current.delete(entry.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        // 估算菜单尺寸，避免溢出视口
                        const MENU_W = 168;
                        const MENU_H = 108;
                        const x = Math.min(
                          e.clientX,
                          window.innerWidth - MENU_W - 8,
                        );
                        const y = Math.min(
                          e.clientY,
                          window.innerHeight - MENU_H - 8,
                        );
                        setRowMenu({ entry, x, y });
                      }}
                      style={{ cursor: "context-menu" }}
                    >
                      <td
                        style={{
                          padding: "6px 8px",
                          color: "#475569",
                          whiteSpace: "nowrap",
                          fontSize: "12px",
                          overflow: "hidden",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {(() => {
                          const d = new Date(entry.timestamp);
                          const mo = String(d.getMonth() + 1).padStart(2, "0");
                          const dy = String(d.getDate()).padStart(2, "0");
                          const hh = String(d.getHours()).padStart(2, "0");
                          const mm = String(d.getMinutes()).padStart(2, "0");
                          const ss = String(d.getSeconds()).padStart(2, "0");
                          return `${mo}-${dy} ${hh}:${mm}:${ss}`;
                        })()}
                      </td>
                      <td style={{ padding: "6px 8px", maxWidth: "180px" }}>
                        <span
                          title={entry.model}
                          style={{
                            color: "#c4b5fd",
                            fontFamily: "Menlo, monospace",
                            fontSize: "14px",
                            background: "rgba(99,102,241,0.1)",
                            padding: "0 6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            verticalAlign: "middle",
                          }}
                        >
                          {entry.model}
                        </span>
                      </td>
                      <td style={{ padding: "6px 8px", overflow: "hidden" }}>
                        <span
                          style={{
                            color: provColor,
                            fontWeight: 600,
                            fontSize: "12px",
                            background: `${provColor}15`,
                            border: `1px solid ${provColor}30`,
                            padding: "0 6px",
                            borderRadius: "20px",
                            whiteSpace: "nowrap",
                            display: "inline-block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "100%",
                          }}
                        >
                          {entry.provider}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          color: "#475569",
                          fontSize: "12px",
                          fontFamily: "Menlo, monospace",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ENDPOINT_LABELS[entry.endpoint] ?? entry.endpoint}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <span
                          style={{
                            color: entry.stream ? "#3b82f6" : "#475569",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          {entry.stream ? "流" : "-"}
                        </span>
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            color: isSuccess ? "#10b981" : "#f87171",
                            fontWeight: 600,
                            fontSize: "12px",
                          }}
                        >
                          <span
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "50%",
                              background: isSuccess ? "#10b981" : "#f87171",
                              flexShrink: 0,
                            }}
                          />
                          {entry.statusCode}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          color: "#94a3b8",
                          fontFamily: "Menlo, monospace",
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtDuration(entry.durationMs)}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontFamily: "Menlo, monospace",
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                          color:
                            entry.firstTokenMs !== null
                              ? entry.firstTokenMs > 5000
                                ? "#f87171"
                                : "#fbbf24"
                              : "#2d3748",
                        }}
                      >
                        {entry.firstTokenMs !== null
                          ? fmtDuration(entry.firstTokenMs)
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          color: entry.inputTokens > 0 ? "#64748b" : "#2d3748",
                          fontFamily: "Menlo, monospace",
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.inputTokens > 0
                          ? entry.inputTokens.toLocaleString()
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          color: entry.outputTokens > 0 ? "#64748b" : "#2d3748",
                          fontFamily: "Menlo, monospace",
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.outputTokens > 0
                          ? entry.outputTokens.toLocaleString()
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontFamily: "Menlo, monospace",
                          fontSize: "14px",
                          color: cost !== null ? "#34d399" : "#2d3748",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatCost(cost)}
                      </td>
                      <td style={{ padding: "6px 8px", overflow: "hidden" }}>
                        {entry.disguisePreset &&
                        entry.disguisePreset !== "none" ? (
                          <span
                            style={{
                              fontSize: "12px",
                              fontFamily: "Menlo, monospace",
                              color: "#818cf8",
                              background: "rgba(99,102,241,0.1)",
                              border: "1px solid rgba(99,102,241,0.2)",
                              padding: "0 5px",
                              borderRadius: "4px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {entry.disguisePreset}
                          </span>
                        ) : (
                          <span style={{ color: "#2d3748" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {usageLogs.length > 0 && (
          <div
            style={{
              marginTop: "10px",
              textAlign: "center",
              color: "#334155",
              fontSize: "12px",
            }}
          >
            显示 {usageLogs.length} 条 / 共 {usageStats.totalRequests} 条
          </div>
        )}
      </Card>

      {replay &&
        (() => {
          const isRunning = replay.primary.loading || replay.secondary.loading;
          const doCompare = replay.compareEnabled && !!replay.compareModel;
          const hasAnyResult =
            replay.primary.response ||
            replay.primary.error ||
            replay.primary.requestHeaders ||
            replay.primary.upstreamRequestHeaders ||
            replay.secondary.response ||
            replay.secondary.error ||
            replay.secondary.requestHeaders ||
            replay.secondary.upstreamRequestHeaders;
          const fmtDur = (d: number | null) =>
            d === null
              ? null
              : d < 1000
                ? `${d}ms`
                : `${(d / 1000).toFixed(2)}s`;

          const replayUrl = getReplayUrl(replay.entry);
          function generateCurlCommand(bodyText: string, key: string): string {
            const headers: string[] = [
              `-H 'Content-Type: application/json'`,
              key ? `-H 'Authorization: Bearer ${key}'` : "",
            ].filter(Boolean);
            let compactBody: string;
            try {
              compactBody = JSON.stringify(JSON.parse(bodyText));
            } catch {
              compactBody = bodyText;
            }
            const escapedBody = compactBody
              .replace(/\\/g, "\\\\")
              .replace(/'/g, "'\\''");
            return [
              `curl -sS -X POST '${replayUrl}'`,
              ...headers,
              `-d '${escapedBody}'`,
            ].join(" \\\n  ");
          }

          const hKey = (id: string) => id as "primary" | "secondary";
          function HeadersBlock({
            headers,
            title,
            color,
          }: {
            headers: Record<string, string> | null;
            title: string;
            color: string;
          }) {
            if (!headers) return null;
            const entries = Object.entries(headers);
            return (
              <div style={{ marginTop: "8px" }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color,
                    marginBottom: "4px",
                  }}
                >
                  {title}
                </div>
                <pre
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    color: "#94a3b8",
                    fontFamily: "Menlo, monospace",
                    fontSize: "14px",
                    maxHeight: "180px",
                    overflowY: "auto",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {entries.length === 0
                    ? "(无)"
                    : entries.map(([k, v]) => `${k}: ${v}`).join("\n")}
                </pre>
              </div>
            );
          }

          function ResultPanel({
            result,
            label,
            model,
            resultId,
          }: {
            result: ReplayResult;
            label: string;
            model: string;
            resultId: string;
          }) {
            const showHdr = headersVisible[hKey(resultId)];
            const hasHeaders =
              result.requestHeaders !== null ||
              result.upstreamRequestHeaders !== null ||
              result.responseHeaders !== null;
            const isErrResponse =
              result.statusCode !== null && result.statusCode >= 400;
            const bodyColor = isErrResponse ? "#f87171" : "#86efac";
            const bodyBorderColor = isErrResponse
              ? "rgba(248,113,113,0.15)"
              : "rgba(255,255,255,0.07)";
            const bodyBg = isErrResponse
              ? "rgba(239,68,68,0.06)"
              : "rgba(0,0,0,0.4)";
            return (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#64748b",
                    }}
                  >
                    {label}
                  </span>
                  <code
                    style={{
                      fontSize: "14px",
                      color: "#818cf8",
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      fontFamily: "Menlo, monospace",
                    }}
                  >
                    {model}
                  </code>
                  {result.method && (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#38bdf8",
                        background: "rgba(56,189,248,0.08)",
                        border: "1px solid rgba(56,189,248,0.2)",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontFamily: "Menlo, monospace",
                      }}
                    >
                      {result.method}
                    </span>
                  )}
                  {result.statusCode !== null && (
                    <span
                      style={{
                        fontSize: "12px",
                        fontFamily: "Menlo, monospace",
                        fontWeight: 700,
                        color: result.statusCode < 400 ? "#10b981" : "#f87171",
                      }}
                    >
                      HTTP {result.statusCode}
                    </span>
                  )}
                  {result.duration !== null && (
                    <span style={{ fontSize: "12px", color: "#475569" }}>
                      {fmtDur(result.duration)}
                    </span>
                  )}
                  {hasHeaders && (
                    <button
                      onClick={() =>
                        setHeadersVisible((h) => ({
                          ...h,
                          [resultId]: !h[hKey(resultId)],
                        }))
                      }
                      style={{
                        padding: "1px 8px",
                        borderRadius: "5px",
                        border: `1px solid ${showHdr ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.1)"}`,
                        background: showHdr
                          ? "rgba(251,191,36,0.1)"
                          : "rgba(255,255,255,0.04)",
                        color: showHdr ? "#fbbf24" : "#475569",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      {showHdr ? "收起 Headers" : "查看 Headers"}
                    </button>
                  )}
                  {result.response && (
                    <button
                      onClick={() => copyText(result.response!, resultId)}
                      style={{
                        marginLeft: "auto",
                        padding: "2px 8px",
                        borderRadius: "5px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)",
                        color: copiedId === resultId ? "#4ade80" : "#64748b",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      {copiedId === resultId ? "已复制" : "复制"}
                    </button>
                  )}
                </div>
                {result.loading ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      height: "120px",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.2)",
                        borderTopColor: "#818cf8",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span style={{ color: "#475569", fontSize: "12px" }}>
                      请求中...
                    </span>
                  </div>
                ) : result.error && !result.response ? (
                  <div
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: "8px",
                      padding: "12px",
                      color: "#f87171",
                      fontSize: "12px",
                    }}
                  >
                    {result.error}
                  </div>
                ) : result.response ? (
                  <>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: bodyColor,
                        marginBottom: "4px",
                      }}
                    >
                      {isErrResponse ? "上游错误响应" : "响应体"}
                    </div>
                    <pre
                      style={{
                        background: bodyBg,
                        border: `1px solid ${bodyBorderColor}`,
                        borderRadius: "8px",
                        padding: "12px",
                        color: bodyColor,
                        fontFamily: "Menlo, monospace",
                        fontSize: "14px",
                        maxHeight: "320px",
                        overflowY: "auto",
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        lineHeight: "1.5",
                      }}
                    >
                      {result.response}
                    </pre>
                  </>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "80px",
                      background: "rgba(0,0,0,0.15)",
                      borderRadius: "8px",
                      border: "1px dashed rgba(255,255,255,0.06)",
                      color: "#334155",
                      fontSize: "12px",
                    }}
                  >
                    等待执行
                  </div>
                )}
                {showHdr && hasHeaders && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "10px 12px",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <HeadersBlock
                      headers={result.requestHeaders}
                      title="客户端 → 网关 Headers"
                      color="#38bdf8"
                    />
                    <HeadersBlock
                      headers={result.upstreamRequestHeaders}
                      title="网关 → 服务商 Headers"
                      color="#fb923c"
                    />
                    <HeadersBlock
                      headers={result.responseHeaders}
                      title="服务商 → 网关 响应 Headers"
                      color="#a78bfa"
                    />
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.78)",
                zIndex: 1000,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                padding: "28px 16px",
                overflowY: "auto",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setReplay(null);
              }}
            >
              <div
                style={{
                  background: "hsl(222,47%,11%)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "14px",
                  width: "100%",
                  maxWidth: doCompare ? "1100px" : "760px",
                  boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
                  transition: "max-width 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: "#e2e8f0",
                        fontSize: "14px",
                      }}
                    >
                      请求重放
                    </span>
                    <code
                      style={{
                        fontSize: "14px",
                        color: "#818cf8",
                        background: "rgba(99,102,241,0.12)",
                        border: "1px solid rgba(99,102,241,0.3)",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontFamily: "Menlo, monospace",
                      }}
                    >
                      {replay.entry.model}
                    </code>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#38bdf8",
                        background: "rgba(56,189,248,0.1)",
                        border: "1px solid rgba(56,189,248,0.25)",
                        padding: "1px 7px",
                        borderRadius: "4px",
                        fontFamily: "Menlo, monospace",
                      }}
                    >
                      POST
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#475569",
                        background: "rgba(255,255,255,0.04)",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      {ENDPOINT_LABELS[replay.entry.endpoint] ??
                        replay.entry.endpoint}
                    </span>
                  </div>
                  <button
                    onClick={() => setReplay(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#475569",
                      cursor: "pointer",
                      fontSize: "14px",
                      lineHeight: 1,
                      padding: "4px",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div
                  style={{
                    padding: "10px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    gap: "20px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {[
                    {
                      label: "供应商",
                      value: replay.entry.provider,
                      color:
                        PROVIDER_COLORS[replay.entry.provider] || "#94a3b8",
                    },
                    {
                      label: "原始状态",
                      value: `${replay.entry.statusCode}`,
                      color:
                        replay.entry.status === "success"
                          ? "#10b981"
                          : "#f87171",
                    },
                    {
                      label: "原始耗时",
                      value: fmtDuration(replay.entry.durationMs),
                      color: "#94a3b8",
                    },
                    {
                      label: "时间",
                      value: new Date(replay.entry.timestamp).toLocaleString(
                        "zh-CN",
                      ),
                      color: "#475569",
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ fontSize: "12px" }}>
                      <div
                        style={{
                          color: "#475569",
                          fontSize: "12px",
                          marginBottom: "1px",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          color,
                          fontFamily: "Menlo, monospace",
                          fontSize: "12px",
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#94a3b8",
                      }}
                    >
                      请求体{" "}
                      <span style={{ fontWeight: 400, color: "#475569" }}>
                        (可编辑 · stream 强制为 false)
                      </span>
                    </span>
                    <button
                      onClick={() => copyText(replay.bodyText, "body")}
                      style={{
                        padding: "2px 8px",
                        borderRadius: "5px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)",
                        color: copiedId === "body" ? "#4ade80" : "#475569",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      {copiedId === "body" ? "已复制" : "复制"}
                    </button>
                  </div>
                  <textarea
                    value={replay.bodyText}
                    onChange={(e) =>
                      setReplay((r) =>
                        r ? { ...r, bodyText: e.target.value } : null,
                      )
                    }
                    spellCheck={false}
                    style={{
                      width: "100%",
                      height: "150px",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      color: "#c4b5fd",
                      fontFamily: "Menlo, monospace",
                      fontSize: "14px",
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                      lineHeight: "1.5",
                    }}
                  />
                </div>

                <div
                  style={{
                    padding: "10px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: replay.compareEnabled ? "#fbbf24" : "#64748b",
                      fontWeight: 600,
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={replay.compareEnabled}
                      onChange={(e) =>
                        setReplay((r) =>
                          r ? { ...r, compareEnabled: e.target.checked } : null,
                        )
                      }
                      style={{
                        accentColor: "#fbbf24",
                        width: "14px",
                        height: "14px",
                      }}
                    />
                    启用模型对比
                  </label>
                  {replay.compareEnabled && (
                    <select
                      value={replay.compareModel}
                      onChange={(e) =>
                        setReplay((r) =>
                          r ? { ...r, compareModel: e.target.value } : null,
                        )
                      }
                      style={{
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid rgba(251,191,36,0.3)",
                        borderRadius: "6px",
                        padding: "5px 10px",
                        color: replay.compareModel ? "#e2e8f0" : "#475569",
                        fontSize: "12px",
                        outline: "none",
                        minWidth: "200px",
                      }}
                    >
                      <option value="">— 选择对比模型 —</option>
                      {allModelsWithLive.filter(
                        (m) => m.id !== replay.entry.model,
                      ).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.provider})
                        </option>
                      ))}
                    </select>
                  )}
                  <div
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <button
                      onClick={() => {
                        const key = proxyKey || adminKey;
                        const cmd = generateCurlCommand(replay.bodyText, key);
                        navigator.clipboard.writeText(cmd).then(() => {
                          setCopiedId("curl");
                          setTimeout(() => setCopiedId(null), 1800);
                        });
                      }}
                      style={{
                        padding: "7px 14px",
                        borderRadius: "8px",
                        border: "1px solid rgba(52,211,153,0.35)",
                        background:
                          copiedId === "curl"
                            ? "rgba(52,211,153,0.18)"
                            : "rgba(52,211,153,0.08)",
                        color: copiedId === "curl" ? "#34d399" : "#6ee7b7",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                      title="复制为可直接运行的 curl 命令"
                    >
                      {copiedId === "curl" ? "✓ 已复制" : "$ curl"}
                    </button>
                    <button
                      onClick={() => {
                        setReplay(null);
                        jumpToLogs(replay.entry.id);
                      }}
                      style={{
                        padding: "7px 14px",
                        borderRadius: "8px",
                        border: "1px solid rgba(148,163,184,0.25)",
                        background: "rgba(148,163,184,0.07)",
                        color: "#94a3b8",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                      title="切换到实时日志并按请求 ID 过滤"
                    >
                      ↗ 实时日志
                    </button>
                    <button
                      onClick={executeReplay}
                      disabled={
                        isRunning ||
                        (replay.compareEnabled && !replay.compareModel)
                      }
                      style={{
                        padding: "7px 20px",
                        borderRadius: "8px",
                        border: "none",
                        background:
                          isRunning ||
                          (replay.compareEnabled && !replay.compareModel)
                            ? "rgba(99,102,241,0.2)"
                            : doCompare
                              ? "#b45309"
                              : "#6366f1",
                        color: "#fff",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor:
                          isRunning ||
                          (replay.compareEnabled && !replay.compareModel)
                            ? "not-allowed"
                            : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isRunning ? (
                        <>
                          <span
                            style={{
                              display: "inline-block",
                              width: "12px",
                              height: "12px",
                              border: "2px solid rgba(255,255,255,0.3)",
                              borderTopColor: "#fff",
                              borderRadius: "50%",
                              animation: "spin 0.8s linear infinite",
                            }}
                          />
                          执行中...
                        </>
                      ) : doCompare ? (
                        "⚖ 对比执行"
                      ) : (
                        "▶ 执行重放"
                      )}
                    </button>
                  </div>
                </div>

                {hasAnyResult && (
                  <div
                    style={{
                      padding: "16px 20px 20px",
                      display: "flex",
                      gap: "16px",
                      alignItems: "flex-start",
                    }}
                  >
                    <ResultPanel
                      result={replay.primary}
                      label="主模型"
                      model={replay.entry.model}
                      resultId="primary"
                    />
                    {doCompare && (
                      <ResultPanel
                        result={replay.secondary}
                        label="对比模型"
                        model={replay.compareModel}
                        resultId="secondary"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {rowMenu && (
        <div
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: "fixed",
            top: rowMenu.y,
            left: rowMenu.x,
            zIndex: 9999,
            minWidth: "168px",
            background: "rgba(15,23,42,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            padding: "4px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
          }}
        >
          <button
            type="button"
            className="usage-row-menu-item"
            onClick={() => {
              navigator.clipboard.writeText(rowMenu.entry.id).then(() => {
                setCopiedId(rowMenu.entry.id);
                setTimeout(() => setCopiedId(null), 1800);
              });
              setRowMenu(null);
            }}
          >
            复制请求 ID
            <span className="usage-row-menu-shortcut">#</span>
          </button>
          <button
            type="button"
            className="usage-row-menu-item"
            onClick={() => {
              jumpToLogs(rowMenu.entry.id);
              setRowMenu(null);
            }}
          >
            跳转到实时日志
            <span className="usage-row-menu-shortcut">↗</span>
          </button>
          <button
            type="button"
            className="usage-row-menu-item"
            onClick={() => {
              openReplay(rowMenu.entry);
              setRowMenu(null);
            }}
          >
            重放此请求
            <span className="usage-row-menu-shortcut">▶</span>
          </button>
        </div>
      )}
    </>
  );
}
