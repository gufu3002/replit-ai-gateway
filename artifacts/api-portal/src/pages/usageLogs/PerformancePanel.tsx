import { Card } from "../../components/Card";
import { SectionTitle } from "../../components/SectionTitle";
import { formatCost } from "../../data/pricing";
import { fmtMs, PROVIDER_COLORS } from "./stats";
import { SegmentedControl } from "../../components/SegmentedControl";
import type { PerfGroupBy, PerfRow } from "./types";

interface PerformancePanelProps {
  rows: PerfRow[];
  logsCount: number;
  groupBy: PerfGroupBy;
  setGroupBy: (value: PerfGroupBy) => void;
}

export function PerformancePanel({ rows, logsCount, groupBy, setGroupBy }: PerformancePanelProps) {
  return (
    <Card style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
        <SectionTitle style={{ margin: 0 }}>性能分析</SectionTitle>
        <SegmentedControl
          size="sm"
          active={groupBy}
          onChange={(key) => { if (key) setGroupBy(key as PerfGroupBy); }}
          items={[
            { key: "provider", label: "按供应商" },
            { key: "model", label: "按模型" },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: "#334155", fontSize: "14px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.06)" }}>
          {logsCount === 0 ? "暂无日志数据，请先加载使用日志" : "当前筛选条件下无可分析的数据"}
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {[
                    groupBy === "provider" ? "供应商" : "模型",
                    "请求数", "成功率",
                    "P50 延迟", "P95 延迟", "P99 延迟",
                    "avg TTFT", "P50 TTFT", "P95 TTFT",
                    "avg TPS", "总 Tokens", "估算费用",
                  ].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const successRate = row.count > 0 ? ((row.successCount / row.count) * 100) : 0;
                  const color = PROVIDER_COLORS[row.key] || "#94a3b8";
                  return (
                    <tr key={row.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 10px" }}>
                        {groupBy === "provider" ? (
                          <span style={{ fontSize: "14px", fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}35`, padding: "2px 8px", borderRadius: "8px" }}>{row.key}</span>
                        ) : (
                          <code style={{ fontSize: "14px", fontFamily: "Menlo, monospace", color: "#c4b5fd", background: "rgba(99,102,241,0.08)", padding: "2px 6px", borderRadius: "4px", whiteSpace: "nowrap" }}>{row.key}</code>
                        )}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#94a3b8", fontFamily: "Menlo, monospace" }}>{row.count}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ color: successRate >= 95 ? "#10b981" : successRate >= 80 ? "#fbbf24" : "#f87171", fontFamily: "Menlo, monospace", fontWeight: 600 }}>
                          {successRate.toFixed(0)}%
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#94a3b8", fontFamily: "Menlo, monospace", whiteSpace: "nowrap" }}>{fmtMs(row.p50)}</td>
                      <td style={{ padding: "8px 10px", color: row.p95 > 30000 ? "#f87171" : row.p95 > 10000 ? "#fbbf24" : "#94a3b8", fontFamily: "Menlo, monospace", whiteSpace: "nowrap" }}>{fmtMs(row.p95)}</td>
                      <td style={{ padding: "8px 10px", color: row.p99 > 60000 ? "#f87171" : "#64748b", fontFamily: "Menlo, monospace", whiteSpace: "nowrap" }}>{fmtMs(row.p99)}</td>
                      <td style={{ padding: "8px 10px", color: row.avgTtft !== null ? (row.avgTtft > 5000 ? "#f87171" : "#fbbf24") : "#334155", fontFamily: "Menlo, monospace", whiteSpace: "nowrap" }}>{fmtMs(row.avgTtft)}</td>
                      <td style={{ padding: "8px 10px", color: "#64748b", fontFamily: "Menlo, monospace", whiteSpace: "nowrap" }}>{fmtMs(row.p50Ttft)}</td>
                      <td style={{ padding: "8px 10px", color: "#64748b", fontFamily: "Menlo, monospace", whiteSpace: "nowrap" }}>{fmtMs(row.p95Ttft)}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                        {row.avgTps !== null ? (
                          <span style={{ color: row.avgTps >= 30 ? "#10b981" : row.avgTps >= 10 ? "#fbbf24" : "#94a3b8", fontFamily: "Menlo, monospace" }}>
                            {row.avgTps.toFixed(1)} t/s
                          </span>
                        ) : <span style={{ color: "#334155" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#64748b", fontFamily: "Menlo, monospace", whiteSpace: "nowrap" }}>{row.totalTokens.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "Menlo, monospace", whiteSpace: "nowrap", color: row.totalCost !== null ? "#34d399" : "#334155" }}>
                        {formatCost(row.totalCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "10px", fontSize: "14px", color: "#334155" }}>
            延迟 = 请求总耗时 · TTFT = 首个 token 时间 · TPS = 输出 tokens/秒 · 基于当前 {logsCount} 条记录计算
          </div>
        </>
      )}
    </Card>
  );
}
