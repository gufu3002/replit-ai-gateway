export function ToggleSwitch({ enabled, onToggle, disabled, size = "normal" }: { enabled: boolean; onToggle: () => void; disabled?: boolean; size?: "normal" | "small" }) {
  const w = size === "small" ? 44 : 52;
  const h = size === "small" ? 24 : 28;
  const dot = size === "small" ? 18 : 22;
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        width: `${w}px`, height: `${h}px`, borderRadius: `${h / 2}px`, border: "none",
        background: enabled ? "#10b981" : "rgba(255,255,255,0.12)",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        width: `${dot}px`, height: `${dot}px`, borderRadius: "50%", background: "#fff",
        position: "absolute", top: "3px", left: enabled ? `${w - dot - 3}px` : "3px",
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}
