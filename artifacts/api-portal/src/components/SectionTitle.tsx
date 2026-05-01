import type { ReactNode, CSSProperties } from "react";

export function SectionTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <h2 style={{
      fontSize: "18px", fontWeight: 700, color: "#64748b", letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: "16px", marginTop: 0,
      ...style,
    }}>
      {children}
    </h2>
  );
}
