import { useMemo } from "react";
import { Card } from "../../components/Card";
import { SectionTitle } from "../../components/SectionTitle";
import { buildTimeBuckets } from "./stats";
import type { UsageEntry } from "./types";

export function TrendPanel({ logs }: { logs: UsageEntry[] }) {
  const buckets = useMemo(() => buildTimeBuckets(logs, 30), [logs]);

  const svgW = 800;
  const svgH = 96;
  const barW = svgW / buckets.length;

  const {
    maxTokens, totalRequests30, totalSuccess30,
    totalIn30, totalOut30, activeBuckets, ratePoints,
  } = useMemo(() => {
    let maxTok = 1;
    let req30 = 0;
    let suc30 = 0;
    let in30 = 0;
    let out30 = 0;
    const active: typeof buckets = [];
    const pts: { x: number; y: number }[] = [];

    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      const total = b.inputTokens + b.outputTokens;
      if (total > maxTok) maxTok = total;
      req30 += b.total;
      suc30 += b.success;
      in30  += b.inputTokens;
      out30 += b.outputTokens;
      if (b.total > 0) {
        active.push(b);
        pts.push({ x: (i + 0.5) * barW, y: (1 - b.success / b.total) * svgH });
      }
    }
    return {
      maxTokens: maxTok,
      totalRequests30: req30,
      totalSuccess30: suc30,
      totalIn30: in30,
      totalOut30: out30,
      activeBuckets: active,
      ratePoints: pts,
    };
  }, [buckets, barW, svgH]);

  const areaPath = useMemo(() => {
    if (ratePoints.length >= 2) {
      let d = `M ${ratePoints[0].x} ${svgH} L ${ratePoints[0].x} ${ratePoints[0].y}`;
      for (let i = 1; i < ratePoints.length; i++) d += ` L ${ratePoints[i].x} ${ratePoints[i].y}`;
      d += ` L ${ratePoints[ratePoints.length - 1].x} ${svgH} Z`;
      return d;
    }
    if (ratePoints.length === 1) {
      const p = ratePoints[0];
      return `M ${p.x - barW / 2} ${svgH} L ${p.x - barW / 2} ${p.y} L ${p.x + barW / 2} ${p.y} L ${p.x + barW / 2} ${svgH} Z`;
    }
    return "";
  }, [ratePoints, barW, svgH]);

  const now = Date.now();
  const windowStart = now - 30 * 60 * 1000;
  const tickPositions = [0, 10, 20, 30];
  const overallRate30 = totalRequests30 > 0 ? (totalSuccess30 / totalRequests30) * 100 : null;

  const fmtTime = (ms: number) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const rateColor = (r: number) => r >= 0.95 ? "#10b981" : r >= 0.8 ? "#fbbf24" : "#f87171";

  const stats = [
    { label: "请求数", value: String(totalRequests30), color: "#cbd5e1" },
    { label: "成功率", value: overallRate30 !== null ? `${overallRate30.toFixed(1)}%` : "—", color: overallRate30 === null ? "#475569" : overallRate30 >= 95 ? "#10b981" : overallRate30 >= 80 ? "#fbbf24" : "#f87171" },
    { label: "输入 Tokens", value: totalIn30.toLocaleString(), color: "#38bdf8" },
    { label: "输出 Tokens", value: totalOut30.toLocaleString(), color: "#a5b4fc" },
    { label: "活跃分钟", value: `${activeBuckets.length} / 30`, color: "#94a3b8" },
  ];

  return (
    <Card style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "12px" }}>
        <SectionTitle style={{ margin: 0 }}>最近 30 分钟趋势</SectionTitle>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", marginBottom: "16px" }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} style={{
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "8px",
            padding: "10px 12px",
          }}>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>{label}</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color, fontFamily: "Menlo, monospace", fontVariantNumeric: "tabular-nums" }}>{value}</div>
          </div>
        ))}
      </div>

      {totalRequests30 === 0 ? (
        <div style={{ height: "120px", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: "14px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.06)" }}>
          过去 30 分钟内无请求记录（当前已加载日志共 {logs.length} 条）
        </div>
      ) : (
        <>
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#cbd5e1" }}>成功率波动</span>
              <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
                <LegendDot color="#10b981" label="≥95%" />
                <LegendDot color="#fbbf24" label="80–95%" />
                <LegendDot color="#f87171" label="<80%" />
              </div>
            </div>
            <div style={{ position: "relative", background: "rgba(0,0,0,0.25)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden", paddingRight: "36px" }}>
              <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "96px", display: "block" }} preserveAspectRatio="none">
                <line x1="0" y1={svgH * 0.5} x2={svgW} y2={svgH * 0.5} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4,4" />
                <line x1="0" y1={svgH * 0.05} x2={svgW} y2={svgH * 0.05} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4,4" />
                {areaPath && (
                  <>
                    <defs>
                      <linearGradient id="rateAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#rateAreaGrad)" />
                  </>
                )}
                {buckets.map((b, i) => {
                  if (b.total === 0) return null;
                  const color = rateColor(b.success / b.total);
                  return <rect key={i} x={i * barW} y={0} width={barW} height={svgH} fill={color} opacity={0.05} />;
                })}
                {ratePoints.length >= 2 && (
                  <polyline points={ratePoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
                )}
                {ratePoints.map((p, i) => {
                  const b = buckets.find((_, bi) => Math.abs((bi + 0.5) * barW - p.x) < 1);
                  const rate = b && b.total > 0 ? b.success / b.total : 1;
                  return <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={rateColor(rate)} />;
                })}
              </svg>
              <div style={{ position: "absolute", top: "4px", right: "8px", fontSize: "12px", color: "#475569", fontFamily: "Menlo, monospace" }}>100%</div>
              <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", right: "8px", fontSize: "12px", color: "#475569", fontFamily: "Menlo, monospace" }}>50%</div>
              <div style={{ position: "absolute", bottom: "4px", right: "8px", fontSize: "12px", color: "#475569", fontFamily: "Menlo, monospace" }}>0%</div>
            </div>
          </div>

          <div style={{ marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#cbd5e1" }}>Token 波动</span>
              <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
                <LegendDot color="#38bdf8" label="输入" />
                <LegendDot color="#a5b4fc" label="输出" />
              </div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", overflow: "hidden", paddingRight: "36px", position: "relative" }}>
              <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "96px", display: "block" }} preserveAspectRatio="none">
                <line x1="0" y1={svgH * 0.5} x2={svgW} y2={svgH * 0.5} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4,4" />
                {buckets.map((b, i) => {
                  const total = b.inputTokens + b.outputTokens;
                  if (total === 0) return null;
                  const totalH = (total / maxTokens) * svgH;
                  const inH = (b.inputTokens / maxTokens) * svgH;
                  const outH = (b.outputTokens / maxTokens) * svgH;
                  const x = i * barW + 1;
                  const w = Math.max(barW - 2, 1);
                  return (
                    <g key={i}>
                      <rect x={x} y={svgH - inH} width={w} height={inH} fill="#38bdf8" opacity="0.65" rx="0.5" />
                      <rect x={x} y={svgH - totalH} width={w} height={outH} fill="#a5b4fc" opacity="0.7" rx="0.5" />
                    </g>
                  );
                })}
              </svg>
              <div style={{ position: "absolute", top: "4px", right: "8px", fontSize: "12px", color: "#475569", fontFamily: "Menlo, monospace" }}>{maxTokens.toLocaleString()}</div>
              <div style={{ position: "absolute", bottom: "4px", right: "8px", fontSize: "12px", color: "#475569", fontFamily: "Menlo, monospace" }}>0</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "6px", paddingRight: "44px" }}>
            {tickPositions.map((min) => (
              <span key={min} style={{ fontSize: "12px", color: "#475569", fontFamily: "Menlo, monospace", fontVariantNumeric: "tabular-nums" }}>{fmtTime(windowStart + min * 60 * 1000)}</span>
            ))}
          </div>
        </>
      )}
      <div style={{ marginTop: "10px", fontSize: "12px", color: "#475569" }}>
        每格 = 1 分钟 · 共 {activeBuckets.length} 个活跃分钟 · 基于已加载的 {logs.length} 条日志（含过去 30 分钟内的条目）
      </div>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#94a3b8" }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}
