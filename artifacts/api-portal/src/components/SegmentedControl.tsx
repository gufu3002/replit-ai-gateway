import type { ReactNode } from "react";

export interface SegmentItem {
  key: string;
  label: ReactNode;
  badge?: ReactNode;
  accentColor?: string;
  accentBg?: string;
  accentBorder?: string;
}

interface SegmentedControlProps {
  items: SegmentItem[];
  active: string | null;
  onChange: (key: string | null) => void;
  allowDeselect?: boolean;
  size?: "sm" | "md";
}

const DEFAULT_ACTIVE_COLOR  = "#a5b4fc";
const DEFAULT_ACTIVE_BG     = "rgba(99,102,241,0.18)";
const DEFAULT_ACTIVE_BORDER = "rgba(99,102,241,0.35)";

export function SegmentedControl({ items, active, onChange, allowDeselect = false, size = "md" }: SegmentedControlProps) {
  const padY = size === "sm" ? 4 : 6;
  const padX = size === "sm" ? 10 : 14;
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "8px",
        padding: "3px",
        gap: "2px",
        flexWrap: "wrap",
      }}
    >
      {items.map((item) => {
        const isActive = active === item.key;
        const activeColor  = item.accentColor  ?? DEFAULT_ACTIVE_COLOR;
        const activeBg     = item.accentBg     ?? (item.accentColor ? hexToRgba(item.accentColor, 0.15) : DEFAULT_ACTIVE_BG);
        const activeBorder = item.accentBorder ?? (item.accentColor ? hexToRgba(item.accentColor, 0.35) : DEFAULT_ACTIVE_BORDER);
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(isActive && allowDeselect ? null : item.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: isActive ? activeBg : "transparent",
              border: `1px solid ${isActive ? activeBorder : "transparent"}`,
              borderRadius: "6px",
              padding: `${padY}px ${padX}px`,
              color: isActive ? activeColor : "#64748b",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.12s, color 0.12s, border-color 0.12s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#94a3b8"; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "#64748b"; }}
          >
            {item.label}
            {item.badge != null && (
              <span style={{
                fontSize: "12px",
                fontVariantNumeric: "tabular-nums",
                opacity: isActive ? 1 : 0.65,
                color: isActive ? activeColor : "#475569",
              }}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const v = m.length === 3
    ? m.split("").map((c) => parseInt(c + c, 16))
    : [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
  return `rgba(${v[0]},${v[1]},${v[2]},${alpha})`;
}
