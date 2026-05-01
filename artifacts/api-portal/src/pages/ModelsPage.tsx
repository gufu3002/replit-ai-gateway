import { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Badge } from "../components/Badge";
import { ModelGroup } from "../components/ModelGroup";
import { CopyButton } from "../components/CopyButton";
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS, DEEPSEEK_MODELS, XAI_MODELS, MISTRAL_MODELS, MOONSHOT_MODELS, GROQ_MODELS, TOGETHER_MODELS, SILICONFLOW_MODELS, CEREBRAS_MODELS, FIREWORKS_MODELS, NOVITA_MODELS, HYPERBOLIC_MODELS, ALL_MODELS, PROVIDER_HEX_COLORS, PROVIDER_LABELS, type ModelEntry, type Provider } from "../data/models";
import { highlight } from "../utils/highlight";
import { useLiveOpenRouterModels } from "../hooks/useLiveOpenRouterModels";

interface ModelsPageProps {
  expandedGroups: Record<string, boolean>;
  toggleGroup: (group: string) => void;
  baseUrl: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  "x-ai": "xAI (Grok)",
  "meta-llama": "Meta (Llama)",
  "deepseek": "DeepSeek",
  "mistralai": "Mistral AI",
  "qwen": "Qwen (Alibaba)",
  "google": "Google (via OR)",
  "anthropic": "Anthropic (via OR)",
  "z-ai": "智谱 AI (GLM)",
  "minimax": "MiniMax",
  "moonshotai": "MoonshotAI (Kimi)",
  "nvidia": "NVIDIA",
  "perplexity": "Perplexity",
  "bytedance-seed": "ByteDance Seed",
  "tencent": "腾讯 (Hunyuan)",
  "microsoft": "Microsoft",
  "stepfun": "阶跃星辰 (StepFun)",
  "inception": "Inception AI",
  "xiaomi": "小米 (MiMo)",
  "writer": "Writer",
  "upstage": "Upstage",
  "ai21": "AI21 Labs",
  "cohere": "Cohere",
  "amazon": "Amazon (Nova)",
  "baidu": "百度 (ERNIE)",
};

const CHANNEL_ORDER = [
  "x-ai", "meta-llama", "deepseek", "mistralai", "qwen",
  "google", "anthropic", "z-ai", "minimax", "moonshotai",
  "nvidia", "perplexity", "bytedance-seed", "tencent", "microsoft",
  "stepfun", "inception", "xiaomi", "writer", "upstage",
  "ai21", "cohere", "amazon", "baidu",
];

const STATIC_GROUPS: Record<Exclude<Provider, "openrouter">, ModelEntry[]> = {
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  gemini: GEMINI_MODELS,
  deepseek: DEEPSEEK_MODELS,
  xai: XAI_MODELS,
  mistral: MISTRAL_MODELS,
  moonshot: MOONSHOT_MODELS,
  groq: GROQ_MODELS,
  together: TOGETHER_MODELS,
  siliconflow: SILICONFLOW_MODELS,
  cerebras: CEREBRAS_MODELS,
  fireworks: FIREWORKS_MODELS,
  novita: NOVITA_MODELS,
  hyperbolic: HYPERBOLIC_MODELS,
  // openrouter: 由后端实时同步驱动，渲染时通过 useLiveOpenRouterModels 注入
};

function buildOpenRouterChannelGroups(models: ModelEntry[]): Record<string, ModelEntry[]> {
  const map: Record<string, ModelEntry[]> = {};
  for (const m of models) {
    const prefix = m.id.split("/")[0];
    if (!map[prefix]) map[prefix] = [];
    map[prefix].push(m);
  }
  return map;
}

