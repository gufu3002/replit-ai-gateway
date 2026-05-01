export const ANTHROPIC_MAX_TOKENS: Record<string, number> = {
  "claude-opus-4-7": 32000,
  "claude-opus-4-6": 32000,
  "claude-opus-4-5": 32000,
  "claude-opus-4-1": 32000,
  "claude-sonnet-4-6": 64000,
  "claude-sonnet-4-5": 64000,
  "claude-haiku-4-5": 16000,
};

export const ANTHROPIC_THINKING_BUDGET: Record<string, number> = {
  "claude-opus-4-7": 25000,
  "claude-opus-4-6": 25000,
  "claude-opus-4-5": 25000,
  "claude-opus-4-1": 25000,
  "claude-sonnet-4-6": 50000,
  "claude-sonnet-4-5": 50000,
  "claude-haiku-4-5": 12000,
};

export const GEMINI_MAX_TOKENS: Record<string, number> = {
  "gemini-3.1-pro-preview": 32768,
  "gemini-3-pro-preview": 32768,
  "gemini-3-flash-preview": 32768,
  "gemini-3-pro-image-preview": 32768,
  "gemini-2.5-pro": 65536,
  "gemini-2.5-flash": 65536,
  "gemini-2.5-flash-image": 32768,
};

export const GEMINI_THINKING_BUDGET: Record<string, number> = {
  "gemini-3.1-pro-preview": 16000,
  "gemini-3-pro-preview": 16000,
  "gemini-2.5-pro": 32000,
  "gemini-2.5-flash": 16000,
};

export const DEFAULT_MAX_TOKENS = 16000;

export function resolveMaxTokens(
  limits: Record<string, number>,
  baseModel: string,
  requestedMax?: number,
): number {
  const modelMax = limits[baseModel] ?? DEFAULT_MAX_TOKENS;
  if (requestedMax && requestedMax > 0) return Math.min(requestedMax, modelMax);
  return modelMax;
}
