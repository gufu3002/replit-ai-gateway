import { useEffect, useRef, useState } from "react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  width?: string | number;
  minWidth?: string | number;
  style?: React.CSSProperties;
  maxMenuHeight?: number;
}

export function Dropdown({
  value,
  options,
  onChange,
  placeholder,
  width,
  minWidth,
  style,
  maxMenuHeight = 260,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder ?? "";

  return (
    <div ref={rootRef} style={{ position: "relative", width, minWidth }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
          width: "100%",
          background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "7px", padding: "6px 10px",
          color: selected ? "#e2e8f0" : "#64748b",
          fontSize: "14px", outline: "none", cursor: "pointer",
          textAlign: "left",
          ...style,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display}</span>
        <span style={{ fontSize: "12px", color: "#64748b", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "7px", padding: "4px",
            maxHeight: `${maxMenuHeight}px`, overflowY: "auto",
            zIndex: 1000,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="dropdown-item"
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: active ? "rgba(99,102,241,0.18)" : "transparent",
                  border: "none", borderRadius: "5px",
                  padding: "6px 10px",
                  color: active ? "#a5b4fc" : "#e2e8f0",
                  fontSize: "14px", cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