export default function ModelsPage({ expandedGroups, toggleGroup, baseUrl }: ModelsPageProps) {
  const [expandedChannels, setExpandedChannels] = useState<Record<string, boolean>>({});
  const toggleChannel = (ch: string) =>
    setExpandedChannels((prev) => ({ ...prev, [ch]: !prev[ch] }));

  const [searchQuery, setSearchQuery] = useState("");

  const orExpanded = expandedGroups.openrouter;

  const { models: liveOpenRouterModels, loading: orLoading, error: orError } = useLiveOpenRouterModels(baseUrl);

  const currentGroups = STATIC_GROUPS;
  const openRouterChannelGroups = useMemo(
    () => buildOpenRouterChannelGroups(liveOpenRouterModels),
    [liveOpenRouterModels],
  );
  const orderedChannels = useMemo(
    () => [
      ...CHANNEL_ORDER.filter((ch) => openRouterChannelGroups[ch]),
      ...Object.keys(openRouterChannelGroups).filter((ch) => !CHANNEL_ORDER.includes(ch)).sort(),
    ],
    [openRouterChannelGroups],
  );

  const totalCount = ALL_MODELS.length + liveOpenRouterModels.length;

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const haystack = [...ALL_MODELS, ...liveOpenRouterModels];
    return haystack.filter((m) =>
      m.id.toLowerCase().includes(q) ||
      m.label.toLowerCase().includes(q) ||
      m.desc.toLowerCase().includes(q)
    );
  }, [searchQuery, liveOpenRouterModels]);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
        <SectionTitle style={{ margin: 0 }}>可用模型（{totalCount} 个{orLoading ? "，OpenRouter 同步中…" : orError ? "，OpenRouter 同步失败" : ""}）</SectionTitle>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索模型 id / 名称 / 描述…"
            style={{
              background: "rgba(0,0,0,0.35)",
              border: `1px solid ${searchQuery ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.12)"}`,
              borderRadius: "8px",
              padding: "7px 32px 7px 12px",
              color: "#e2e8f0",
              fontSize: "14px",
              width: "240px",
              outline: "none",
              transition: "border-color 0.2s",
            }}
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: "0 2px" }}
            >
              ×
            </button>
          ) : (
            <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#475569", fontSize: "14px", pointerEvents: "none" }}>⌕</span>
          )}
        </div>
      </div>

      {!searchResults && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
          {(["thinking", "thinking-visible", "tools", "reasoning"] as const).map((v) => (
            <div key={v} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Badge variant={v}>{v}</Badge>
              <span style={{ fontSize: "14px", color: "#475569" }}>
                {v === "thinking" ? "扩展思考（隐藏）" : v === "thinking-visible" ? "扩展思考（可见）" : v === "tools" ? "支持工具调用" : "原生推理模型"}
              </span>
            </div>
          ))}
        </div>
      )}

      {searchResults !== null ? (
        <div>
          <div style={{ marginBottom: "10px", fontSize: "14px", color: "#64748b" }}>
            找到 <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{searchResults.length}</span> 个匹配模型
          </div>
          {searchResults.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#475569", fontSize: "14px" }}>
              没有找到匹配的模型
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {searchResults.map((m) => (
                <div key={m.id} className="model-row" style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "rgba(0,0,0,0.22)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "7px", padding: "7px 12px",
                }}>
                  <span style={{
                    fontSize: "12px", fontWeight: 600, letterSpacing: "0.3px",
                    color: PROVIDER_HEX_COLORS[m.provider] || "#94a3b8",
                    background: `${PROVIDER_HEX_COLORS[m.provider] || "#94a3b8"}15`,
                    border: `1px solid ${PROVIDER_HEX_COLORS[m.provider] || "#94a3b8"}30`,
                    padding: "2px 7px", borderRadius: "20px", flexShrink: 0,
                  }}>
                    {PROVIDER_LABELS[m.provider] || m.provider}
                  </span>
                  <code style={{ fontFamily: "Menlo, monospace", fontSize: "14px", color: "#ddd6fe", flex: 1, wordBreak: "break-all", lineHeight: "1.4" }}>
                    {highlight(m.id, searchQuery)}
                  </code>
                  <span style={{ fontSize: "12px", color: "#64748b", flexShrink: 0, textAlign: "right", maxWidth: "200px" }}>
                    {highlight(m.desc, searchQuery)}
                  </span>
                  {m.context && (
                    <span style={{ fontSize: "12px", color: "#334155", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", padding: "1px 6px", flexShrink: 0, letterSpacing: "0.3px" }}>
                      {m.context}
                    </span>
                  )}
                  {m.badge && <Badge variant={m.badge}>{m.badge}</Badge>}
                  <CopyButton text={m.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <ModelGroup title="OpenAI" models={currentGroups.openai} provider="openai" category="replit" expanded={expandedGroups.openai} onToggle={() => toggleGroup("openai")} />
          <ModelGroup title="Anthropic" models={currentGroups.anthropic} provider="anthropic" category="replit" expanded={expandedGroups.anthropic} onToggle={() => toggleGroup("anthropic")} />
          <ModelGroup title="Google" models={currentGroups.gemini} provider="gemini" category="replit" expanded={expandedGroups.gemini} onToggle={() => toggleGroup("gemini")} />

          <div style={{ marginBottom: "8px" }}>
            <button
              onClick={() => toggleGroup("openrouter")}
              style={{
                display: "flex", alignItems: "center", gap: "12px", width: "100%",
                background: orExpanded ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${orExpanded ? "rgba(167,139,250,0.25)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: orExpanded ? "8px 8px 0 0" : "8px",
                padding: "10px 14px", cursor: "pointer", textAlign: "left",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#a78bfa", flexShrink: 0, boxShadow: "0 0 6px #a78bfa80" }} />
              <span style={{ fontWeight: 600, color: "#c4b5fd", fontSize: "14px", flex: 1, letterSpacing: "0.1px" }}>
                OpenRouter
                <span style={{ fontWeight: 400, color: "#475569", fontSize: "14px", marginLeft: "8px" }}>
                  {orderedChannels.length} 个服务商
                </span>
              </span>
              <span style={{
                fontSize: "12px", fontWeight: 600, color: "#34d399",
                background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)",
                padding: "2px 7px", borderRadius: "20px", flexShrink: 0, letterSpacing: "0.3px",
              }}>
                Replit官方
              </span>
              <span style={{ fontSize: "12px", color: "#475569" }}>
                {orLoading ? "同步中…" : orError ? "同步失败" : `${liveOpenRouterModels.length} 个模型`}
              </span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "#475569", flexShrink: 0, marginLeft: "2px", transform: orExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {orExpanded && (
              <div style={{
                border: "1px solid rgba(167,139,250,0.25)", borderTop: "none",
                borderRadius: "0 0 8px 8px", overflow: "hidden",
              }}>
                {orderedChannels.map((ch, idx) => {
                  const chModels = openRouterChannelGroups[ch];
                  const label = CHANNEL_LABELS[ch] || ch;
                  const isOpen = expandedChannels[ch];
                  return (
                    <div key={ch} style={{ borderTop: idx > 0 ? "1px solid rgba(167,139,250,0.1)" : "none" }}>
                      <button onClick={() => toggleChannel(ch)} style={{
                        display: "flex", alignItems: "center", gap: "10px", width: "100%",
                        background: isOpen ? "rgba(167,139,250,0.07)" : "rgba(167,139,250,0.03)",
                        border: "none", padding: "8px 14px", cursor: "pointer", textAlign: "left",
                        transition: "background 0.15s",
                      }}>
                        <span style={{ fontWeight: 600, color: "#a78bfa", fontSize: "14px", flex: 1 }}>{label}</span>
                        <span style={{ fontSize: "12px", color: "#475569" }}>{chModels.length} 个模型</span>
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ color: "#475569", flexShrink: 0, marginLeft: "2px", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                          <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div style={{ borderTop: "1px solid rgba(167,139,250,0.08)" }}>
                          {chModels.map((m, mi) => (
                            <div key={m.id} className="model-row" style={{
                              display: "flex", alignItems: "center", gap: "10px",
                              background: "rgba(0,0,0,0.18)",
                              borderTop: mi > 0 ? "1px solid rgba(255,255,255,0.03)" : "none",
                              padding: "6px 14px",
                            }}>
                              <code style={{ fontFamily: "Menlo, monospace", fontSize: "14px", color: "#ddd6fe", flex: 1, wordBreak: "break-all", lineHeight: "1.4" }}>
                                {m.id}
                              </code>
                              {m.desc && (
                                <span style={{ fontSize: "12px", color: "#64748b", flexShrink: 0, textAlign: "right", maxWidth: "160px" }}>
                                  {m.desc}
                                </span>
                              )}
                              {m.context && (
                                <span style={{ fontSize: "12px", color: "#334155", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", padding: "1px 6px", flexShrink: 0, letterSpacing: "0.3px" }}>
                                  {m.context}
                                </span>
                              )}
                              {m.badge && <Badge variant={m.badge}>{m.badge}</Badge>}
                              <CopyButton text={m.id} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <ModelGroup title="xAI (Grok)" models={currentGroups.xai} provider="xai" category="official" expanded={expandedGroups.xai} onToggle={() => toggleGroup("xai")} />
          <ModelGroup title="DeepSeek" models={currentGroups.deepseek} provider="deepseek" category="official" expanded={expandedGroups.deepseek} onToggle={() => toggleGroup("deepseek")} />
          <ModelGroup title="Mistral AI" models={currentGroups.mistral} provider="mistral" category="official" expanded={expandedGroups.mistral} onToggle={() => toggleGroup("mistral")} />
          <ModelGroup title="Moonshot AI / Kimi" models={currentGroups.moonshot} provider="moonshot" category="official" expanded={expandedGroups.moonshot} onToggle={() => toggleGroup("moonshot")} />
          <ModelGroup title="Groq" models={currentGroups.groq} provider="groq" category="chip" expanded={expandedGroups.groq} onToggle={() => toggleGroup("groq")} />
          <ModelGroup title="Cerebras" models={currentGroups.cerebras} provider="cerebras" category="chip" expanded={expandedGroups.cerebras} onToggle={() => toggleGroup("cerebras")} />
          <ModelGroup title="Together AI" models={currentGroups.together} provider="together" category="oss" expanded={expandedGroups.together} onToggle={() => toggleGroup("together")} />
          <ModelGroup title="SiliconFlow" models={currentGroups.siliconflow} provider="siliconflow" category="oss" expanded={expandedGroups.siliconflow} onToggle={() => toggleGroup("siliconflow")} />
          <ModelGroup title="Fireworks AI" models={currentGroups.fireworks} provider="fireworks" category="oss" expanded={expandedGroups.fireworks} onToggle={() => toggleGroup("fireworks")} />
          <ModelGroup title="Novita AI" models={currentGroups.novita} provider="novita" category="oss" expanded={expandedGroups.novita} onToggle={() => toggleGroup("novita")} />
          <ModelGroup title="Hyperbolic" models={currentGroups.hyperbolic} provider="hyperbolic" category="oss" expanded={expandedGroups.hyperbolic} onToggle={() => toggleGroup("hyperbolic")} />

          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
            除已注册的 Groq / Together / SiliconFlow / Cerebras / Fireworks / Novita / Hyperbolic 前缀外，其他包含 <code style={{ fontFamily: "Menlo, monospace", color: "#a78bfa" }}>/</code> 的模型名会自动路由到 OpenRouter。
          </p>
        </>
      )}
    </Card>
  );
}
