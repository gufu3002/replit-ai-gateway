import {
  getAnthropicCredentials,
  getGeminiCredentials,
  getProviderCredentials,
} from "./proxy-raw";

export interface ModelRecord {
  id: string;
  provider: string;
  /** Context window length in tokens, when known from upstream metadata. */
  contextLength?: number;
}

const OPENAI_CHAT_MODELS = [
  // GPT-5 series
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  // GPT-5 Codex series (Responses API only)
  "gpt-5.3-codex",
  "gpt-5.2-codex",
  // GPT-4.1 series (legacy)
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  // GPT-4o series (legacy)
  "gpt-4o",
  "gpt-4o-mini",
  // Reasoning / thinking models
  "o4-mini",
  "o3",
  "o3-mini",
  // Image generation
  "gpt-image-1",
  // Audio models
  "gpt-audio",
  "gpt-audio-mini",
  // Transcription
  "gpt-4o-mini-transcribe",
];

export const OPENAI_NON_CHAT_MODELS = new Set([
  "gpt-image-1",
  "gpt-audio",
  "gpt-audio-mini",
  "gpt-4o-mini-transcribe",
]);

export const OPENAI_RESPONSES_API_MODELS = new Set([
  "gpt-5.3-codex",
  "gpt-5.2-codex",
]);

export const GEMINI_NON_CHAT_MODELS = new Set([
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
]);

// o-series are natively thinking models; expose -thinking aliases that map directly
const OPENAI_THINKING_ALIASES = OPENAI_CHAT_MODELS.filter((m) =>
  m.startsWith("o"),
).map((m) => `${m}-thinking`);

const ANTHROPIC_BASE_MODELS = [
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-opus-4-5",
  "claude-opus-4-1",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
];

// claude-opus-4-7 不支持 extended thinking（官方：Extended thinking = No）
// 这些模型只暴露 base 版本，不生成 -thinking / -thinking-visible 别名
export const ANTHROPIC_NO_EXTENDED_THINKING = new Set([
  "claude-opus-4-7",
]);

// Gemini models (text / multimodal)
// 与 Replit AI Integrations Gemini SKILL 支持清单严格对齐
// 注：gemini-3-pro-preview 不是真实模型 ID，已于 2026-04-20 移除
// 注：gemini-3.1-flash-lite-preview / gemini-3.1-flash-image-preview / gemini-2.5-flash-lite
//     不在 Replit AI Integrations 清单内，已于 2026-04-22 移除
const GEMINI_BASE_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-image",
];

// Gemini models that support thinkingConfig
export const GEMINI_THINKING_CAPABLE = new Set([
  "gemini-3.1-pro-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
]);

// DeepSeek native API models (routed to api.deepseek.com)
const DEEPSEEK_CHAT_MODELS = [
  "deepseek-v4-pro", // DeepSeek V4 Pro (flagship, 1M context)
  "deepseek-v4-flash", // DeepSeek V4 Flash (fast, 1M context)
  "deepseek-chat", // DeepSeek V3 (deprecated Jul 24 2026, maps to v4-flash)
  "deepseek-reasoner", // DeepSeek R1 (deprecated Jul 24 2026, maps to v4-flash)
];

// xAI native API models (grok-* prefix, routed to api.x.ai)
const XAI_CHAT_MODELS = [
  "grok-4.3",
  "grok-4",
  "grok-4-fast",
  "grok-3",
  "grok-3-fast",
  "grok-3-mini",
  "grok-3-mini-fast",
  "grok-2-1212",
  "grok-2",
  "grok-beta",
];

// Mistral AI native API models (routed to api.mistral.ai)
const MISTRAL_CHAT_MODELS = [
  "mistral-large-latest",
  "mistral-medium-latest",
  "mistral-medium-3.5",
  "mistral-small-latest",
  "mistral-saba-latest",
  "codestral-latest",
  "devstral-medium",
  "devstral-small",
  "mistral-nemo",
  "pixtral-large-latest",
  "mixtral-8x22b-instruct-v0.1",
  "mixtral-8x7b-instruct-v0.1",
  "mistral-7b-instruct-v0.3",
  "voxtral-small-latest",
  "ministral-8b-latest",
  "ministral-3b-latest",
];

