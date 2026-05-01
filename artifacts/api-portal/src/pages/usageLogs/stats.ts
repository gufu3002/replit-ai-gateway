import { estimateCost } from "../../data/pricing";
import { PROVIDER_HEX_COLORS } from "../../data/models";
import type { DisguiseStat, PerfGroupBy, PerfRow, TimeBucket, UsageEntry } from "./types";

export { PROVIDER_HEX_COLORS as PROVIDER_COLORS };

export function exportToCsv(logs: UsageEntry[]) {
  const headers = [
    "timestamp", "model", "provider", "endpoint", "stream", "status",
    "statusCode", "durationMs", "firstTokenMs", "inputTokens", "outputTokens", "estimatedCostUSD", "disguisePreset",
  ];
  const rows = logs.map((e) => {
    const cost = estimateCost(e.model, e.inputTokens, e.outputTokens);
    return [
      e.timestamp,
      e.model,
      e.provider,
      e.endpoint,
      e.stream ? "true" : "false",
      e.status,
      e.statusCode,
      e.durationMs,
      e.firstTokenMs ?? "",
      e.inputTokens,
      e.outputTokens,
      cost !== null ? cost.toFixed(8) : "",
      e.disguisePreset ?? "",
    ];
  });
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `usage-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function computeDisguiseStats(logs: UsageEntry[]): DisguiseStat[] {
  const map = new Map<string, DisguiseStat>();
  for (const e of logs) {
    const key = e.disguisePreset || "none";
    if (!map.has(key)) map.set(key, { preset: key, total: 0, success: 0, error: 0 });
    const stat = map.get(key)!;
    stat.total++;
    if (e.status === "success") stat.success++;
    else stat.error++;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function buildTimeBuckets(logs: UsageEntry[], bucketCount = 30): TimeBucket[] {
  const now = Date.now();
  const bucketMs = 60 * 1000;
  const windowMs = bucketCount * bucketMs;
  const startMs = now - windowMs;
  const buckets: TimeBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    labelMs: startMs + i * bucketMs,
    total: 0,
    success: 0,
    inputTokens: 0,
    outputTokens: 0,
  }));
  for (const log of logs) {
    const t = new Date(log.timestamp).getTime();
    if (t < startMs || t > now) continue;
    const idx = Math.min(Math.floor((t - startMs) / bucketMs), bucketCount - 1);
    if (idx < 0 || idx >= bucketCount) continue;
    buckets[idx].total++;
    if (log.status === "success") buckets[idx].success++;
    buckets[idx].inputTokens += log.inputTokens;
    buckets[idx].outputTokens += log.outputTokens;
  }
  return buckets;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export function computePerfStats(logs: UsageEntry[], groupBy: PerfGroupBy): PerfRow[] {
  const map = new Map<string, UsageEntry[]>();
  for (const e of logs) {
    const key = groupBy === "provider" ? e.provider : e.model;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  const rows: PerfRow[] = [];
  for (const [key, entries] of map) {
    const allDurations = entries.map((e) => e.durationMs).sort((a, b) => a - b);
    const successEntries = entries.filter((e) => e.status === "success");
    const ttfts = entries.map((e) => e.firstTokenMs).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const tpsSamples = successEntries
      .filter((e) => e.outputTokens > 0 && e.durationMs > 0)
      .map((e) => (e.outputTokens / e.durationMs) * 1000);
    const totalOut = entries.reduce((s, e) => s + e.outputTokens, 0);
    const totalIn = entries.reduce((s, e) => s + e.inputTokens, 0);
    let totalCost: number | null = null;
    for (const e of entries) {
      const c = estimateCost(e.model, e.inputTokens, e.outputTokens);
      if (c !== null) totalCost = (totalCost ?? 0) + c;
    }
    rows.push({
      key,
      count: entries.length,
      successCount: successEntries.length,
      p50: percentile(allDurations, 50),
      p95: percentile(allDurations, 95),
      p99: percentile(allDurations, 99),
      avgTtft: ttfts.length > 0 ? ttfts.reduce((a, b) => a + b, 0) / ttfts.length : null,
      p50Ttft: ttfts.length > 0 ? percentile(ttfts, 50) : null,
      p95Ttft: ttfts.length > 0 ? percentile(ttfts, 95) : null,
      avgTps: tpsSamples.length > 0 ? tpsSamples.reduce((a, b) => a + b, 0) / tpsSamples.length : null,
      totalTokens: totalIn + totalOut,
      totalCost,
    });
  }
  return rows.sort((a, b) => b.count - a.count);
}

export function estimateLoadedCost(logs: UsageEntry[]) {
  return logs.reduce(
    (acc, e) => {
      const cost = estimateCost(e.model, e.inputTokens, e.outputTokens);
      if (cost === null) return acc;
      return { totalCost: acc.totalCost + cost, coveredCount: acc.coveredCount + 1 };
    },
    { totalCost: 0, coveredCount: 0 },
  );
}

export function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
