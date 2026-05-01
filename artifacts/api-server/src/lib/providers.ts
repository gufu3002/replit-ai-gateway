import type { Response } from "express";

export type ProviderType =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "deepseek"
  | "xai"
  | "mistral"
  | "moonshot"
  | "groq"
  | "together"
  | "siliconflow"
  | "cerebras"
  | "fireworks"
  | "novita"
  | "hyperbolic";

export function detectProvider(model: string): ProviderType | null {
  // ── Exact-prefix models (no slash) ──────────────────────────────────────
  if (model.startsWith("gpt-") || /^o\d/.test(model)) return "openai";
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gemini-")) return "gemini";
  if (model.startsWith("deepseek-") && !model.includes("/")) return "deepseek";
  if (model.startsWith("grok-") && !model.includes("/")) return "xai";
  if (
    /^(mistral|mixtral|codestral|devstral|voxtral|ministral)-/i.test(model) &&
    !model.includes("/")
  ) return "mistral";
  if (/^(moonshot-|kimi-)/.test(model) && !model.includes("/")) return "moonshot";

  // ── Platform-namespaced models (org/model) ────────────────────────────
  // Must be checked before the generic openrouter catch-all.
  if (model.startsWith("groq/")) return "groq";
  if (model.startsWith("together/")) return "together";
  if (model.startsWith("siliconflow/")) return "siliconflow";
  if (model.startsWith("cerebras/")) return "cerebras";
  if (model.startsWith("fireworks/")) return "fireworks";
  if (model.startsWith("novita/")) return "novita";
  if (model.startsWith("hyperbolic/")) return "hyperbolic";

  // ── OpenRouter catch-all for all remaining org/model slugs ────────────
  if (model.includes("/")) return "openrouter";

  return null;
}

export interface ModelThinkingInfo {
  baseModel: string;
  thinking: boolean;
  thinkingVisible: boolean;
}

export function parseThinkingSuffix(model: string): ModelThinkingInfo {
  if (model.endsWith("-thinking-visible")) {
    return { baseModel: model.slice(0, -"-thinking-visible".length), thinking: true, thinkingVisible: true };
  }
  if (model.endsWith("-thinking")) {
    return { baseModel: model.slice(0, -"-thinking".length), thinking: true, thinkingVisible: false };
  }
  return { baseModel: model, thinking: false, thinkingVisible: false };
}

export function flushRes(res: Response): void {
  if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
    (res as unknown as { flush: () => void }).flush();
  }
}
