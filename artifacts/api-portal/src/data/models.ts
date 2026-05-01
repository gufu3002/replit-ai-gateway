export type Provider = "openai" | "anthropic" | "gemini" | "deepseek" | "xai" | "mistral" | "moonshot" | "groq" | "together" | "siliconflow" | "cerebras" | "fireworks" | "novita" | "hyperbolic" | "openrouter";

export interface ModelEntry {
  id: string;
  label: string;
  provider: Provider;
  desc: string;
  badge?: "thinking" | "thinking-visible" | "tools" | "reasoning";
  context?: string;
  isBase?: boolean;
}

export type TabId = "overview" | "models" | "settings" | "reference" | "logs" | "usage" | "billing" | "docs";

export const LOCAL_VERSION = "0.1.76";
export const LOCAL_BUILD_TIME = "2026-05-01";

export const OPENAI_MODELS: ModelEntry[] = [
  { id: "gpt-5.5", label: "GPT-5.5", provider: "openai", desc: "OpenAI 最新最强旗舰模型（2026-04-24 API 开放）", context: "1M", badge: "tools", isBase: true },
  { id: "gpt-5.5-pro", label: "GPT-5.5 Pro", provider: "openai", desc: "GPT-5.5 专业版，深度推理增强", context: "1M", badge: "tools", isBase: true },
  { id: "gpt-5.4", label: "GPT-5.4", provider: "openai", desc: "最新旗舰多模态模型，通用任务首选", context: "400K", badge: "tools", isBase: true },
  { id: "gpt-5.2", label: "GPT-5.2", provider: "openai", desc: "通用旗舰多模态模型", context: "400K", badge: "tools", isBase: true },
  { id: "gpt-5.1", label: "GPT-5.1", provider: "openai", desc: "旗舰多模态模型", context: "400K", badge: "tools", isBase: true },
  { id: "gpt-5", label: "GPT-5", provider: "openai", desc: "旗舰多模态模型", context: "400K", badge: "tools", isBase: true },
  { id: "gpt-5-mini", label: "GPT-5 Mini", provider: "openai", desc: "高性价比快速模型", context: "400K", badge: "tools", isBase: true },
  { id: "gpt-5-nano", label: "GPT-5 Nano", provider: "openai", desc: "超轻量边缘模型", context: "400K", badge: "tools", isBase: true },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "openai", desc: "稳定通用旗舰模型", context: "1M", badge: "tools", isBase: true },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "openai", desc: "均衡速度与质量", context: "1M", badge: "tools", isBase: true },
  { id: "gpt-4.1-nano", label: "GPT-4.1 Nano", provider: "openai", desc: "超高速轻量模型", context: "1M", badge: "tools", isBase: true },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", desc: "多模态旗舰（图文音）", context: "128K", badge: "tools", isBase: true },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", desc: "轻量多模态模型", context: "128K", badge: "tools", isBase: true },
  { id: "gpt-5.3-codex", label: "GPT-5.3 Codex", provider: "openai", desc: "旗舰代码生成模型 (Responses API)", context: "400K", badge: "tools", isBase: true },
  { id: "gpt-5.2-codex", label: "GPT-5.2 Codex", provider: "openai", desc: "代码生成模型 (Responses API)", context: "400K", badge: "tools", isBase: true },
  { id: "gpt-image-1", label: "GPT Image 1", provider: "openai", desc: "AI 图像生成模型", badge: "tools", isBase: true },
  { id: "gpt-audio", label: "GPT Audio", provider: "openai", desc: "语音对话模型", badge: "tools", isBase: true },
  { id: "gpt-audio-mini", label: "GPT Audio Mini", provider: "openai", desc: "轻量语音对话模型", badge: "tools", isBase: true },
  { id: "gpt-4o-mini-transcribe", label: "GPT-4o Mini Transcribe", provider: "openai", desc: "语音转文字模型", context: "128K", badge: "tools", isBase: true },
  { id: "o4-mini", label: "o4 Mini", provider: "openai", desc: "推理模型，快速高效", context: "200K", badge: "reasoning", isBase: true },
  { id: "o4-mini-thinking", label: "o4 Mini (thinking alias)", provider: "openai", desc: "o4 Mini 思考别名", context: "200K", badge: "thinking" },
  { id: "o3", label: "o3", provider: "openai", desc: "强推理旗舰模型", context: "200K", badge: "reasoning", isBase: true },
  { id: "o3-thinking", label: "o3 (thinking alias)", provider: "openai", desc: "o3 思考别名", context: "200K", badge: "thinking" },
  { id: "o3-mini", label: "o3 Mini", provider: "openai", desc: "高效推理模型", context: "200K", badge: "reasoning", isBase: true },
  { id: "o3-mini-thinking", label: "o3 Mini (thinking alias)", provider: "openai", desc: "o3 Mini 思考别名", context: "200K", badge: "thinking" },
];

