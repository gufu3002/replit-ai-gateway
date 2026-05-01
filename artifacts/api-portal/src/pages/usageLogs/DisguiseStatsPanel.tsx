import { Card } from "../../components/Card";
import { SectionTitle } from "../../components/SectionTitle";
import type { DisguiseStat } from "./types";

interface DisguiseStatsPanelProps {
  stats: DisguiseStat[];
  logsCount: number;
}

export function DisguiseStatsPanel({ stats, logsCount }: DisguiseStatsPanelProps) {
  return (
    <Card style={{ marginBottom: "16px" }}>
      <SectionTitle style={{ marginBottom: "12px" }}>伪装 Profile 命中率统计</SectionTitle>

      {stats.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: "#334155", fontSize: "14px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.06)" }}>
          {logsCount === 0 ? "暂无日志数据，请先加载使用日志" : "当前日志中未发现伪装 Profile 使用记录"}
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["伪装 Profile", "总请求", "成功", "失败", "成功率"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => {
                  const rate = s.total > 0 ? ((s.success / s.total) * 100).toFixed(1) : "0.0";
                  const rateNum = parseFloat(rate);
                  return (
                    <tr key={s.preset} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ fontSize: "14px", fontFamily: "Menlo, monospace", color: "#818cf8", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", padding: "2px 7px", borderRadius: "4px" }}>{s.preset}</span>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#94a3b8", fontFamily: "Menlo, monospace", fontSize: "14px" }}>{s.total}</td>
                      <td style={{ padding: "8px 10px", color: "#10b981", fontFamily: "Menlo, monospace", fontSize: "14px" }}>{s.success}</td>
                      <td style={{ padding: "8px 10px", color: s.error > 0 ? "#f87171" : "#334155", fontFamily: "Menlo, monospace", fontSize: "14px" }}>{s.error}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "80px", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${rateNum}%`, height: "100%", background: rateNum >= 90 ? "#10b981" : rateNum >= 70 ? "#fbbf24" : "#f87171", borderRadius: "3px", transition: "width 0.3s" }} />
                          </div>
                          <span style={{ color: rateNum >= 90 ? "#10b981" : rateNum >= 70 ? "#fbbf24" : "#f87171", fontFamily: "Menlo, monospace", fontSize: "14px", fontWeight: 600 }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "10px", fontSize: "14px", color: "#334155" }}>
            基于当前过滤条件下的 {logsCount} 条记录统计
          </div>
        </>
      )}
    </Card>
  );
}
