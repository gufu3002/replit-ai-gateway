import type { ReactNode } from "react";

export function Badge({ variant, children }: { variant: string; children: ReactNode }) {
  const styles: Record<string, { color: string; bg: string; border: string }> = {
    thinking: { color: "#c084fc", bg: "rgba(192,132,252,0.15)", border: "rgba(192,132,252,0.35)" },
    "thinking-visible": { color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)" },
    tools: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)" },
    reasoning: { color: "#f472b6", bg: "rgba(244,114,182,0.1)", border: "rgba(244,114,182,0.3)" },
  };
  const s = styles[variant] ?? styles.tools;
  const labels: Record<string, string> = {
    thinking: "思考", "thinking-visible": "思考可见", tools: "工具", reasoning: "推理",
  };
  return (
    <span style={{
      fontSize: "12px", fontWeight: 600, color: s.color,
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "4px", padding: "1px 5px", flexShrink: 0,
    }}>
      {labels[variant] ?? children}
    </span>
  );
}