// Moonshot AI native API models (routed to api.moonshot.cn)
const MOONSHOT_CHAT_MODELS = [
  "moonshot-v1-8k",
  "moonshot-v1-32k",
  "moonshot-v1-128k",
  "moonshot-v1-auto",
  "kimi-k2-0528",
  "kimi-thinking-preview",
];

// Groq-hosted models (groq/model format, routed to api.groq.com)
const GROQ_FEATURED_MODELS = [
  // Current production models on Groq pricing page (2026-04-20)
  "groq/llama-3.3-70b-versatile",
  "groq/llama-3.1-8b-instant",
  "groq/llama-4-scout-17b-16e-instruct",
  "groq/qwen/qwen3-32b",
  "groq/openai/gpt-oss-20b",
  "groq/openai/gpt-oss-120b",
  // Legacy models (still accessible but not on main pricing page)
  "groq/llama-3.1-70b-versatile",
  "groq/llama-3.2-90b-vision-preview",
  "groq/llama-3.2-11b-vision-preview",
  "groq/llama-3.2-3b-preview",
  "groq/llama-3.2-1b-preview",
  "groq/llama-4-maverick-17b-128e-instruct",
  "groq/gemma2-9b-it",
  "groq/gemma-7b-it",
  "groq/mixtral-8x7b-32768",
  "groq/deepseek-r1-distill-llama-70b",
  "groq/qwen-qwq-32b",
];

// Together AI-hosted models (together/model format, routed to api.together.xyz)
const TOGETHER_FEATURED_MODELS = [
  "together/meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "together/meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
  "together/meta-llama/Llama-3.1-405B-Instruct-Turbo",
  "together/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
  "together/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  "together/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
  "together/meta-llama/Llama-4-Scout-17B-16E-Instruct",
  "together/Qwen/Qwen2.5-72B-Instruct-Turbo",
  "together/Qwen/Qwen2.5-Coder-32B-Instruct",
  "together/Qwen/QwQ-32B",
  "together/deepseek-ai/DeepSeek-V3",
  "together/deepseek-ai/DeepSeek-R1",
  "together/deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
  "together/mistralai/Mixtral-8x7B-Instruct-v0.1",
  "together/mistralai/Mixtral-8x22B-Instruct-v0.1",
  "together/google/gemma-2-27b-it",
  "together/google/gemma-2-9b-it",
  "together/microsoft/WizardLM-2-8x22B",
  "together/NovaSky-Berkeley/Sky-T1-32B-Preview",
];

// SiliconFlow-hosted models (siliconflow/model format, routed to api.siliconflow.cn)
const SILICONFLOW_FEATURED_MODELS = [
  "siliconflow/Qwen/Qwen2.5-72B-Instruct",
  "siliconflow/Qwen/Qwen2.5-32B-Instruct",
  "siliconflow/Qwen/Qwen2.5-14B-Instruct",
  "siliconflow/Qwen/Qwen2.5-7B-Instruct",
  "siliconflow/Qwen/Qwen3-235B-A22B",
  "siliconflow/Qwen/Qwen3-30B-A3B",
  "siliconflow/Qwen/Qwen3-14B",
  "siliconflow/Qwen/Qwen3-8B",
  "siliconflow/Qwen/QwQ-32B",
  "siliconflow/Qwen/Qwen2.5-Coder-32B-Instruct",
  "siliconflow/deepseek-ai/DeepSeek-V3",
  "siliconflow/deepseek-ai/DeepSeek-R1",
  "siliconflow/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
  "siliconflow/deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
  "siliconflow/meta-llama/Meta-Llama-3.1-405B-Instruct",
  "siliconflow/meta-llama/Meta-Llama-3.1-70B-Instruct",
  "siliconflow/meta-llama/Meta-Llama-3.1-8B-Instruct",
  "siliconflow/mistralai/Mistral-7B-Instruct-v0.2",
  "siliconflow/THUDM/glm-4-9b-chat",
  "siliconflow/internlm/internlm2_5-20b-chat",
];

// Cerebras-hosted models (cerebras/model format, routed to api.cerebras.ai)
// 注：qwen-3-32b 和 llama-4-scout-17b-16e 已于 2026-02-16 弃用
const CEREBRAS_FEATURED_MODELS = [
  "cerebras/llama3.1-8b",
  "cerebras/llama3.3-70b",
];

