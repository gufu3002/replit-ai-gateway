import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { SegmentedControl } from "../components/SegmentedControl";
import { highlight } from "../utils/highlight";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: Record<string, unknown>;
}

interface LogsPageProps {
  adminKey: string;
  setAdminKey: (key: string) => void;
  baseUrl: string;
  externalSearch?: string;
  jumpToUsage?: (isoTimestamp: string) => void;
}

const LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  info:  { color: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.3)",  dot: "#4ade80" },
  warn:  { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  dot: "#fbbf24" },
  error: { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", dot: "#f87171" },
  debug: { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)", dot: "#94a3b8" },
};

const POLL_INTERVAL = 15 * 60 * 1000;

const AI_PATH_RE = /(?:^|\s)(\/v1\/|\/chat\/completions|\/messages|\/responses|\/models\/[^:]+:(?:generate|stream))/;
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);

function isApiRequestLog(entry: LogEntry): boolean {
  if (entry.meta) {
    const path = entry.meta.path;
    const method = entry.meta.method;
    if (typeof path === "string" && typeof method === "string") {
      return (
        path.startsWith("/v1/") ||
        path === "/chat/completions" ||
        path === "/messages" ||
        path === "/responses" ||
        /^\/models\/[^:]+:(?:generateContent|streamGenerateContent)/.test(path)
      );
    }
  }
  const msg = entry.message;
  if (!msg) return false;
  const parts = msg.split(" ");
  if (parts.length >= 2 && HTTP_METHODS.has(parts[0])) {
    return AI_PATH_RE.test(parts[1] ?? "");
  }
  return false;
}

function fmtTime(timestamp: string): string {
  if (timestamp.length >= 19) return timestamp.substring(11, 19);
  return timestamp;
}