export const ANTHROPIC_MODELS: ModelEntry[] = [
  // claude-opus-4-7 不支持 extended thinking（官方文档明确：Extended thinking = No）
  // 但支持 adaptive thinking（模型自主决定是否推理）
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", provider: "anthropic", desc: "最新旗舰推理与智能体任务（自适应思考）", context: "1M", badge: "tools", isBase: true },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic", desc: "顶级推理与智能体任务", context: "1M", badge: "tools", isBase: true },
  { id: "claude-opus-4-6-thinking", label: "Claude Opus 4.6", provider: "anthropic", desc: "扩展思考（隐藏）", context: "1M", badge: "thinking" },
  { id: "claude-opus-4-6-thinking-visible", label: "Claude Opus 4.6", provider: "anthropic", desc: "扩展思考（可见）", context: "1M", badge: "thinking-visible" },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5", provider: "anthropic", desc: "旗舰推理模型", context: "200K", badge: "tools", isBase: true },
  { id: "claude-opus-4-5-thinking", label: "Claude Opus 4.5", provider: "anthropic", desc: "扩展思考（隐藏）", context: "200K", badge: "thinking" },
  { id: "claude-opus-4-5-thinking-visible", label: "Claude Opus 4.5", provider: "anthropic", desc: "扩展思考（可见）", context: "200K", badge: "thinking-visible" },
  { id: "claude-opus-4-1", label: "Claude Opus 4.1", provider: "anthropic", desc: "旗舰模型（稳定版）", context: "200K", badge: "tools", isBase: true },
  { id: "claude-opus-4-1-thinking", label: "Claude Opus 4.1", provider: "anthropic", desc: "扩展思考（隐藏）", context: "200K", badge: "thinking" },
  { id: "claude-opus-4-1-thinking-visible", label: "Claude Opus 4.1", provider: "anthropic", desc: "扩展思考（可见）", context: "200K", badge: "thinking-visible" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", desc: "速度与智能最佳平衡", context: "1M", badge: "tools", isBase: true },
  { id: "claude-sonnet-4-6-thinking", label: "Claude Sonnet 4.6", provider: "anthropic", desc: "扩展思考（隐藏）", context: "1M", badge: "thinking" },
  { id: "claude-sonnet-4-6-thinking-visible", label: "Claude Sonnet 4.6", provider: "anthropic", desc: "扩展思考（可见）", context: "1M", badge: "thinking-visible" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "anthropic", desc: "均衡性价比旗舰", context: "200K", badge: "tools", isBase: true },
  { id: "claude-sonnet-4-5-thinking", label: "Claude Sonnet 4.5", provider: "anthropic", desc: "扩展思考（隐藏）", context: "200K", badge: "thinking" },
  { id: "claude-sonnet-4-5-thinking-visible", label: "Claude Sonnet 4.5", provider: "anthropic", desc: "扩展思考（可见）", context: "200K", badge: "thinking-visible" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic", desc: "超快速轻量模型", context: "200K", badge: "tools", isBase: true },
  { id: "claude-haiku-4-5-thinking", label: "Claude Haiku 4.5", provider: "anthropic", desc: "扩展思考（隐藏）", context: "200K", badge: "thinking" },
  { id: "claude-haiku-4-5-thinking-visible", label: "Claude Haiku 4.5", provider: "anthropic", desc: "扩展思考（可见）", context: "200K", badge: "thinking-visible" },
];

export const GEMINI_MODELS: ModelEntry[] = [
  // Gemini 3 系列（2026 年当前 Preview 模型，官方 ai.google.dev/gemini-api/docs/models 确认）
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", provider: "gemini", desc: "最新旗舰多模态模型（高级推理与 Vibe Coding）", context: "1M", badge: "tools", isBase: true },
  { id: "gemini-3.1-pro-preview-thinking", label: "Gemini 3.1 Pro Preview", provider: "gemini", desc: "扩展思考（隐藏）", context: "1M", badge: "thinking" },
  { id: "gemini-3.1-pro-preview-thinking-visible", label: "Gemini 3.1 Pro Preview", provider: "gemini", desc: "扩展思考（可见）", context: "1M", badge: "thinking-visible" },
  // 注：gemini-3-pro-preview 不是真实模型 ID，已于 2026-04-20 从列表移除
  // 注：gemini-3.1-flash-lite-preview / gemini-3.1-flash-image-preview 不在 Replit AI Integrations 支持清单内，已于 2026-04-22 移除
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", provider: "gemini", desc: "前沿级智能+搜索增强高速模型", context: "1M", badge: "tools", isBase: true },
  { id: "gemini-3-pro-image-preview", label: "Gemini 3 Pro Image Preview", provider: "gemini", desc: "原生图像生成（Nano Banana Pro）", context: "64K", badge: "tools", isBase: true },
  // Gemini 2.5 系列（稳定可用）
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", desc: "推理旗舰，强代码能力", context: "1M", badge: "tools", isBase: true },
  { id: "gemini-2.5-pro-thinking", label: "Gemini 2.5 Pro", provider: "gemini", desc: "扩展思考（隐藏）", context: "1M", badge: "thinking" },
  { id: "gemini-2.5-pro-thinking-visible", label: "Gemini 2.5 Pro", provider: "gemini", desc: "扩展思考（可见）", context: "1M", badge: "thinking-visible" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", desc: "混合推理，1M 上下文，thinking budgets", context: "1M", badge: "tools", isBase: true },
  { id: "gemini-2.5-flash-thinking", label: "Gemini 2.5 Flash", provider: "gemini", desc: "扩展思考（隐藏）", context: "1M", badge: "thinking" },
  { id: "gemini-2.5-flash-thinking-visible", label: "Gemini 2.5 Flash", provider: "gemini", desc: "扩展思考（可见）", context: "1M", badge: "thinking-visible" },
  // 注：gemini-2.5-flash-lite 不在 Replit AI Integrations 支持清单内，已于 2026-04-22 移除
  { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", provider: "gemini", desc: "超快速图像生成模型（Nano Banana）", context: "64K", badge: "tools", isBase: true },
];

export const DEEPSEEK_MODELS: ModelEntry[] = [
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", provider: "deepseek", desc: "DeepSeek 官方旗舰模型，支持 Think / Think Max 推理模式", context: "1M", badge: "reasoning", isBase: true },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", provider: "deepseek", desc: "DeepSeek 官方高速模型，支持 Think / Think Max 推理模式", context: "1M", badge: "tools", isBase: true },
  { id: "deepseek-chat", label: "DeepSeek V3 (Chat)", provider: "deepseek", desc: "已废弃（2026-07-24），现映射至 V4 Flash", context: "64K", badge: "tools", isBase: true },
  { id: "deepseek-reasoner", label: "DeepSeek R1 (Reasoner)", provider: "deepseek", desc: "已废弃（2026-07-24），现映射至 V4 Flash", context: "64K", badge: "reasoning", isBase: true },
];

export const XAI_MODELS: ModelEntry[] = [
  { id: "grok-4.3", label: "Grok 4.3", provider: "xai", desc: "xAI 最新旗舰模型，长上下文 + 多模态视频理解", context: "256K", badge: "reasoning", isBase: true },
  { id: "grok-4", label: "Grok 4", provider: "xai", desc: "xAI 旗舰推理模型（grok-4-0709，仅推理模式，无非推理路径）", context: "256K", badge: "reasoning", isBase: true },
  { id: "grok-4-fast", label: "Grok 4 Fast", provider: "xai", desc: "xAI 快速旗舰模型（grok-4.1-fast，推理/非推理均支持）", context: "2M", badge: "reasoning", isBase: true },
  { id: "grok-3", label: "Grok 3", provider: "xai", desc: "xAI 稳定通用模型", context: "131K", badge: "tools", isBase: true },
  { id: "grok-3-fast", label: "Grok 3 Fast", provider: "xai", desc: "xAI 低延迟模型", context: "131K", badge: "tools", isBase: true },
  { id: "grok-3-mini", label: "Grok 3 Mini", provider: "xai", desc: "xAI 轻量推理模型", context: "131K", badge: "reasoning", isBase: true },
  { id: "grok-3-mini-fast", label: "Grok 3 Mini Fast", provider: "xai", desc: "xAI 快速轻量推理模型", context: "131K", badge: "reasoning", isBase: true },
  { id: "grok-2-1212", label: "Grok 2 1212", provider: "xai", desc: "xAI 稳定旧版模型", context: "131K", badge: "tools", isBase: true },
  { id: "grok-2", label: "Grok 2", provider: "xai", desc: "xAI 通用旧版模型", context: "131K", badge: "tools", isBase: true },
  { id: "grok-beta", label: "Grok Beta", provider: "xai", desc: "xAI Beta 模型", context: "131K", badge: "tools", isBase: true },
];

export const MISTRAL_MODELS: ModelEntry[] = [
  { id: "mistral-large-latest", label: "Mistral Large", provider: "mistral", desc: "Mistral 官方旗舰模型", context: "256K", badge: "tools", isBase: true },
  { id: "mistral-medium-latest", label: "Mistral Medium", provider: "mistral", desc: "Mistral 官方均衡模型（当前指向 Medium 3.5）", context: "256K", badge: "tools", isBase: true },
  { id: "mistral-medium-3.5", label: "Mistral Medium 3.5", provider: "mistral", desc: "Mistral Medium 3.5（128B dense，2026-04-29 发布）", context: "256K", badge: "tools", isBase: true },
  { id: "mistral-small-latest", label: "Mistral Small", provider: "mistral", desc: "Mistral 官方高性价比模型", context: "262K", badge: "tools", isBase: true },
  { id: "mistral-saba-latest", label: "Mistral Saba", provider: "mistral", desc: "Mistral 多语言区域优化模型", context: "32K", badge: "tools", isBase: true },
  { id: "codestral-latest", label: "Codestral", provider: "mistral", desc: "Mistral 代码模型", context: "256K", badge: "tools", isBase: true },
  { id: "devstral-medium", label: "Devstral Medium", provider: "mistral", desc: "Mistral 软件工程模型", context: "128K", badge: "tools", isBase: true },
  { id: "devstral-small", label: "Devstral Small", provider: "mistral", desc: "Mistral 轻量软件工程模型", context: "128K", badge: "tools", isBase: true },
  { id: "mistral-nemo", label: "Mistral Nemo", provider: "mistral", desc: "Mistral 开源高效模型", context: "128K", badge: "tools", isBase: true },
  { id: "pixtral-large-latest", label: "Pixtral Large", provider: "mistral", desc: "Mistral 多模态模型", context: "128K", badge: "tools", isBase: true },
  { id: "mixtral-8x22b-instruct-v0.1", label: "Mixtral 8x22B", provider: "mistral", desc: "Mistral MoE 开源模型", context: "64K", badge: "tools", isBase: true },
  { id: "mixtral-8x7b-instruct-v0.1", label: "Mixtral 8x7B", provider: "mistral", desc: "Mistral MoE 经典模型", context: "32K", badge: "tools", isBase: true },
  { id: "mistral-7b-instruct-v0.3", label: "Mistral 7B Instruct", provider: "mistral", desc: "Mistral 7B 开源模型", context: "32K", badge: "tools", isBase: true },
  { id: "voxtral-small-latest", label: "Voxtral Small", provider: "mistral", desc: "Mistral 语音理解模型", context: "32K", badge: "tools", isBase: true },
  { id: "ministral-8b-latest", label: "Ministral 8B", provider: "mistral", desc: "Mistral 边缘轻量模型", context: "128K", badge: "tools", isBase: true },
  { id: "ministral-3b-latest", label: "Ministral 3B", provider: "mistral", desc: "Mistral 超轻量模型", context: "128K", badge: "tools", isBase: true },
];

export const MOONSHOT_MODELS: ModelEntry[] = [
  { id: "moonshot-v1-8k", label: "Moonshot v1 8K", provider: "moonshot", desc: "Moonshot 官方 8K 模型", context: "8K", badge: "tools", isBase: true },
  { id: "moonshot-v1-32k", label: "Moonshot v1 32K", provider: "moonshot", desc: "Moonshot 官方 32K 模型", context: "32K", badge: "tools", isBase: true },
  { id: "moonshot-v1-128k", label: "Moonshot v1 128K", provider: "moonshot", desc: "Moonshot 官方长上下文模型", context: "128K", badge: "tools", isBase: true },
  { id: "moonshot-v1-auto", label: "Moonshot v1 Auto", provider: "moonshot", desc: "Moonshot 自动路由模型", context: "128K", badge: "tools", isBase: true },
  { id: "kimi-k2-0528", label: "Kimi K2 0528", provider: "moonshot", desc: "Kimi K2 通用模型", context: "128K", badge: "tools", isBase: true },
  { id: "kimi-thinking-preview", label: "Kimi Thinking Preview", provider: "moonshot", desc: "Kimi 推理预览模型", context: "128K", badge: "reasoning", isBase: true },
];

export const GROQ_MODELS: ModelEntry[] = [
  // 当前 Groq 官方定价页模型（2026-04-20 实时确认）
  { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", provider: "groq", desc: "Groq LPU 推理芯片旗舰通道", context: "128K", badge: "tools", isBase: true },
  { id: "groq/llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", provider: "groq", desc: "Groq LPU 低延迟轻量模型", context: "128K", badge: "tools", isBase: true },
  { id: "groq/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout", provider: "groq", desc: "Groq Llama 4 轻量 MoE 模型", context: "128K", badge: "tools", isBase: true },
  { id: "groq/qwen/qwen3-32b", label: "Qwen3 32B", provider: "groq", desc: "Groq Qwen3 推理模型", context: "131K", badge: "tools", isBase: true },
  { id: "groq/openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: "groq", desc: "Groq OpenAI 开源 20B 模型", context: "128K", badge: "tools", isBase: true },
  { id: "groq/openai/gpt-oss-120b", label: "GPT-OSS 120B", provider: "groq", desc: "Groq OpenAI 开源 120B MoE 模型", context: "131K", badge: "tools", isBase: true },
  // Legacy 模型（仍可访问）
  { id: "groq/llama-3.1-70b-versatile", label: "Llama 3.1 70B Versatile", provider: "groq", desc: "Groq LPU 高速开源模型（旧版）", context: "128K", badge: "tools", isBase: true },
  { id: "groq/llama-3.2-90b-vision-preview", label: "Llama 3.2 90B Vision", provider: "groq", desc: "Groq 多模态预览模型", context: "128K", badge: "tools", isBase: true },
  { id: "groq/llama-3.2-11b-vision-preview", label: "Llama 3.2 11B Vision", provider: "groq", desc: "Groq 轻量多模态预览模型", context: "128K", badge: "tools", isBase: true },
  { id: "groq/llama-3.2-3b-preview", label: "Llama 3.2 3B Preview", provider: "groq", desc: "Groq 小参数开源模型", context: "128K", badge: "tools", isBase: true },
  { id: "groq/llama-3.2-1b-preview", label: "Llama 3.2 1B Preview", provider: "groq", desc: "Groq 超轻量开源模型", context: "128K", badge: "tools", isBase: true },
  { id: "groq/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick", provider: "groq", desc: "Groq Llama 4 MoE 旗舰模型", context: "128K", badge: "tools", isBase: true },
  { id: "groq/gemma2-9b-it", label: "Gemma 2 9B", provider: "groq", desc: "Groq Gemma 开源模型", context: "8K", badge: "tools", isBase: true },
  { id: "groq/gemma-7b-it", label: "Gemma 7B", provider: "groq", desc: "Groq Gemma 经典模型", context: "8K", badge: "tools", isBase: true },
  { id: "groq/mixtral-8x7b-32768", label: "Mixtral 8x7B", provider: "groq", desc: "Groq Mixtral MoE 模型", context: "32K", badge: "tools", isBase: true },
  { id: "groq/deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill Llama 70B", provider: "groq", desc: "Groq 推理模型", context: "128K", badge: "reasoning", isBase: true },
  { id: "groq/qwen-qwq-32b", label: "Qwen QwQ 32B", provider: "groq", desc: "Groq Qwen QwQ 推理模型（旧版）", context: "128K", badge: "reasoning", isBase: true },
];

export const TOGETHER_MODELS: ModelEntry[] = [
  { id: "together/meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo", provider: "together", desc: "Together 开源模型通道", context: "128K", badge: "tools", isBase: true },
  { id: "together/meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", label: "Llama 3.3 70B Turbo Free", provider: "together", desc: "Together 免费开源模型通道", context: "128K", badge: "tools", isBase: true },
  { id: "together/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", label: "Llama 3.1 8B Turbo", provider: "together", desc: "Together 低延迟开源模型", context: "128K", badge: "tools", isBase: true },
  { id: "together/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", label: "Llama 3.1 70B Turbo", provider: "together", desc: "Together 高质量开源模型", context: "128K", badge: "tools", isBase: true },
  { id: "together/meta-llama/Llama-3.1-405B-Instruct-Turbo", label: "Llama 3.1 405B Turbo", provider: "together", desc: "Together 超大规模旗舰模型", context: "128K", badge: "tools", isBase: true },
  { id: "together/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", label: "Llama 4 Maverick FP8", provider: "together", desc: "Together Llama 4 MoE 模型", context: "128K", badge: "tools", isBase: true },
  { id: "together/meta-llama/Llama-4-Scout-17B-16E-Instruct", label: "Llama 4 Scout", provider: "together", desc: "Together Llama 4 轻量 MoE 模型", context: "128K", badge: "tools", isBase: true },
  { id: "together/Qwen/Qwen2.5-72B-Instruct-Turbo", label: "Qwen 2.5 72B Turbo", provider: "together", desc: "Together Qwen 开源模型", context: "128K", badge: "tools", isBase: true },
  { id: "together/Qwen/Qwen2.5-Coder-32B-Instruct", label: "Qwen 2.5 Coder 32B", provider: "together", desc: "Together 代码模型", context: "128K", badge: "tools", isBase: true },
  { id: "together/Qwen/QwQ-32B", label: "QwQ 32B", provider: "together", desc: "Together Qwen 推理模型", context: "128K", badge: "reasoning", isBase: true },
  { id: "together/deepseek-ai/DeepSeek-V3", label: "DeepSeek V3", provider: "together", desc: "Together DeepSeek 开源模型", context: "128K", badge: "tools", isBase: true },
  { id: "together/deepseek-ai/DeepSeek-R1", label: "DeepSeek R1", provider: "together", desc: "Together DeepSeek 推理模型", context: "128K", badge: "reasoning", isBase: true },
  { id: "together/deepseek-ai/DeepSeek-R1-Distill-Llama-70B", label: "DeepSeek R1 Distill Llama 70B", provider: "together", desc: "Together 蒸馏推理模型", context: "128K", badge: "reasoning", isBase: true },
  { id: "together/mistralai/Mixtral-8x7B-Instruct-v0.1", label: "Mixtral 8x7B", provider: "together", desc: "Together Mistral 开源模型", context: "32K", badge: "tools", isBase: true },
  { id: "together/mistralai/Mixtral-8x22B-Instruct-v0.1", label: "Mixtral 8x22B", provider: "together", desc: "Together Mistral 大 MoE 模型", context: "64K", badge: "tools", isBase: true },
  { id: "together/google/gemma-2-27b-it", label: "Gemma 2 27B", provider: "together", desc: "Together Google Gemma 模型", context: "8K", badge: "tools", isBase: true },
  { id: "together/google/gemma-2-9b-it", label: "Gemma 2 9B", provider: "together", desc: "Together Google Gemma 轻量模型", context: "8K", badge: "tools", isBase: true },
  { id: "together/microsoft/WizardLM-2-8x22B", label: "WizardLM 2 8x22B", provider: "together", desc: "Together Microsoft 开源模型", context: "64K", badge: "tools", isBase: true },
  { id: "together/NovaSky-Berkeley/Sky-T1-32B-Preview", label: "Sky T1 32B Preview", provider: "together", desc: "Together 开源推理预览模型", context: "32K", badge: "reasoning", isBase: true },
];

export const SILICONFLOW_MODELS: ModelEntry[] = [
  { id: "siliconflow/Qwen/Qwen2.5-72B-Instruct", label: "Qwen 2.5 72B", provider: "siliconflow", desc: "SiliconFlow 开源模型云通道", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/Qwen/Qwen2.5-32B-Instruct", label: "Qwen 2.5 32B", provider: "siliconflow", desc: "SiliconFlow Qwen 开源模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/Qwen/Qwen2.5-14B-Instruct", label: "Qwen 2.5 14B", provider: "siliconflow", desc: "SiliconFlow Qwen 中型模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/Qwen/Qwen2.5-7B-Instruct", label: "Qwen 2.5 7B", provider: "siliconflow", desc: "SiliconFlow Qwen 轻量模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/Qwen/Qwen3-235B-A22B", label: "Qwen3 235B A22B", provider: "siliconflow", desc: "SiliconFlow Qwen3 大模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/Qwen/Qwen3-30B-A3B", label: "Qwen3 30B A3B", provider: "siliconflow", desc: "SiliconFlow Qwen3 MoE 模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/Qwen/Qwen3-14B", label: "Qwen3 14B", provider: "siliconflow", desc: "SiliconFlow Qwen3 中型模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/Qwen/Qwen3-8B", label: "Qwen3 8B", provider: "siliconflow", desc: "SiliconFlow Qwen3 轻量模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/Qwen/QwQ-32B", label: "QwQ 32B", provider: "siliconflow", desc: "SiliconFlow Qwen 推理模型", context: "128K", badge: "reasoning", isBase: true },
  { id: "siliconflow/Qwen/Qwen2.5-Coder-32B-Instruct", label: "Qwen 2.5 Coder 32B", provider: "siliconflow", desc: "SiliconFlow 代码模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/deepseek-ai/DeepSeek-V3", label: "DeepSeek V3", provider: "siliconflow", desc: "SiliconFlow DeepSeek 通用模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/deepseek-ai/DeepSeek-R1", label: "DeepSeek R1", provider: "siliconflow", desc: "SiliconFlow DeepSeek 推理模型", context: "128K", badge: "reasoning", isBase: true },
  { id: "siliconflow/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", label: "DeepSeek R1 Distill Qwen 32B", provider: "siliconflow", desc: "SiliconFlow 蒸馏推理模型", context: "128K", badge: "reasoning", isBase: true },
  { id: "siliconflow/deepseek-ai/DeepSeek-R1-Distill-Llama-70B", label: "DeepSeek R1 Distill Llama 70B", provider: "siliconflow", desc: "SiliconFlow 蒸馏推理模型", context: "128K", badge: "reasoning", isBase: true },
  { id: "siliconflow/meta-llama/Meta-Llama-3.1-405B-Instruct", label: "Llama 3.1 405B", provider: "siliconflow", desc: "SiliconFlow Meta 开源大模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/meta-llama/Meta-Llama-3.1-70B-Instruct", label: "Llama 3.1 70B", provider: "siliconflow", desc: "SiliconFlow Meta 开源模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/meta-llama/Meta-Llama-3.1-8B-Instruct", label: "Llama 3.1 8B", provider: "siliconflow", desc: "SiliconFlow Meta 轻量开源模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/mistralai/Mistral-7B-Instruct-v0.2", label: "Mistral 7B", provider: "siliconflow", desc: "SiliconFlow Mistral 开源模型", context: "32K", badge: "tools", isBase: true },
  { id: "siliconflow/THUDM/glm-4-9b-chat", label: "GLM 4 9B Chat", provider: "siliconflow", desc: "SiliconFlow GLM 开源模型", context: "128K", badge: "tools", isBase: true },
  { id: "siliconflow/internlm/internlm2_5-20b-chat", label: "InternLM 2.5 20B", provider: "siliconflow", desc: "SiliconFlow InternLM 开源模型", context: "128K", badge: "tools", isBase: true },
];

// 注：qwen-3-32b 和 llama-4-scout-17b-16e 已于 2026-02-16 在 Cerebras 弃用
export const CEREBRAS_MODELS: ModelEntry[] = [
  { id: "cerebras/llama3.1-8b", label: "Llama 3.1 8B", provider: "cerebras", desc: "Cerebras LPU 超快速轻量推理", context: "8K", badge: "tools", isBase: true },
  { id: "cerebras/llama3.3-70b", label: "Llama 3.3 70B", provider: "cerebras", desc: "Cerebras LPU 超快速旗舰推理", context: "128K", badge: "tools", isBase: true },
];

export const FIREWORKS_MODELS: ModelEntry[] = [
  { id: "fireworks/accounts/fireworks/models/llama4-maverick-instruct-basic", label: "Llama 4 Maverick", provider: "fireworks", desc: "Fireworks Llama 4 Maverick 旗舰推理", context: "1M", badge: "tools", isBase: true },
  { id: "fireworks/accounts/fireworks/models/llama4-scout-instruct-basic", label: "Llama 4 Scout", provider: "fireworks", desc: "Fireworks Llama 4 Scout 轻量推理", context: "128K", badge: "tools", isBase: true },
  { id: "fireworks/accounts/fireworks/models/qwen3-235b-a22b", label: "Qwen 3 235B A22B", provider: "fireworks", desc: "Fireworks Qwen3 超大 MoE 推理", context: "128K", badge: "tools", isBase: true },
  { id: "fireworks/accounts/fireworks/models/qwen3-30b-a3b", label: "Qwen 3 30B A3B", provider: "fireworks", desc: "Fireworks Qwen3 高效 MoE 推理", context: "128K", badge: "tools", isBase: true },
  { id: "fireworks/accounts/fireworks/models/deepseek-r1", label: "DeepSeek R1", provider: "fireworks", desc: "Fireworks DeepSeek R1 推理模型", context: "164K", badge: "tools", isBase: true },
  { id: "fireworks/accounts/fireworks/models/deepseek-v3", label: "DeepSeek V3", provider: "fireworks", desc: "Fireworks DeepSeek V3 对话模型", context: "164K", badge: "tools", isBase: true },
  { id: "fireworks/accounts/fireworks/models/deepseek-v3-0324", label: "DeepSeek V3-0324", provider: "fireworks", desc: "Fireworks DeepSeek V3 0324 更新版", context: "164K", badge: "tools", isBase: true },
];

export const NOVITA_MODELS: ModelEntry[] = [
  { id: "novita/deepseek/deepseek-v3-turbo", label: "DeepSeek V3 Turbo", provider: "novita", desc: "Novita DeepSeek V3 Turbo 高速对话", context: "64K", badge: "tools", isBase: true },
  { id: "novita/deepseek/deepseek-r1-turbo", label: "DeepSeek R1 Turbo", provider: "novita", desc: "Novita DeepSeek R1 Turbo 高速推理", context: "64K", badge: "tools", isBase: true },
  { id: "novita/deepseek/deepseek-v3-0324", label: "DeepSeek V3-0324", provider: "novita", desc: "Novita DeepSeek V3 0324 更新版", context: "64K", badge: "tools", isBase: true },
  { id: "novita/meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick", provider: "novita", desc: "Novita Llama 4 Maverick 多专家推理", context: "524K", badge: "tools", isBase: true },
  { id: "novita/qwen/qwen3-235b-a22b", label: "Qwen 3 235B A22B", provider: "novita", desc: "Novita Qwen3 超大 MoE 推理", context: "128K", badge: "tools", isBase: true },
  { id: "novita/meta-llama/llama-3.1-405b-instruct", label: "Llama 3.1 405B", provider: "novita", desc: "Novita Llama 3.1 超大旗舰推理", context: "128K", badge: "tools", isBase: true },
];

export const HYPERBOLIC_MODELS: ModelEntry[] = [
  { id: "hyperbolic/deepseek-ai/DeepSeek-V3-0324", label: "DeepSeek V3-0324", provider: "hyperbolic", desc: "Hyperbolic DeepSeek V3 0324 更新版", context: "64K", badge: "tools", isBase: true },
  { id: "hyperbolic/deepseek-ai/DeepSeek-R1-Zero", label: "DeepSeek R1 Zero", provider: "hyperbolic", desc: "Hyperbolic DeepSeek R1 Zero 推理模型", context: "164K", badge: "tools", isBase: true },
  { id: "hyperbolic/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", label: "Llama 4 Maverick FP8", provider: "hyperbolic", desc: "Hyperbolic Llama 4 Maverick FP8 推理", context: "524K", badge: "tools", isBase: true },
  { id: "hyperbolic/Qwen/Qwen3-235B-A22B", label: "Qwen 3 235B A22B", provider: "hyperbolic", desc: "Hyperbolic Qwen3 超大 MoE 推理", context: "128K", badge: "tools", isBase: true },
  { id: "hyperbolic/Qwen/Qwen2.5-72B-Instruct", label: "Qwen 2.5 72B", provider: "hyperbolic", desc: "Hyperbolic Qwen2.5 旗舰推理", context: "131K", badge: "tools", isBase: true },
  { id: "hyperbolic/NovaSky-Berkeley/Sky-T1-32B-Preview", label: "Sky-T1 32B", provider: "hyperbolic", desc: "Hyperbolic Berkeley Sky-T1 推理模型", context: "32K", badge: "tools", isBase: true },
];

// OpenRouter models are fully driven by the backend live sync from
  // https://openrouter.ai/api/v1/models (see proxy-models.ts on the API server).
  // The frontend pulls them at runtime via GET /api/models — see
  // useLiveOpenRouterModels.ts. This local fallback is intentionally empty.
  export const OPENROUTER_MODELS: ModelEntry[] = [];

export const PROVIDER_COLORS: Record<Provider, { bg: string; border: string; dot: string; text: string; label: string }> = {
  openai: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", dot: "#60a5fa", text: "#93c5fd", label: "OpenAI" },
  anthropic: { bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.25)", dot: "#fb923c", text: "#fdba74", label: "Anthropic" },
  gemini: { bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.25)", dot: "#34d399", text: "#6ee7b7", label: "Google" },
  deepseek: { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)", dot: "#fbbf24", text: "#fcd34d", label: "DeepSeek" },
  xai: { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)", dot: "#94a3b8", text: "#cbd5e1", label: "xAI" },
  mistral: { bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.22)", dot: "#f472b6", text: "#f9a8d4", label: "Mistral" },
  moonshot: { bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.22)", dot: "#818cf8", text: "#a5b4fc", label: "Moonshot" },
  groq: { bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.22)", dot: "#f87171", text: "#fca5a5", label: "Groq" },
  together: { bg: "rgba(45,212,191,0.08)", border: "rgba(45,212,191,0.22)", dot: "#2dd4bf", text: "#5eead4", label: "Together" },
  siliconflow: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.22)", dot: "#22c55e", text: "#86efac", label: "SiliconFlow" },
  cerebras: { bg: "rgba(234,88,12,0.08)", border: "rgba(234,88,12,0.22)", dot: "#ea580c", text: "#fb923c", label: "Cerebras" },
  fireworks: { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.22)", dot: "#f97316", text: "#fdba74", label: "Fireworks" },
  novita: { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.22)", dot: "#8b5cf6", text: "#c4b5fd", label: "Novita" },
  hyperbolic: { bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.22)", dot: "#06b6d4", text: "#67e8f9", label: "Hyperbolic" },
  openrouter: { bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)", dot: "#a78bfa", text: "#c4b5fd", label: "OpenRouter" },
};

export const PROVIDER_HEX_COLORS: Record<string, string> = {
  openai: "#10b981",
  anthropic: "#f59e0b",
  gemini: "#6366f1",
  deepseek: "#38bdf8",
  xai: "#94a3b8",
  mistral: "#f472b6",
  moonshot: "#818cf8",
  groq: "#f87171",
  together: "#2dd4bf",
  siliconflow: "#22c55e",
  cerebras: "#ea580c",
  fireworks: "#f97316",
  novita: "#8b5cf6",
  hyperbolic: "#06b6d4",
  openrouter: "#ec4899",
};

export const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google",
  openrouter: "OpenRouter",
  xai: "xAI",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  moonshot: "Moonshot",
  groq: "Groq",
  cerebras: "Cerebras",
  together: "Together",
  siliconflow: "SiliconFlow",
  fireworks: "Fireworks",
  novita: "Novita",
  hyperbolic: "Hyperbolic",
};

export const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "概览" },
  { id: "models", label: "模型列表" },
  { id: "settings", label: "系统设置" },
  { id: "logs", label: "实时日志" },
  { id: "usage", label: "使用日志" },
  { id: "billing", label: "费用统计" },
  { id: "reference", label: "技术参考" },
  { id: "docs", label: "项目文档" },
];

export const ALL_MODELS = [...OPENAI_MODELS, ...ANTHROPIC_MODELS, ...GEMINI_MODELS, ...DEEPSEEK_MODELS, ...XAI_MODELS, ...MISTRAL_MODELS, ...MOONSHOT_MODELS, ...GROQ_MODELS, ...TOGETHER_MODELS, ...SILICONFLOW_MODELS, ...CEREBRAS_MODELS, ...FIREWORKS_MODELS, ...NOVITA_MODELS, ...HYPERBOLIC_MODELS, ...OPENROUTER_MODELS];
export const TOTAL_MODELS = ALL_MODELS.length;
