import type { ReactNode, CSSProperties } from "react";

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: "12px", padding: "24px", ...style,
    }}>
      {children}
    </div>
  );
}
