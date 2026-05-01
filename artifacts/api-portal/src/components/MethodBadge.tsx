export function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span style={{
      background: method === "GET" ? "rgba(34,197,94,0.15)" : "rgba(99,102,241,0.2)",
      color: method === "GET" ? "#4ade80" : "#818cf8",
      border: `1px solid ${method === "GET" ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.3)"}`,
      borderRadius: "5px", padding: "2px 8px", fontSize: "12px", fontWeight: 700,
      fontFamily: "Menlo, monospace", flexShrink: 0,
    }}>{method}</span>
  );
}