export default function LogsPage({ adminKey, setAdminKey, baseUrl, externalSearch, jumpToUsage }: LogsPageProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logConnected, setLogConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const [logFilter, setLogFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const logContainerRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextIndexRef = useRef<number>(0);
  const activeRef = useRef(false);
  const adminKeyRef = useRef(adminKey);
  const baseUrlRef = useRef(baseUrl);

  adminKeyRef.current = adminKey;
  baseUrlRef.current = baseUrl;

  const stopPolling = useCallback(() => {
    activeRef.current = false;
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setLogConnected(false);
    setIsConnecting(false);
    isRefreshingRef.current = false;
    setIsRefreshing(false);
  }, []);

  const fetchLogs = useCallback(async (sinceIndex?: number) => {
    const key = adminKeyRef.current;
    const url = baseUrlRef.current;
    if (!key || !activeRef.current) return;
    try {
      const params = sinceIndex !== undefined ? `sinceIndex=${sinceIndex}` : `limit=100`;
      const res = await fetch(`${url}/api/logs?${params}`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json() as { logs: LogEntry[]; total: number };
      nextIndexRef.current = json.total;
      if (json.logs.length > 0) {
        setLogs((prev) => {
          const next = [...prev, ...json.logs];
          if (next.length > 500) return next.slice(-500);
          return next;
        });
      }
      setLogConnected(true);
    } catch {
      // ignore; interval will retry
    }
  }, []);

  const startPolling = useCallback(() => {
    if (activeRef.current) return;
    if (!adminKeyRef.current) return;
    activeRef.current = true;
    nextIndexRef.current = 0;
    setLogs([]);
    setIsConnecting(true);

    fetchLogs(undefined).then(() => {
      if (!activeRef.current) return;
      setIsConnecting(false);
      setLogConnected(true);
      pollTimerRef.current = setInterval(() => {
        fetchLogs(nextIndexRef.current);
      }, POLL_INTERVAL);
    });
  }, [fetchLogs]);

  const reloadLogs = useCallback(async () => {
    if (isRefreshingRef.current || !activeRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setLogs([]);
    setExpandedRows(new Set());
    nextIndexRef.current = 0;
    await fetchLogs(undefined);
    isRefreshingRef.current = false;
    setIsRefreshing(false);
  }, [fetchLogs]);

  useEffect(() => { return () => { stopPolling(); }; }, [stopPolling]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    if (externalSearch !== undefined && externalSearch !== "") {
      setSearchText(externalSearch);
      setLogFilter("all");
      if (logContainerRef.current) logContainerRef.current.scrollTop = 0;
    }
  }, [externalSearch]);

  const toggleExpand = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const filteredLogs = useMemo(() => {
    const lowerSearch = searchText.toLowerCase();
    return logs.filter((l) => {
      if (logFilter !== "all" && l.level !== logFilter) return false;
      if (lowerSearch && !l.message.toLowerCase().includes(lowerSearch)) return false;
      return true;
    });
  }, [logs, logFilter, searchText]);

  const levelCounts = useMemo(() =>
    logs.reduce<Record<string, number>>((acc, l) => {
      acc[l.level] = (acc[l.level] || 0) + 1;
      return acc;
    }, {}),
  [logs]);

  const downloadLogs = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proxy-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const btn: React.CSSProperties = {
    padding: "6px 14px", borderRadius: "8px", fontSize: "12px",
    fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: "none",
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px", padding: "7px 12px",
    color: "#e2e8f0", fontSize: "14px", outline: "none",
  };

  return (
    <>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes log-fadein { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:translateY(0)} }
        .log-row { transition: background 0.1s; }
        .log-row:hover { background: rgba(255,255,255,0.028) !important; }
        .log-row.expandable { cursor: pointer; }
        .log-jump-btn { opacity: 0; transition: opacity 0.12s; }
        .log-row:hover .log-jump-btn { opacity: 1; }
        .log-jump-btn:hover { background: rgba(99,102,241,0.22) !important; border-color: rgba(99,102,241,0.5) !important; }
      `}</style>

      <Card style={{ marginBottom: "12px" }}>
        {/* ── Title row ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
          <div>
            <SectionTitle style={{ margin: "0 0 3px" }}>实时日志</SectionTitle>
            <p style={{ margin: 0, color: "#64748b", fontSize: "12px" }}>
              轮询模式 · 每 15 分钟自动刷新 · 最近 500 条
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {logConnected && logs.length > 0 && (
              <span style={{
                fontSize: "12px", color: "#64748b",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "20px", padding: "2px 10px", fontVariantNumeric: "tabular-nums",
              }}>
                {filteredLogs.length === logs.length ? `${logs.length} 条` : `${filteredLogs.length} / ${logs.length}`}
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{
                width: "7px", height: "7px", borderRadius: "50%", display: "inline-block", flexShrink: 0,
                background: logConnected ? "#4ade80" : isConnecting ? "#fbbf24" : "#475569",
                boxShadow: logConnected ? "0 0 7px #4ade8080" : isConnecting ? "0 0 7px #fbbf2480" : undefined,
                animation: (logConnected || isConnecting) ? "pulse-dot 2s ease-in-out infinite" : undefined,
              }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: logConnected ? "#4ade80" : isConnecting ? "#fbbf24" : "#475569" }}>
                {logConnected ? "已连接" : isConnecting ? "连接中" : "未连接"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Controls row ── */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin Key"
            autoComplete="current-password"
            spellCheck={false}
            style={{ ...inputStyle, width: "190px", flexShrink: 0 }}
          />
          <div style={{ position: "relative", flex: 1, minWidth: "160px" }}>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="关键字搜索…"
              style={{ ...inputStyle, width: "100%", padding: "7px 32px 7px 12px", fontSize: "14px", boxSizing: "border-box" }}
            />
            {searchText ? (
              <button onClick={() => setSearchText("")} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: "0 2px" }}>×</button>
            ) : (
              <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#475569", fontSize: "14px", pointerEvents: "none" }}>⌕</span>
            )}
          </div>

          <div style={{ display: "flex", gap: "6px", marginLeft: "auto", flexWrap: "wrap" }}>
            {!logConnected ? (
              <button
                onClick={startPolling}
                disabled={!adminKey || isConnecting}
                style={{ ...btn, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: (!adminKey || isConnecting) ? "#6366f1" : "#a5b4fc", opacity: (!adminKey || isConnecting) ? 0.55 : 1, cursor: (!adminKey || isConnecting) ? "not-allowed" : "pointer" }}
              >
                {isConnecting ? "连接中…" : "连接"}
              </button>
            ) : (
              <>
                <button
                  onClick={reloadLogs}
                  disabled={isRefreshing}
                  style={{ ...btn, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: isRefreshing ? "#6366f1" : "#a5b4fc", opacity: isRefreshing ? 0.7 : 1, cursor: isRefreshing ? "not-allowed" : "pointer" }}
                >
                  {isRefreshing ? "加载中…" : "↻ 刷新"}
                </button>
                <button onClick={stopPolling} style={{ ...btn, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                  ✕ 断开
                </button>
              </>
            )}
            <button
              onClick={downloadLogs}
              disabled={filteredLogs.length === 0}
              style={{ ...btn, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", color: "#34d399", opacity: filteredLogs.length === 0 ? 0.35 : 1, cursor: filteredLogs.length === 0 ? "not-allowed" : "pointer" }}
            >
              ↓ 导出
            </button>
            <button
              onClick={() => {
                setLogs([]);
                setExpandedRows(new Set());
                if (adminKey) {
                  fetch(`${baseUrl}/api/logs/clear`, { method: "POST", headers: { Authorization: `Bearer ${adminKey}` } })
                    .then((r) => r.json())
                    .then((json: { total?: number }) => {
                      if (typeof json.total === "number") nextIndexRef.current = json.total;
                    })
                    .catch(() => {});
                }
              }}
              style={{ ...btn, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#475569" }}
            >
              清空
            </button>
          </div>
        </div>

        {/* ── Level filters + autoscroll ── */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <SegmentedControl
            size="sm"
            active={logFilter}
            onChange={(key) => { if (key) setLogFilter(key); }}
            items={[
              { key: "all",   label: "全部",  badge: logs.length || undefined },
              { key: "info",  label: "INFO",  accentColor: "#4ade80", badge: levelCounts.info  || undefined },
              { key: "warn",  label: "WARN",  accentColor: "#fbbf24", badge: levelCounts.warn  || undefined },
              { key: "error", label: "ERROR", accentColor: "#f87171", badge: levelCounts.error || undefined },
              { key: "debug", label: "DEBUG", accentColor: "#94a3b8", badge: levelCounts.debug || undefined },
            ]}
          />
          <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#64748b", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} style={{ accentColor: "#6366f1" }} />
            自动滚动
          </label>
        </div>
      </Card>

      {/* ── Log list ── */}
      <div style={{
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "10px",
        overflow: "hidden",
      }}>
        <div
          ref={logContainerRef}
          style={{ height: "540px", overflowY: "auto" }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px" }}>
              {!isConnecting && !logConnected && (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="18" r="15" stroke="#334155" strokeWidth="1.5" />
                </svg>
              )}
              <div style={{ color: "#334155", fontSize: "14px", textAlign: "center" }}>
                {isConnecting
                  ? "正在连接，加载日志…"
                  : logConnected
                  ? searchText || logFilter !== "all"
                    ? "无匹配的日志条目"
                    : "已连接，等待日志…"
                  : "点击「连接」开始接收实时日志"}
              </div>
            </div>
          ) : (
            filteredLogs.map((entry, i) => {
              const cfg = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.debug;
              const hasMeta = !!(entry.meta && Object.keys(entry.meta).length > 0);
              const isExpanded = expandedRows.has(i);
              const isApiReq = isApiRequestLog(entry);

              return (
                <div
                  key={i}
                  className={`log-row${hasMeta ? " expandable" : ""}`}
                  onClick={() => hasMeta && toggleExpand(i)}
                  onKeyDown={(e) => { if (hasMeta && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleExpand(i); } }}
                  role={hasMeta ? "button" : undefined}
                  tabIndex={hasMeta ? 0 : undefined}
                  aria-expanded={hasMeta ? isExpanded : undefined}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: isExpanded ? "rgba(255,255,255,0.018)" : undefined,
                  }}
                >
                  {/* Main row */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 14px" }}>
                    {/* Timestamp */}
                    <span style={{
                      fontFamily: "Menlo, monospace", fontSize: "12px",
                      color: "#334155", flexShrink: 0, width: "68px",
                      fontVariantNumeric: "tabular-nums", letterSpacing: "0.2px",
                    }}>
                      {fmtTime(entry.timestamp)}
                    </span>

                    {/* Level badge — soft pill (sans-serif, 6px radius per design spec) */}
                    <span style={{
                      fontSize: "12px", fontWeight: 700,
                      color: cfg.color,
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      padding: "2px 8px", borderRadius: "6px",
                      flexShrink: 0,
                      letterSpacing: "0.6px",
                      width: "56px", textAlign: "center",
                      boxSizing: "border-box",
                    }}>
                      {entry.level.toUpperCase()}
                    </span>

                    {/* Message */}
                    <span style={{
                      fontFamily: "Menlo, monospace", fontSize: "14px",
                      color: "#ddd6fe", flex: 1, wordBreak: "break-all", lineHeight: "1.5",
                    }}>
                      {highlight(entry.message, searchText)}
                    </span>

                    {/* Jump to usage button */}
                    {jumpToUsage && isApiReq && (
                      <button
                        className="log-jump-btn"
                        onClick={(e) => { e.stopPropagation(); jumpToUsage(entry.timestamp); }}
                        title="跳转到使用日志"
                        style={{
                          flexShrink: 0,
                          background: "rgba(99,102,241,0.08)",
                          border: "1px solid rgba(99,102,241,0.2)",
                          borderRadius: "5px", padding: "1px 7px",
                          color: "#818cf8", fontSize: "12px", cursor: "pointer",
                        }}
                      >
                        ↗
                      </button>
                    )}

                    {/* Expand chevron */}
                    {hasMeta && (
                      <svg
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{
                          flexShrink: 0, color: "#334155",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      >
                        <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  {/* Expanded meta — styled like ModelGroup expand section */}
                  {isExpanded && hasMeta && (
                    <div style={{
                      borderTop: `1px solid ${cfg.border}`,
                      background: "rgba(0,0,0,0.25)",
                      padding: "10px 14px 10px 92px",
                    }}>
                      <pre style={{
                        margin: 0,
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "7px", padding: "10px 14px",
                        color: "#94a3b8", fontSize: "12px",
                        fontFamily: "Menlo, monospace",
                        overflowX: "auto", whiteSpace: "pre-wrap",
                        wordBreak: "break-all", lineHeight: "1.6",
                      }}>
                        {JSON.stringify(entry.meta, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