// Fireworks AI models (fireworks/ prefix, routed to api.fireworks.ai)
const FIREWORKS_FEATURED_MODELS = [
  "fireworks/accounts/fireworks/models/llama4-maverick-instruct-basic",
  "fireworks/accounts/fireworks/models/llama4-scout-instruct-basic",
  "fireworks/accounts/fireworks/models/qwen3-235b-a22b",
  "fireworks/accounts/fireworks/models/qwen3-30b-a3b",
  "fireworks/accounts/fireworks/models/deepseek-r1",
  "fireworks/accounts/fireworks/models/deepseek-v3",
  "fireworks/accounts/fireworks/models/deepseek-v3-0324",
];

// Novita AI models (novita/ prefix, routed to api.novita.ai)
const NOVITA_FEATURED_MODELS = [
  "novita/deepseek/deepseek-v3-turbo",
  "novita/deepseek/deepseek-r1-turbo",
  "novita/deepseek/deepseek-v3-0324",
  "novita/meta-llama/llama-4-maverick-17b-128e-instruct",
  "novita/qwen/qwen3-235b-a22b",
  "novita/meta-llama/llama-3.1-405b-instruct",
];

// Hyperbolic models (hyperbolic/ prefix, routed to api.hyperbolic.xyz)
const HYPERBOLIC_FEATURED_MODELS = [
  "hyperbolic/deepseek-ai/DeepSeek-V3-0324",
  "hyperbolic/deepseek-ai/DeepSeek-R1-Zero",
  "hyperbolic/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
  "hyperbolic/Qwen/Qwen3-235B-A22B",
  "hyperbolic/Qwen/Qwen2.5-72B-Instruct",
  "hyperbolic/NovaSky-Berkeley/Sky-T1-32B-Preview",
];

// OpenRouter models are fully driven by the live sync from
  // https://openrouter.ai/api/v1/models (see fetchOpenAIStyleModels in
  // getAvailableModels below). The local featured fallback is intentionally
  // empty — keeping a hard-coded mirror invites drift against the upstream
  // catalog and adds maintenance burden for no benefit, since the live
  // endpoint is publicly readable even without a configured API key.
  const OPENROUTER_FEATURED_MODELS: string[] = [];

// Build the full model list for GET /models
export const MODELS: ModelRecord[] = [
  ...OPENAI_CHAT_MODELS.map((id) => ({ id, provider: "openai" })),
  ...OPENAI_THINKING_ALIASES.map((id) => ({ id, provider: "openai" })),
  ...ANTHROPIC_BASE_MODELS.flatMap((id) => {
    const entries: { id: string; provider: string }[] = [{ id, provider: "anthropic" }];
    if (!ANTHROPIC_NO_EXTENDED_THINKING.has(id)) {
      entries.push({ id: `${id}-thinking`, provider: "anthropic" });
      entries.push({ id: `${id}-thinking-visible`, provider: "anthropic" });
    }
    return entries;
  }),
  ...GEMINI_BASE_MODELS.flatMap((id) => {
    const entries: { id: string; provider: string }[] = [
      { id, provider: "google" },
    ];
    if (GEMINI_THINKING_CAPABLE.has(id)) {
      entries.push({ id: `${id}-thinking`, provider: "google" });
      entries.push({ id: `${id}-thinking-visible`, provider: "google" });
    }
    return entries;
  }),
  ...DEEPSEEK_CHAT_MODELS.map((id) => ({ id, provider: "deepseek" })),
  ...XAI_CHAT_MODELS.map((id) => ({ id, provider: "xai" })),
  ...MISTRAL_CHAT_MODELS.map((id) => ({ id, provider: "mistral" })),
  ...MOONSHOT_CHAT_MODELS.map((id) => ({ id, provider: "moonshot" })),
  ...GROQ_FEATURED_MODELS.map((id) => ({ id, provider: "groq" })),
  ...TOGETHER_FEATURED_MODELS.map((id) => ({ id, provider: "together" })),
  ...SILICONFLOW_FEATURED_MODELS.map((id) => ({ id, provider: "siliconflow" })),
  ...CEREBRAS_FEATURED_MODELS.map((id) => ({ id, provider: "cerebras" })),
  ...FIREWORKS_FEATURED_MODELS.map((id) => ({ id, provider: "fireworks" })),
  ...NOVITA_FEATURED_MODELS.map((id) => ({ id, provider: "novita" })),
  ...HYPERBOLIC_FEATURED_MODELS.map((id) => ({ id, provider: "hyperbolic" })),
  ...OPENROUTER_FEATURED_MODELS.map((id) => ({ id, provider: "openrouter" })),
];

