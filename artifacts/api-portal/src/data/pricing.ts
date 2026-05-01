export interface ModelPricing {
  input: number;
  output: number;
}

// 定价单位：美元 / 100 万 tokens（USD per 1M tokens）
// 最后实时查询更新：2026-05-01（含新模型 gpt-5.5/grok-4.3/mistral-medium-3.5 定价与 SDK 指纹同步）
const EXACT_PRICING: Record<string, ModelPricing> = {
  // ─── OpenAI GPT-5 系列 ───────────────────────────────────────────────
  // 来源：platform.openai.com/docs/pricing（2026-05-01 实时查询）
  // gpt-5.5 / gpt-5.5-pro：2026-04-24 API 开放，$5/$30 标准档；Pro 版 $30/$180
  "gpt-5.5": { input: 5, output: 30 },
  "gpt-5.5-pro": { input: 30, output: 180 },
  // gpt-5.4 旗舰档位定价（与 5.2 / 5.1 一致）
  "gpt-5.4": { input: 15, output: 60 },
  "gpt-5.2": { input: 15, output: 60 },
  "gpt-5.1": { input: 15, output: 60 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.1, output: 0.4 },

  // ─── OpenAI GPT-4.1 系列 ─────────────────────────────────────────────
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },

  // ─── OpenAI GPT-4o 系列 ──────────────────────────────────────────────
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },

  // ─── OpenAI Codex（Responses API）───────────────────────────────────
  // 来源：openai.com/api/pricing 定价页 dropdown（2026-04-20 实时查询）
  // Replit 渠道真实模型 ID：gpt-5.3-codex（旗舰）、gpt-5.2-codex（轻量）
  "gpt-5.3-codex": { input: 3, output: 15 },
  "gpt-5.2-codex": { input: 1.5, output: 6 },

  // ─── OpenAI o-series 推理模型 ────────────────────────────────────────
  // o3 于 2026 年定价调整为 $2/$8（原 $10/$40）
  "o4-mini": { input: 1.1, output: 4.4 },
  "o4-mini-thinking": { input: 1.1, output: 4.4 },
  "o3": { input: 2, output: 8 },
  "o3-thinking": { input: 2, output: 8 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "o3-mini-thinking": { input: 1.1, output: 4.4 },

  // ─── DeepSeek ───────────────────────────────────────────────────────
  // 来源：api-docs.deepseek.com/quick_start/pricing（2026-04-24 实时查询）
  // V4 发布，deepseek-chat/reasoner 废弃（2026-07-24），现映射至 V4 Flash
  "deepseek-v4-pro": { input: 1.74, output: 3.48 },
  "deepseek-v4-flash": { input: 0.14, output: 0.28 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "deepseek-reasoner": { input: 0.14, output: 0.28 },

  // ─── Gemini 2.5 系列────────────────────────────────────────────────
  // 来源：ai.google.dev/gemini-api/docs/pricing（2026-04-20 实时查询）
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-flash-image": { input: 0.3, output: 2.5 },
  // ─── Gemini 3 系列（Preview，免费层可用；付费层定价）────────────────
  // 来源：ai.google.dev/gemini-api/docs/pricing（2026-04-20 实时查询）
  // 注：以下 *-lite-preview / *-flash-image-preview 已不在 Replit AI Integrations 支持清单内，
  //     模型列表已移除（v0.1.70 同步），但保留定价条目作为兜底——若用户经其他通道直接传入
  //     这些模型 ID，UsageLogsPage 仍可估算费用，符合"透明中转"原则
  "gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.5 },
  "gemini-3.1-flash-image-preview": { input: 0.3, output: 2.5 },

  // ─── xAI Grok ───────────────────────────────────────────────────────
  // 来源：docs.x.ai/developers/models（2026-05-01 官方实时查询，已核查 API 真实模型 ID）
  // grok-4.3：2026-04-17 Beta 发布，$1.25/$2.50 per 1M tokens
  "grok-4.3": { input: 1.25, output: 2.5 },
  // grok-4 / grok-4.20 系列：$2.00/$6.00（较先前 $3/$15 大幅降价）
  "grok-4.20-0309-reasoning": { input: 2, output: 6 },
  "grok-4.20-0309-non-reasoning": { input: 2, output: 6 },
  "grok-4.20-multi-agent-0309": { input: 2, output: 6 },
  "grok-4.20": { input: 2, output: 6 },
  "grok-4": { input: 2, output: 6 },
  // grok-4-1-fast / grok-4-fast 别名：$0.20/$0.50，2M 超长上下文
  "grok-4-1-fast-reasoning": { input: 0.2, output: 0.5 },
  "grok-4-1-fast-non-reasoning": { input: 0.2, output: 0.5 },
  "grok-4-fast": { input: 0.2, output: 0.5 },
  // Grok 3 系列（仍可用，legacy 定价）
  "grok-3": { input: 3, output: 15 },
  "grok-3-beta": { input: 3, output: 15 },
  "grok-3-fast": { input: 0.6, output: 1.2 },
  "grok-3-mini": { input: 0.3, output: 0.5 },
  "grok-3-mini-fast": { input: 0.1, output: 0.2 },
  "grok-2-1212": { input: 2, output: 10 },
  "grok-2-vision-1212": { input: 2, output: 10 },
  "grok-2": { input: 2, output: 10 },

  // ─── Moonshot Kimi（上下文分档定价）────────────────────────────────
  // 来源：platform.moonshot.cn（2026-04-20 实时查询）
  "moonshot-v1-8k": { input: 0.2, output: 2 },
  "kimi-latest-8k": { input: 0.2, output: 2 },
  "moonshot-v1-32k": { input: 1, output: 3 },
  "kimi-latest-32k": { input: 1, output: 3 },
  "moonshot-v1-128k": { input: 2, output: 5 },
  "kimi-latest-128k": { input: 2, output: 5 },
  "kimi-latest": { input: 2, output: 5 },
  "kimi-k2-turbo": { input: 1.15, output: 8 },
  "kimi-k2": { input: 0.6, output: 2.5 },
  "moonshotai/kimi-k2.6": { input: 0.6, output: 2.8 },
  "moonshot-v1-auto": { input: 2, output: 5 },

  // ─── Groq（以 groq/ 前缀路由）──────────────────────────────────────
  // 来源：groq.com/pricing（2026-04-20 官方定价页实时查询）
  "groq/llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
  "groq/llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "groq/llama-3.3-70b-specdec": { input: 0.59, output: 0.99 },
  "groq/llama-3.1-70b-versatile": { input: 0.59, output: 0.79 },
  "groq/llama-4-scout-17b-16e-instruct": { input: 0.11, output: 0.34 },
  "groq/llama-4-maverick-17b-128e-instruct": { input: 0.5, output: 0.77 },
  "groq/deepseek-r1-distill-llama-70b": { input: 0.75, output: 0.99 },
  "groq/deepseek-r1-distill-qwen-32b": { input: 0.69, output: 0.69 },
  // Groq 新增模型（2026-04-20 官方定价页确认）
  "groq/qwen/qwen3-32b": { input: 0.29, output: 0.59 },
  "groq/openai/gpt-oss-20b": { input: 0.075, output: 0.3 },
  "groq/openai/gpt-oss-120b": { input: 0.15, output: 0.6 },
  // Legacy
  "groq/qwen-qwq-32b": { input: 0.29, output: 0.39 },
  "groq/gemma2-9b-it": { input: 0.2, output: 0.2 },
  "groq/llama-guard-3-8b": { input: 0.2, output: 0.2 },
  "groq/llama3-70b-8192": { input: 0.59, output: 0.79 },
  "groq/llama3-8b-8192": { input: 0.05, output: 0.08 },
  "groq/mixtral-8x7b-32768": { input: 0.24, output: 0.24 },

  // ─── Together AI（以 together/ 前缀路由）────────────────────────────
  // 来源：api.together.ai/models（2026-04-20 实时查询）
  "together/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8": { input: 0.27, output: 0.85 },
  "together/meta-llama/Llama-4-Scout-17B-16E-Instruct": { input: 0.18, output: 0.59 },
  "together/meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo": { input: 0.88, output: 0.88 },
  "together/meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo": { input: 3.5, output: 3.5 },
  "together/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": { input: 0.88, output: 0.88 },
  "together/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": { input: 0.18, output: 0.18 },
  "together/deepseek-ai/DeepSeek-R1": { input: 7, output: 7 },
  "together/deepseek-ai/DeepSeek-V3": { input: 1.25, output: 1.25 },
  "together/Qwen/Qwen2.5-72B-Instruct-Turbo": { input: 1.2, output: 1.2 },
  "together/Qwen/QwQ-32B": { input: 0.9, output: 0.9 },
  "together/mistralai/Mistral-7B-Instruct-v0.3": { input: 0.2, output: 0.2 },
  "together/mistralai/Mixtral-8x7B-Instruct-v0.1": { input: 0.6, output: 0.6 },
  "together/mistralai/Mixtral-8x22B-Instruct-v0.1": { input: 1.2, output: 1.2 },
  "together/google/gemma-2-27b-it": { input: 0.8, output: 0.8 },
  "together/google/gemma-2-9b-it": { input: 0.3, output: 0.3 },
  "together/microsoft/WizardLM-2-8x22B": { input: 1.2, output: 1.2 },
  "together/NovaSky-Berkeley/Sky-T1-32B-Preview": { input: 0.6, output: 0.6 },
  "together/togethercomputer/StripedHyena-Nous-7B": { input: 0.2, output: 0.2 },
  "together/upstage/SOLAR-10.7B-Instruct-v1.0": { input: 0.3, output: 0.3 },

  // ─── Cerebras（以 cerebras/ 前缀路由）───────────────────────────────
  // 来源：cloud.cerebras.ai/pricing（2026-04-20 实时查询）
  "cerebras/llama3.1-8b": { input: 0.1, output: 0.1 },
  "cerebras/llama3.1-70b": { input: 0.6, output: 0.6 },
  "cerebras/llama3.3-70b": { input: 0.6, output: 0.6 },
  "cerebras/llama3.1-405b": { input: 6, output: 12 },

  // ─── Hyperbolic（以 hyperbolic/ 前缀路由，混合定价）────────────────
  // 来源：docs.hyperbolic.xyz/docs/hyperbolic-pricing（2026-04-07 实时查询）
  "hyperbolic/meta-llama/Llama-3.3-70B-Instruct": { input: 0.4, output: 0.4 },
  "hyperbolic/meta-llama/Meta-Llama-3.1-405B-Instruct": { input: 4, output: 4 },
  "hyperbolic/meta-llama/Meta-Llama-3.1-70B-Instruct": { input: 0.4, output: 0.4 },
  "hyperbolic/deepseek-ai/DeepSeek-R1": { input: 3, output: 3 },
  "hyperbolic/deepseek-ai/DeepSeek-V3": { input: 0.2, output: 0.2 },
  "hyperbolic/Qwen/Qwen2.5-72B-Instruct": { input: 0.4, output: 0.4 },

  // ─── Mistral（精确 ID 条目）────────────────────────────────────────
  "mistral-saba-latest": { input: 0.20, output: 0.60 },
  "pixtral-large-latest": { input: 2, output: 6 },
  // ─── Novita AI（以 novita/ 前缀路由）────────────────────────────────
  // 来源：novita.ai/llm-api/pricing（2026-04-20 实时查询）
  "novita/meta-llama/llama-3.1-8b-instruct": { input: 0.02, output: 0.02 },
  "novita/meta-llama/llama-3.3-70b-instruct": { input: 0.23, output: 0.23 },
  "novita/meta-llama/llama-3.1-70b-instruct": { input: 0.23, output: 0.23 },
  "novita/deepseek/deepseek-r1": { input: 0.55, output: 2.19 },
  "novita/deepseek/deepseek-v3": { input: 0.28, output: 0.28 },
  "novita/qwen/qwen2.5-72b-instruct": { input: 0.23, output: 0.23 },
};

const PREFIX_PRICING: Array<{ prefix: string; pricing: ModelPricing }> = [
  // ─── Anthropic Claude ───────────────────────────────────────────────
  // 来源：claude.ai/pricing（2026-04-16 官方发布）
  // Opus 4.7 / 4.6 统一定价 $5/$25（较旧版 Opus 4 降价 66.7%）
  { prefix: "claude-opus-4-7", pricing: { input: 5, output: 25 } },
  { prefix: "claude-opus-4-6", pricing: { input: 5, output: 25 } },
  { prefix: "claude-opus-4-5", pricing: { input: 5, output: 25 } },
  { prefix: "claude-opus-4.7", pricing: { input: 5, output: 25 } },
  { prefix: "claude-opus-4.6", pricing: { input: 5, output: 25 } },
  { prefix: "claude-opus-4.5", pricing: { input: 5, output: 25 } },
  { prefix: "claude-opus-4", pricing: { input: 15, output: 75 } },
  { prefix: "claude-sonnet-4", pricing: { input: 3, output: 15 } },
  // Haiku 4.5 定价更新：$1/$5（旧版 Haiku 4 为 $0.8/$4）
  { prefix: "claude-haiku-4-5", pricing: { input: 1, output: 5 } },
  { prefix: "claude-haiku-4.5", pricing: { input: 1, output: 5 } },
  { prefix: "claude-haiku-4", pricing: { input: 0.8, output: 4 } },
  { prefix: "claude-opus-3-7", pricing: { input: 15, output: 75 } },
  { prefix: "claude-sonnet-3-7", pricing: { input: 3, output: 15 } },
  { prefix: "claude-opus-3-5", pricing: { input: 15, output: 75 } },
  { prefix: "claude-sonnet-3-5", pricing: { input: 3, output: 15 } },
  { prefix: "claude-haiku-3-5", pricing: { input: 0.8, output: 4 } },
  { prefix: "claude-haiku-3", pricing: { input: 0.25, output: 1.25 } },

  // ─── Gemini 前缀匹配（覆盖未来版本）────────────────────────────────
  { prefix: "gemini-3.1-pro", pricing: { input: 2, output: 12 } },
  { prefix: "gemini-3.1-flash", pricing: { input: 0.25, output: 1.5 } },
  { prefix: "gemini-3-pro", pricing: { input: 1.25, output: 10 } },
  { prefix: "gemini-3-flash", pricing: { input: 0.5, output: 3 } },
  { prefix: "gemini-2.5-pro", pricing: { input: 1.25, output: 10 } },
  { prefix: "gemini-2.5-flash-lite", pricing: { input: 0.1, output: 0.4 } },
  { prefix: "gemini-2.5-flash", pricing: { input: 0.3, output: 2.5 } },
  { prefix: "gemini-2.0-flash-lite", pricing: { input: 0.075, output: 0.3 } },
  { prefix: "gemini-2.0-flash", pricing: { input: 0.1, output: 0.4 } },
  { prefix: "gemini-1.5-pro", pricing: { input: 1.25, output: 5 } },
  { prefix: "gemini-1.5-flash", pricing: { input: 0.075, output: 0.3 } },

  // ─── Mistral AI（以 mistral- / mixtral- / codestral- 等前缀路由）────
  // 来源：mistral.ai/technology/#pricing（2026-04-20 实时查询）
  { prefix: "mistral-large", pricing: { input: 0.5, output: 1.5 } },
  { prefix: "mistral-medium", pricing: { input: 0.4, output: 2 } },
  { prefix: "mistral-small", pricing: { input: 0.1, output: 0.3 } },
  { prefix: "mistral-nemo", pricing: { input: 0.02, output: 0.04 } },
  { prefix: "ministral-8b", pricing: { input: 0.1, output: 0.1 } },
  { prefix: "ministral-3b", pricing: { input: 0.04, output: 0.04 } },
  { prefix: "codestral", pricing: { input: 0.3, output: 0.9 } },
  { prefix: "devstral-medium", pricing: { input: 0.40, output: 2.00 } },
  { prefix: "devstral", pricing: { input: 0.07, output: 0.28 } },
  { prefix: "mixtral-8x22b", pricing: { input: 2, output: 6 } },
  { prefix: "mixtral-8x7b", pricing: { input: 0.7, output: 0.7 } },
  { prefix: "voxtral", pricing: { input: 0.10, output: 0.30 } },

  // ─── Fireworks AI（以 fireworks/ 前缀路由）──────────────────────────
  // 来源：fireworks.ai/pricing（2026-04-20 实时查询）
  // 按参数量分档，大于 16B 约 $0.9/M，小于 4B 约 $0.1/M
  { prefix: "fireworks/accounts/fireworks/models/llama-v3p3-70b", pricing: { input: 0.9, output: 0.9 } },
  { prefix: "fireworks/accounts/fireworks/models/llama-v3p1-405b", pricing: { input: 3, output: 3 } },
  { prefix: "fireworks/accounts/fireworks/models/deepseek-r1", pricing: { input: 3, output: 3 } },
  { prefix: "fireworks/accounts/fireworks/models/deepseek-v3", pricing: { input: 0.9, output: 0.9 } },
  { prefix: "fireworks/accounts/fireworks/models/qwen2p5-72b", pricing: { input: 0.9, output: 0.9 } },
  { prefix: "fireworks/accounts/fireworks/models/mixtral-8x22b", pricing: { input: 1.2, output: 1.2 } },
  { prefix: "fireworks/accounts/fireworks/models/mixtral-8x7b", pricing: { input: 0.5, output: 0.5 } },

  // ─── SiliconFlow（以 siliconflow/ 前缀路由，人民币折算）────────────
  // 大多数模型定价较低；仅列代表性定价
  { prefix: "siliconflow/deepseek-ai/DeepSeek-R1", pricing: { input: 0.55, output: 2.19 } },
  { prefix: "siliconflow/deepseek-ai/DeepSeek-V3", pricing: { input: 0.28, output: 0.28 } },
  { prefix: "siliconflow/Qwen/Qwen2.5-72B", pricing: { input: 0.4, output: 0.4 } },
  { prefix: "siliconflow/Qwen/Qwen2.5-7B", pricing: { input: 0.05, output: 0.05 } },
  { prefix: "siliconflow/meta-llama/Meta-Llama-3.3-70B", pricing: { input: 0.4, output: 0.4 } },
  { prefix: "siliconflow/meta-llama/Meta-Llama-3.1-8B", pricing: { input: 0.05, output: 0.05 } },
  { prefix: "siliconflow/THUDM/glm-4-9b", pricing: { input: 0.05, output: 0.05 } },

  // ─── OpenRouter 独占 owner 命名空间 ────────────────────────────────
  // 来源：openrouter.ai/api/v1/models 实时 API（2026-04-21）
  // 所有 prefix 均带 owner namespace（如 cohere/command-r），不会与其它直连厂商误匹配。
  // 在每个 owner 块内，更具体的前缀必须排在更宽泛的前缀之前。

  // Cohere Command
  { prefix: "cohere/command-a", pricing: { input: 2.5, output: 10 } },
  { prefix: "cohere/command-r-plus", pricing: { input: 2.5, output: 10 } },
  { prefix: "cohere/command-r7b", pricing: { input: 0.0375, output: 0.15 } },
  { prefix: "cohere/command-r", pricing: { input: 0.15, output: 0.6 } },

  // Perplexity Sonar
  { prefix: "perplexity/sonar-pro-search", pricing: { input: 3, output: 15 } },
  { prefix: "perplexity/sonar-reasoning-pro", pricing: { input: 2, output: 8 } },
  { prefix: "perplexity/sonar-deep-research", pricing: { input: 2, output: 8 } },
  { prefix: "perplexity/sonar-pro", pricing: { input: 3, output: 15 } },
  { prefix: "perplexity/sonar", pricing: { input: 1, output: 1 } },

  // NVIDIA Nemotron
  { prefix: "nvidia/llama-3.3-nemotron-super-49b", pricing: { input: 0.1, output: 0.4 } },
  { prefix: "nvidia/llama-3.1-nemotron-70b", pricing: { input: 1.2, output: 1.2 } },
  { prefix: "nvidia/nemotron-3-super-120b", pricing: { input: 0.09, output: 0.45 } },
  { prefix: "nvidia/nemotron-3-nano-30b", pricing: { input: 0.05, output: 0.2 } },
  { prefix: "nvidia/nemotron-nano-12b", pricing: { input: 0.2, output: 0.6 } },
  { prefix: "nvidia/nemotron-nano-9b", pricing: { input: 0.04, output: 0.16 } },

  // Amazon Nova
  { prefix: "amazon/nova-premier", pricing: { input: 2.5, output: 12.5 } },
  { prefix: "amazon/nova-2-lite", pricing: { input: 0.3, output: 2.5 } },
  { prefix: "amazon/nova-pro", pricing: { input: 0.8, output: 3.2 } },
  { prefix: "amazon/nova-lite", pricing: { input: 0.06, output: 0.24 } },
  { prefix: "amazon/nova-micro", pricing: { input: 0.035, output: 0.14 } },

  // AI21 Jamba
  { prefix: "ai21/jamba-large", pricing: { input: 2, output: 8 } },

  // Microsoft (Phi / WizardLM)
  { prefix: "microsoft/wizardlm-2-8x22b", pricing: { input: 0.62, output: 0.62 } },
  { prefix: "microsoft/phi-4", pricing: { input: 0.065, output: 0.14 } },

  // Liquid LFM
  { prefix: "liquid/lfm-2-24b", pricing: { input: 0.03, output: 0.12 } },

  // Inflection
  { prefix: "inflection/inflection-3", pricing: { input: 2.5, output: 10 } },

  // MiniMax
  { prefix: "minimax/minimax-m2.7", pricing: { input: 0.3, output: 1.2 } },
  { prefix: "minimax/minimax-m2.5", pricing: { input: 0.15, output: 1.2 } },
  { prefix: "minimax/minimax-m2-her", pricing: { input: 0.3, output: 1.2 } },
  { prefix: "minimax/minimax-m2.1", pricing: { input: 0.29, output: 0.95 } },
  { prefix: "minimax/minimax-m2", pricing: { input: 0.255, output: 1 } },
  { prefix: "minimax/minimax-m1", pricing: { input: 0.4, output: 2.2 } },
  { prefix: "minimax/minimax-01", pricing: { input: 0.2, output: 1.1 } },

  // Z.AI GLM（OpenRouter 路由价格，与 bigmodel.cn 直连不同）
  { prefix: "z-ai/glm-5.1", pricing: { input: 0.698, output: 4.4 } },
  { prefix: "z-ai/glm-5v-turbo", pricing: { input: 1.2, output: 4 } },
  { prefix: "z-ai/glm-5-turbo", pricing: { input: 1.2, output: 4 } },
  { prefix: "z-ai/glm-5", pricing: { input: 0.72, output: 2.3 } },
  { prefix: "z-ai/glm-4.7-flash", pricing: { input: 0.06, output: 0.4 } },
  { prefix: "z-ai/glm-4.7", pricing: { input: 0.38, output: 1.74 } },
  { prefix: "z-ai/glm-4.6v", pricing: { input: 0.3, output: 0.9 } },
  { prefix: "z-ai/glm-4.6", pricing: { input: 0.39, output: 1.9 } },
  { prefix: "z-ai/glm-4.5v", pricing: { input: 0.6, output: 1.8 } },
  { prefix: "z-ai/glm-4.5-air", pricing: { input: 0.13, output: 0.85 } },
  { prefix: "z-ai/glm-4.5", pricing: { input: 0.6, output: 2.2 } },
  { prefix: "z-ai/glm-4-32b", pricing: { input: 0.1, output: 0.1 } },

  // Baidu ERNIE
  { prefix: "baidu/ernie-4.5-vl-424b", pricing: { input: 0.42, output: 1.25 } },
  { prefix: "baidu/ernie-4.5-vl-28b", pricing: { input: 0.14, output: 0.56 } },
  { prefix: "baidu/ernie-4.5-300b", pricing: { input: 0.28, output: 1.1 } },
  { prefix: "baidu/ernie-4.5-21b", pricing: { input: 0.07, output: 0.28 } },

  // Tencent Hunyuan
  { prefix: "tencent/hunyuan-a13b", pricing: { input: 0.14, output: 0.57 } },

  // ByteDance Seed
  { prefix: "bytedance-seed/seed-2.0-lite", pricing: { input: 0.25, output: 2 } },
  { prefix: "bytedance-seed/seed-2.0-mini", pricing: { input: 0.1, output: 0.4 } },
  { prefix: "bytedance-seed/seed-1.6-flash", pricing: { input: 0.075, output: 0.3 } },
  { prefix: "bytedance-seed/seed-1.6", pricing: { input: 0.25, output: 2 } },
  { prefix: "bytedance/ui-tars", pricing: { input: 0.1, output: 0.2 } },

  // Alibaba Tongyi
  { prefix: "alibaba/tongyi-deepresearch", pricing: { input: 0.09, output: 0.45 } },

  // Allen AI OLMo
  { prefix: "allenai/olmo-3.1-32b", pricing: { input: 0.2, output: 0.6 } },
  { prefix: "allenai/olmo-3-32b", pricing: { input: 0.15, output: 0.5 } },

  // Arcee AI
  { prefix: "arcee-ai/trinity-large", pricing: { input: 0.22, output: 0.85 } },
  { prefix: "arcee-ai/trinity-mini", pricing: { input: 0.045, output: 0.15 } },
  { prefix: "arcee-ai/spotlight", pricing: { input: 0.18, output: 0.18 } },
  { prefix: "arcee-ai/maestro-reasoning", pricing: { input: 0.9, output: 3.3 } },
  { prefix: "arcee-ai/virtuoso-large", pricing: { input: 0.75, output: 1.2 } },
  { prefix: "arcee-ai/coder-large", pricing: { input: 0.5, output: 0.8 } },

  // NousResearch Hermes
  { prefix: "nousresearch/hermes-4-405b", pricing: { input: 1, output: 3 } },
  { prefix: "nousresearch/hermes-4-70b", pricing: { input: 0.13, output: 0.4 } },
  { prefix: "nousresearch/hermes-3-llama-3.1-405b", pricing: { input: 1, output: 1 } },
  { prefix: "nousresearch/hermes-3-llama-3.1-70b", pricing: { input: 0.3, output: 0.3 } },
  { prefix: "nousresearch/hermes-2-pro-llama-3-8b", pricing: { input: 0.14, output: 0.14 } },

  // Xiaomi MiMo
  { prefix: "xiaomi/mimo-v2-pro", pricing: { input: 1, output: 3 } },
  { prefix: "xiaomi/mimo-v2-omni", pricing: { input: 0.4, output: 2 } },
  { prefix: "xiaomi/mimo-v2-flash", pricing: { input: 0.09, output: 0.29 } },

  // Writer Palmyra
  { prefix: "writer/palmyra-x5", pricing: { input: 0.6, output: 6 } },

  // Upstage Solar
  { prefix: "upstage/solar-pro-3", pricing: { input: 0.15, output: 0.6 } },

  // IBM Granite
  { prefix: "ibm-granite/granite-4", pricing: { input: 0.017, output: 0.11 } },

  // Inception Mercury
  { prefix: "inception/mercury", pricing: { input: 0.25, output: 0.75 } },

  // StepFun
  { prefix: "stepfun/step-3.5-flash", pricing: { input: 0.1, output: 0.3 } },

  // Morph
  { prefix: "morph/morph-v3-large", pricing: { input: 0.9, output: 1.9 } },
  { prefix: "morph/morph-v3-fast", pricing: { input: 0.8, output: 1.2 } },

  // DeepCogito / EssentialAI / PrimeIntellect / TNG / Switchpoint
  { prefix: "deepcogito/cogito-v2.1-671b", pricing: { input: 1.25, output: 1.25 } },
  { prefix: "essentialai/rnj-1", pricing: { input: 0.15, output: 0.15 } },
  { prefix: "prime-intellect/intellect-3", pricing: { input: 0.2, output: 1.1 } },
  { prefix: "tngtech/deepseek-r1t2", pricing: { input: 0.3, output: 1.1 } },
  { prefix: "switchpoint/router", pricing: { input: 0.85, output: 3.4 } },

  // Aion Labs
  { prefix: "aion-labs/aion-1.0-mini", pricing: { input: 0.7, output: 1.4 } },
  { prefix: "aion-labs/aion-1.0", pricing: { input: 4, output: 8 } },
  { prefix: "aion-labs/aion-2.0", pricing: { input: 0.8, output: 1.6 } },
  { prefix: "aion-labs/aion-rp", pricing: { input: 0.8, output: 1.6 } },

  // Reka / Relace / KwaiPilot / Nex-AGI
  { prefix: "rekaai/reka-flash-3", pricing: { input: 0.1, output: 0.2 } },
  { prefix: "rekaai/reka-edge", pricing: { input: 0.1, output: 0.1 } },
  { prefix: "relace/relace-search", pricing: { input: 1, output: 3 } },
  { prefix: "relace/relace-apply-3", pricing: { input: 0.85, output: 1.25 } },
  { prefix: "kwaipilot/kat-coder-pro", pricing: { input: 0.3, output: 1.2 } },
  { prefix: "nex-agi/deepseek-v3.1-nex", pricing: { input: 0.135, output: 0.5 } },

  // Qwen on OpenRouter (扩展直连 alibabacloud 之外的子系列)
  { prefix: "qwen/qwen3.6-plus", pricing: { input: 0.325, output: 1.95 } },
  { prefix: "qwen/qwen3.5-397b", pricing: { input: 0.39, output: 2.34 } },
  { prefix: "qwen/qwen3.5-122b", pricing: { input: 0.26, output: 2.08 } },
  { prefix: "qwen/qwen3.5-35b", pricing: { input: 0.1625, output: 1.3 } },
  { prefix: "qwen/qwen3.5-27b", pricing: { input: 0.195, output: 1.56 } },
  { prefix: "qwen/qwen3.5-9b", pricing: { input: 0.1, output: 0.15 } },
  { prefix: "qwen/qwen3.5-flash", pricing: { input: 0.065, output: 0.26 } },
  { prefix: "qwen/qwen3.5-plus", pricing: { input: 0.26, output: 1.56 } },
  { prefix: "qwen/qwen3-vl-235b-a22b-thinking", pricing: { input: 0.26, output: 2.6 } },
  { prefix: "qwen/qwen3-vl-235b", pricing: { input: 0.2, output: 0.88 } },
  { prefix: "qwen/qwen3-vl-32b", pricing: { input: 0.104, output: 0.416 } },
  { prefix: "qwen/qwen3-vl-30b-a3b-thinking", pricing: { input: 0.13, output: 1.56 } },
  { prefix: "qwen/qwen3-vl-30b", pricing: { input: 0.13, output: 0.52 } },
  { prefix: "qwen/qwen3-vl-8b-thinking", pricing: { input: 0.117, output: 1.365 } },
  { prefix: "qwen/qwen3-vl-8b", pricing: { input: 0.08, output: 0.5 } },
  { prefix: "qwen/qwen3-coder-plus", pricing: { input: 0.65, output: 3.25 } },
  { prefix: "qwen/qwen3-coder-flash", pricing: { input: 0.195, output: 0.975 } },
  { prefix: "qwen/qwen3-coder-next", pricing: { input: 0.15, output: 0.8 } },
  { prefix: "qwen/qwen3-coder-30b", pricing: { input: 0.07, output: 0.27 } },
  { prefix: "qwen/qwen3-coder", pricing: { input: 0.22, output: 1 } },
  { prefix: "qwen/qwen3-next-80b", pricing: { input: 0.09, output: 1.1 } },
  { prefix: "qwen/qwen3-235b-a22b-thinking-2507", pricing: { input: 0.13, output: 0.6 } },
  { prefix: "qwen/qwen3-235b-a22b-2507", pricing: { input: 0.071, output: 0.1 } },
  { prefix: "qwen/qwen3-30b-a3b-thinking", pricing: { input: 0.08, output: 0.4 } },
  { prefix: "qwen/qwen3-30b", pricing: { input: 0.09, output: 0.3 } },
  { prefix: "qwen/qwen3-14b", pricing: { input: 0.06, output: 0.24 } },
  { prefix: "qwen/qwen3-8b", pricing: { input: 0.05, output: 0.4 } },
  { prefix: "qwen/qwen-plus-2025-07-28", pricing: { input: 0.26, output: 0.78 } },
  { prefix: "qwen/qwen-vl-plus", pricing: { input: 0.1365, output: 0.4095 } },
  { prefix: "qwen/qwen-vl-max", pricing: { input: 0.52, output: 2.08 } },
  { prefix: "qwen/qwen-turbo", pricing: { input: 0.0325, output: 0.13 } },
  { prefix: "qwen/qwen2.5-vl-72b", pricing: { input: 0.25, output: 0.75 } },
  { prefix: "qwen/qwen-plus", pricing: { input: 0.26, output: 0.78 } },
  { prefix: "qwen/qwen-max", pricing: { input: 1.04, output: 4.16 } },
  { prefix: "qwen/qwen-2.5-coder-32b", pricing: { input: 0.66, output: 1 } },
  { prefix: "qwen/qwen-2.5-72b", pricing: { input: 0.12, output: 0.39 } },
  { prefix: "qwen/qwen-2.5-7b", pricing: { input: 0.04, output: 0.1 } },

  // DeepSeek on OpenRouter（直连 deepseek-chat/reasoner 之外的镜像入口）
  // 来源：openrouter.ai/api/v1/models（2026-04-24）
  { prefix: "deepseek/deepseek-v4-pro", pricing: { input: 1.74, output: 3.48 } },
  { prefix: "deepseek/deepseek-v4-flash", pricing: { input: 0.14, output: 0.28 } },
  { prefix: "deepseek/deepseek-r1", pricing: { input: 0.55, output: 2.19 } },
  { prefix: "deepseek/deepseek-v3.2", pricing: { input: 0.28, output: 0.28 } },
  { prefix: "deepseek/deepseek-v3.1", pricing: { input: 0.27, output: 1.10 } },
  { prefix: "deepseek/deepseek-v3", pricing: { input: 0.28, output: 0.28 } },
  { prefix: "deepseek/deepseek-chat", pricing: { input: 0.14, output: 0.28 } },

  // Meta Llama on OpenRouter（直连 llama-3.3-70b 通用规则之外的旧版本）
  { prefix: "meta-llama/llama-3.3-70b", pricing: { input: 0.59, output: 0.79 } },
  { prefix: "meta-llama/llama-3.2-90b-vision", pricing: { input: 1.20, output: 1.20 } },
  { prefix: "meta-llama/llama-3.2-11b-vision", pricing: { input: 0.245, output: 0.245 } },
  { prefix: "meta-llama/llama-3.2-3b", pricing: { input: 0.051, output: 0.34 } },
  { prefix: "meta-llama/llama-3.2-1b", pricing: { input: 0.027, output: 0.2 } },
  { prefix: "meta-llama/llama-3.1-8b-instruct", pricing: { input: 0.02, output: 0.05 } },
  { prefix: "meta-llama/llama-3.1-70b-instruct", pricing: { input: 0.4, output: 0.4 } },
  { prefix: "meta-llama/llama-3-70b", pricing: { input: 0.51, output: 0.74 } },
  { prefix: "meta-llama/llama-3-8b", pricing: { input: 0.03, output: 0.04 } },
  { prefix: "meta-llama/llama-guard-4-12b", pricing: { input: 0.18, output: 0.18 } },

  // Community / RP fine-tunes（OpenRouter 上仍有用户使用）
  { prefix: "sao10k/l3.3-euryale-70b", pricing: { input: 0.65, output: 0.75 } },
  { prefix: "sao10k/l3.1-euryale-70b", pricing: { input: 0.85, output: 0.85 } },
  { prefix: "sao10k/l3.1-70b-hanami", pricing: { input: 3, output: 3 } },
  { prefix: "sao10k/l3-euryale-70b", pricing: { input: 1.48, output: 1.48 } },
  { prefix: "sao10k/l3-lunaris-8b", pricing: { input: 0.04, output: 0.05 } },
  { prefix: "thedrummer/cydonia-24b", pricing: { input: 0.3, output: 0.5 } },
  { prefix: "thedrummer/skyfall-36b", pricing: { input: 0.55, output: 0.8 } },
  { prefix: "thedrummer/unslopnemo-12b", pricing: { input: 0.4, output: 0.4 } },
  { prefix: "thedrummer/rocinante-12b", pricing: { input: 0.17, output: 0.43 } },
  { prefix: "anthracite-org/magnum-v4-72b", pricing: { input: 3, output: 5 } },
  { prefix: "alpindale/goliath-120b", pricing: { input: 3.75, output: 7.5 } },
  { prefix: "gryphe/mythomax-l2-13b", pricing: { input: 0.06, output: 0.06 } },
  { prefix: "mancer/weaver", pricing: { input: 0.75, output: 1 } },
  { prefix: "undi95/remm-slerp-l2-13b", pricing: { input: 0.45, output: 0.65 } },
  { prefix: "alfredpros/codellama-7b-instruct-solidity", pricing: { input: 0.8, output: 1.2 } },
];

function stripThinkingSuffix(model: string): string {
  if (model.endsWith("-thinking-visible")) return model.slice(0, -"-thinking-visible".length);
  if (model.endsWith("-thinking")) return model.slice(0, -"-thinking".length);
  return model;
}

export function lookupPricing(model: string): ModelPricing | null {
  const normalized = stripThinkingSuffix(model);

  if (EXACT_PRICING[normalized]) return EXACT_PRICING[normalized];
  if (EXACT_PRICING[model]) return EXACT_PRICING[model];

  for (const { prefix, pricing } of PREFIX_PRICING) {
    if (normalized.startsWith(prefix) || model.startsWith(prefix) || normalized.includes(prefix) || model.includes(prefix)) return pricing;
  }

  // OpenRouter "owner/model" 兜底：剥离首段 owner namespace 后再次查找。
  // 适用于 openai/gpt-5、deepseek/deepseek-r1、x-ai/grok-4 等 OR 镜像模型，
  // 它们对应的厂商价表项以 EXACT 形式存放（无通用 gpt-5/grok-4 prefix 规则可命中）。
  const slash = normalized.indexOf("/");
  if (slash > 0) {
    const tail = normalized.slice(slash + 1);
    if (tail && tail !== normalized) {
      if (EXACT_PRICING[tail]) return EXACT_PRICING[tail];
      for (const { prefix, pricing } of PREFIX_PRICING) {
        if (tail.startsWith(prefix) || tail.includes(prefix)) return pricing;
      }
    }
  }

  return null;
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number | null {
  const pricing = lookupPricing(model);
  if (!pricing) return null;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

export function formatCost(usd: number | null): string {
  if (usd === null) return "—";
  if (usd === 0) return "$0.00";
  if (usd < 0.000001) return "< $0.000001";
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}
