interface AppHeaderProps {
  localServerVersion: string;
  localServerBuildTime: string;
  online: boolean | null;
  densityMode: "comfortable" | "compact";
  toggleDensityMode: () => void;
}

export function AppHeader({
  localServerVersion, localServerBuildTime, online,
  densityMode, toggleDensityMode,
}: AppHeaderProps) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "10px" }}>
        <svg width="44" height="44" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="hdrBg" x1="24" y1="16" x2="156" y2="164" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0f172a"/>
              <stop offset="48%" stopColor="#312e81"/>
              <stop offset="100%" stopColor="#6366f1"/>
            </linearGradient>
            <linearGradient id="hdrMark" x1="48" y1="42" x2="132" y2="138" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#e0e7ff"/>
              <stop offset="55%" stopColor="#a5b4fc"/>
              <stop offset="100%" stopColor="#67e8f9"/>
            </linearGradient>
            <filter id="hdrSoftGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <rect x="10" y="10" width="160" height="160" rx="42" fill="url(#hdrBg)"/>
          <rect x="11" y="11" width="158" height="158" rx="41" stroke="rgba(255,255,255,0.16)" strokeWidth="2"/>
          <path d="M47 98L30 90L47 82" stroke="#a5b4fc" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M133 82L150 90L133 98" stroke="#67e8f9" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M90 42L127 132H111L104 113H76L69 132H53L90 42ZM81 99H99L90 73L81 99Z" fill="#f8fafc"/>
          <path d="M99 99L90 73L127 132H111L104 113H96L99 99Z" fill="url(#hdrMark)" opacity="0.9"/>
          <circle cx="90" cy="90" r="48" stroke="rgba(255,255,255,0.12)" strokeWidth="2"/>
          <circle cx="90" cy="90" r="64" stroke="rgba(103,232,249,0.1)" strokeWidth="2" strokeDasharray="8 10"/>
        </svg>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.3px" }}>AI Gateway</h1>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#818cf8", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "5px", padding: "2px 8px" }}>v{localServerVersion}</span>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>构建于 {localServerBuildTime}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={toggleDensityMode}
            title={densityMode === "compact" ? "切换到舒适密度" : "切换到紧凑密度"}
            style={{
              display: "flex", alignItems: "center",
              background: densityMode === "compact" ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${densityMode === "compact" ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: "100px", padding: "5px 12px",
              cursor: "pointer", transition: "all 0.2s", fontSize: "12px", fontWeight: 600,
              color: densityMode === "compact" ? "#a5b4fc" : "#94a3b8",
            }}
          >
            {densityMode === "compact" ? "紧凑" : "舒适"}
          </button>
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: online === null ? "rgba(100,116,139,0.15)" : online ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
            border: `1px solid ${online === null ? "rgba(100,116,139,0.3)" : online ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
            borderRadius: "100px", padding: "4px 10px 4px 8px",
          }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: online === null ? "#64748b" : online ? "#4ade80" : "#f87171", boxShadow: online ? "0 0 5px #4ade80" : undefined }} />
            <span style={{ fontSize: "12px", color: online === null ? "#64748b" : online ? "#4ade80" : "#f87171", fontWeight: 500 }}>
              {online === null ? "检测中…" : online ? "在线" : "离线"}
            </span>
          </div>
        </div>
      </div>

      <p style={{ color: "#475569", margin: "0", fontSize: "14px", lineHeight: "1.6" }}>
        统一 AI API 网关 · 15 个通道：OpenAI / Anthropic / Google / DeepSeek / xAI / Mistral / Moonshot / Groq / Together / SiliconFlow / Cerebras / Fireworks / Novita / Hyperbolic / OpenRouter · OpenAI 兼容格式
      </p>
    </div>
  );
}
