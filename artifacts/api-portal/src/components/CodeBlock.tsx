import { CopyButton } from "./CopyButton";

export function CodeBlock({ code, copyText }: { code: string; copyText?: string }) {
  return (
    <div style={{ position: "relative", marginTop: "8px" }}>
      <pre style={{
        background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px", padding: "12px 16px", fontFamily: "Menlo, monospace",
        fontSize: "14px", color: "#e2e8f0", overflowX: "auto", margin: 0, paddingRight: "72px",
        lineHeight: "1.6",
      }}>{code}</pre>
      <div style={{ position: "absolute", top: "8px", right: "8px" }}>
        <CopyButton text={copyText ?? code} />
      </div>
    </div>
  );
}