interface SyncedModelSource {
  provider: string;
  status: "synced" | "skipped" | "failed" | "fallback";
  count: number;
  error?: string;
}

interface ModelSyncCache {
  ts: number;
  models: ModelRecord[];
  sources: SyncedModelSource[];
}

const MODEL_SYNC_CACHE_TTL_MS = 60_000;
// Minimum interval between forced refreshes (?refresh=1) to prevent DoS via
// repeated upstream fetch storms. Even with modelSyncInflight deduplication,
// serial requests spaced >1ms apart would each trigger 4 upstream fetches.
const FORCE_REFRESH_MIN_INTERVAL_MS = 10_000;
let modelSyncCache: ModelSyncCache | null = null;
let lastForcedRefreshMs = 0;
// Inflight promise: merges concurrent cache-miss fetches so only one upstream
// request is made even when multiple requests arrive at the same time.
let modelSyncInflight: Promise<{ models: ModelRecord[]; sources: SyncedModelSource[] }> | null = null;

function uniqueModels(records: ModelRecord[]): ModelRecord[] {
  const seen = new Set<string>();
  const out: ModelRecord[] = [];
  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

function withGeneratedAliases(records: ModelRecord[]): ModelRecord[] {
  const out: ModelRecord[] = [];
  for (const record of records) {
    out.push(record);
    if (record.provider === "openai" && /^o\d/.test(record.id)) {
      out.push({ id: `${record.id}-thinking`, provider: record.provider });
    }
    if (record.provider === "anthropic" && !ANTHROPIC_NO_EXTENDED_THINKING.has(record.id)) {
      out.push({ id: `${record.id}-thinking`, provider: record.provider });
      out.push({ id: `${record.id}-thinking-visible`, provider: record.provider });
    }
    if (record.provider === "google" && GEMINI_THINKING_CAPABLE.has(record.id)) {
      out.push({ id: `${record.id}-thinking`, provider: record.provider });
      out.push({ id: `${record.id}-thinking-visible`, provider: record.provider });
    }
  }
  return uniqueModels(out);
}

async function fetchJsonWithTimeout(url: string, headers: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenAIStyleModels(
  provider: "openai" | "openrouter",
  baseUrl: string,
  apiKey: string,
): Promise<ModelRecord[]> {
  if (!baseUrl && provider !== "openrouter") return [];
  if (!apiKey && provider !== "openrouter") return [];
  const root = baseUrl.replace(/\/+$/, "");
  const data = await fetchJsonWithTimeout(`${root}/models`, {
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  });
  const rows = Array.isArray((data as { data?: unknown[] }).data)
    ? (data as { data: Array<{ id?: unknown; context_length?: unknown; top_provider?: unknown }> }).data
    : [];
  const out: ModelRecord[] = [];
  for (const item of rows) {
    if (typeof item.id !== "string" || !item.id) continue;
    let contextLength: number | undefined;
    // OpenRouter top-level `context_length` (preferred), then nested
    // `top_provider.context_length` if the top-level value is missing.
    if (typeof item.context_length === "number" && item.context_length > 0) {
      contextLength = item.context_length;
    } else if (
      item.top_provider &&
      typeof item.top_provider === "object" &&
      typeof (item.top_provider as { context_length?: unknown }).context_length === "number"
    ) {
      const v = (item.top_provider as { context_length: number }).context_length;
      if (v > 0) contextLength = v;
    }
    out.push({ id: item.id, provider, ...(contextLength ? { contextLength } : {}) });
  }
  return out;
}

async function fetchAnthropicModels(): Promise<ModelRecord[]> {
  const { baseUrl, apiKey } = getAnthropicCredentials();
  if (!apiKey) return [];
  const root = baseUrl.replace(/\/+$/, "");
  const url = root.endsWith("/v1") ? `${root}/models` : `${root}/v1/models`;
  const data = await fetchJsonWithTimeout(url, {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  });
  const rows = Array.isArray((data as { data?: unknown[] }).data)
    ? (data as { data: Array<{ id?: unknown }> }).data
    : [];
  return rows
    .map((item) => (typeof item.id === "string" ? item.id : ""))
    .filter(Boolean)
    .map((id) => ({ id, provider: "anthropic" }));
}

async function fetchGeminiModels(): Promise<ModelRecord[]> {
  const { baseUrl, apiKey } = getGeminiCredentials();
  if (!apiKey) return [];
  const root = baseUrl.replace(/\/+$/, "");
  const separator = root.includes("?") ? "&" : "?";
  const data = await fetchJsonWithTimeout(`${root}/models${separator}key=${encodeURIComponent(apiKey)}`, {
    "x-goog-api-key": apiKey,
  });
  const rows = Array.isArray((data as { models?: unknown[] }).models)
    ? (data as { models: Array<{ name?: unknown; supportedGenerationMethods?: unknown }> }).models
    : [];
  return rows
    .filter((item) => {
      const methods = item.supportedGenerationMethods;
      return !Array.isArray(methods) || methods.some((m) => typeof m === "string" && m.toLowerCase().includes("generate"));
    })
    .map((item) => (typeof item.name === "string" ? item.name.replace(/^models\//, "") : ""))
    .filter(Boolean)
    .map((id) => ({ id, provider: "google" }));
}

function staticModelsWithoutSyncedProviders(syncedProviders: Set<string>): ModelRecord[] {
  return MODELS.filter((model) => !syncedProviders.has(model.provider));
}

async function doFetchAvailableModels(): Promise<{ models: ModelRecord[]; sources: SyncedModelSource[] }> {
  const now = Date.now();
  const sources: SyncedModelSource[] = [];
  const syncedProviders = new Set<string>();
  const dynamicModels: ModelRecord[] = [];

  const syncJobs: Array<{ provider: string; run: () => Promise<ModelRecord[]> }> = [
    { provider: "openai", run: () => {
      const credentials = getProviderCredentials("openai");
      return fetchOpenAIStyleModels("openai", credentials.baseUrl, credentials.apiKey);
    } },
    { provider: "anthropic", run: fetchAnthropicModels },
    { provider: "google", run: fetchGeminiModels },
    { provider: "openrouter", run: () => {
      const credentials = getProviderCredentials("openrouter");
      return fetchOpenAIStyleModels("openrouter", credentials.baseUrl || "https://openrouter.ai/api/v1", credentials.apiKey)
        .catch(() => fetchOpenAIStyleModels("openrouter", "https://openrouter.ai/api/v1", ""));
    } },
  ];

  const results = await Promise.all(syncJobs.map(async (job) => {
    try {
      return { provider: job.provider, status: "fulfilled" as const, models: await job.run() };
    } catch (error) {
      return { provider: job.provider, status: "rejected" as const, error };
    }
  }));
  for (const result of results) {
    if (result.status === "fulfilled") {
      const models = uniqueModels(withGeneratedAliases(result.models));
      if (models.length > 0) {
        syncedProviders.add(result.provider);
        dynamicModels.push(...models);
        sources.push({ provider: result.provider, status: "synced", count: models.length });
      } else {
        sources.push({ provider: result.provider, status: "skipped", count: 0 });
      }
    } else {
      sources.push({
        provider: result.provider,
        status: "fallback",
        count: 0,
        error: result.error instanceof Error ? result.error.message : String(result.error),
      });
    }
  }

  const models = syncedProviders.size === 0
    ? MODELS
    : uniqueModels([
      ...dynamicModels,
      ...staticModelsWithoutSyncedProviders(syncedProviders),
    ]);
  modelSyncCache = { ts: now, models, sources };
  return { models, sources };
}

export async function getAvailableModels(forceRefresh = false): Promise<{ models: ModelRecord[]; sources: SyncedModelSource[] }> {
  const now = Date.now();
  // Throttle forced refreshes: allow at most one forced fetch per FORCE_REFRESH_MIN_INTERVAL_MS.
  // This prevents DoS via serial ?refresh=1 requests triggering 4 upstream fetches each time.
  const effectiveForce = forceRefresh && (now - lastForcedRefreshMs >= FORCE_REFRESH_MIN_INTERVAL_MS);
  if (effectiveForce) lastForcedRefreshMs = now;
  if (!effectiveForce && modelSyncCache && now - modelSyncCache.ts < MODEL_SYNC_CACHE_TTL_MS) {
    return { models: modelSyncCache.models, sources: modelSyncCache.sources };
  }
  // Coalesce concurrent cache-miss requests into a single upstream fetch.
  if (!modelSyncInflight) {
    modelSyncInflight = doFetchAvailableModels().finally(() => {
      modelSyncInflight = null;
    });
  }
  return modelSyncInflight;
}
