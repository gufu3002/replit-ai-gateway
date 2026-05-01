import type { TabId } from "../data/models";
import { TABS } from "../data/models";

interface TabNavProps {
  activeTab: TabId;
  setActiveTab: (id: TabId) => void;
}

export function TabNav({ activeTab, setActiveTab }: TabNavProps) {
  return (
    <div style={{
      display: "flex", gap: "0", marginBottom: "24px",
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "10px", padding: "4px", overflow: "hidden",
    }}>
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: "10px 8px", border: "none",
              borderRadius: "8px", fontSize: "14px", fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
              background: active ? "rgba(99,102,241,0.2)" : "transparent",
              color: active ? "#818cf8" : "#64748b",
              boxShadow: active ? "0 1px 4px rgba(99,102,241,0.15)" : "none",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
