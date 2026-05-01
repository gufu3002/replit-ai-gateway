import type { Provider, ModelEntry } from "../data/models";
import { PROVIDER_COLORS } from "../data/models";
import { Badge } from "./Badge";
import { CopyButton } from "./CopyButton";

const CATEGORY_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  "replit":   { label: "Replit官方", color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)" },
  "official": { label: "官方直连",   color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)" },
  "chip":     { label: "推理芯片",   color: "#fb923c", bg: "rgba(251,146,60,0.1)",  border: "rgba(251,146,60,0.25)" },
  "oss":      { label: "开源模型",   color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)" },
};

export function ModelGroup({ title, subtitle, models, provider, category, expanded, onToggle }: {
  title: string;
  subtitle?: string;
  models: ModelEntry[];
  provider: Provider;
  category?: keyof typeof CATEGORY_STYLE;
  expanded: boolean;
  onToggle: () => void;
}) {
  const c = PROVIDER_COLORS[provider];
  const baseModels = models.filter((m) => m.isBase === true);
  const variantModels = models.filter((m) => !m.isBase);
  const cat = category ? CATEGORY_STYLE[category] : null;

  return (
    <div style={{ marginBottom: "8px" }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: "12px", width: "100%",
          background: expanded ? c.bg : "rgba(255,255,255,0.02)",
          border: `1px solid ${expanded ? c.border : "rgba(255,255,255,0.07)"}`,
          borderRadius: expanded ? "8px 8px 0 0" : "8px",
          padding: "10px 14px", cursor: "pointer", textAlign: "left",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <div style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: c.dot, flexShrink: 0,
          boxShadow: `0 0 6px ${c.dot}80`,
        }} />
        <span style={{ fontWeight: 600, color: c.text, fontSize: "14px", flex: 1, letterSpacing: "0.1px" }}>
          {title}
          {subtitle && (
            <span style={{ fontWeight: 400, color: "#475569", fontSize: "14px", marginLeft: "8px" }}>
              {subtitle}
            </span>
          )}
        </span>
        {cat && (
          <span style={{
            fontSize: "12px", fontWeight: 600, color: cat.color,
            background: cat.bg, border: `1px solid ${cat.border}`,
            padding: "2px 7px", borderRadius: "20px", flexShrink: 0, letterSpacing: "0.3px",
          }}>
            {cat.label}
          </span>
        )}
        <span style={{ fontSize: "12px", color: "#475569" }}>
          {baseModels.length} 个模型
          {variantModels.length > 0 && (
            <span style={{ color: "#334155" }}> · {variantModels.length} 个变体</span>
          )}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{
            color: "#475569", flexShrink: 0, marginLeft: "2px",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div style={{
          border: `1px solid ${c.border}`,
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          overflow: "hidden",
        }}>
          {models.map((m, i) => (
            <div
              key={m.id}
              className="model-row"
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                background: m.isBase ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.15)",
                borderTop: i > 0 ? `1px solid ${m.isBase ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)"}` : "none",
                padding: "7px 14px",
              }}
            >
              <code style={{
                fontFamily: "Menlo, monospace",
                fontSize: "14px", color: "#ddd6fe",
                flex: 1, wordBreak: "break-all", lineHeight: "1.4",
              }}>
                {m.id}
              </code>
              {m.desc && (
                <span style={{
                  fontSize: "12px", color: "#64748b", flexShrink: 0,
                  textAlign: "right", maxWidth: "180px", lineHeight: "1.3",
                }}>
                  {m.desc}
                </span>
              )}
              {m.context && (
                <span style={{
                  fontSize: "12px", color: "#334155",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "4px", padding: "1px 6px",
                  flexShrink: 0, fontVariantNumeric: "tabular-nums",
                  letterSpacing: "0.3px",
                }}>
                  {m.context}
                </span>
              )}
              {m.badge && <Badge variant={m.badge}>{m.badge}</Badge>}
              <CopyButton text={m.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
