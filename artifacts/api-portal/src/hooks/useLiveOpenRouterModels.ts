import { useQuery } from "@tanstack/react-query";
import type { ModelEntry } from "../data/models";

interface ApiModelsResponse {
  data?: Array<{ id: string; owned_by?: string; context_length?: number }>;
}

/**
 * Format a token count as a compact human-readable string.
 * Examples: 200000 -> "200K", 1048576 -> "1M", 128000 -> "128K", 4096 -> "4K"
 */
function formatContextLength(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return "";
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const k = tokens / 1_000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `${tokens}`;
}

const EMPTY_MODELS: ModelEntry[] = [];

async function fetchOpenRouterModels(baseUrl: string): Promise<ModelEntry[]> {
  const r = await fetch(`${baseUrl}/api/models`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = (await r.json()) as ApiModelsResponse;
  return (json.data ?? [])
    .filter((m) => m.owned_by === "openrouter")
    .map((m) => {
      const ctx = typeof m.context_length === "number" ? formatContextLength(m.context_length) : "";
      return {
        id: m.id,
        label: m.id.split("/").slice(1).join("/") || m.id,
        provider: "openrouter" as const,
        desc: m.id,
        ...(ctx ? { context: ctx } : {}),
      };
    });
}

export function useLiveOpenRouterModels(baseUrl: string): {
  models: ModelEntry[];
  loading: boolean;
  error: string | null;
} {
  const query = useQuery({
    queryKey: ["openrouter-models", baseUrl],
    queryFn: () => fetchOpenRouterModels(baseUrl),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  return {
    models: query.data ?? EMPTY_MODELS,
    loading: query.isLoading,
    error: query.error ? (query.error instanceof Error ? query.error.message : String(query.error)) : null,
  };
}
