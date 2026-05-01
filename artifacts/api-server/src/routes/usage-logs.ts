import { Router, type Request, type Response } from "express";
import { adminAuth } from "../lib/auth";
import { pushLog } from "./logs";

const router = Router();

const MAX_REQUEST_BODY_BYTES = 50 * 1024;

export interface UsageLogEntry {
  id: string;
  timestamp: string;
  model: string;
  provider: string;
  endpoint: string;
  stream: boolean;
  status: "success" | "error";
  statusCode: number;
  durationMs: number;
  firstTokenMs: number | null;
  inputTokens: number;
  outputTokens: number;
  requestBodyBytes: number;   // byte size of the raw JSON request body
  errorMessage?: string;
  disguisePreset?: string;
  requestBody?: Record<string, unknown>;
}

const MAX_USAGE_LOGS = 500;

// ---------------------------------------------------------------------------
// Server start time — recorded once at module load (i.e. process startup).
// ---------------------------------------------------------------------------
export const SERVER_START_MS: number = Date.now();

// ---------------------------------------------------------------------------
// Unbounded session accumulator — never evicts, covers ALL requests this run.
// Kept as simple counters so it stays O(1) per write regardless of volume.
// ---------------------------------------------------------------------------
export interface SessionStats {
  requests: number;
  successCount: number;
  errorCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalDurationMs: number;
  totalFirstTokenMs: number;
  firstTokenCount: number;
  totalRequestBodyBytes: number;
}

const sessionAcc: SessionStats = {
  requests: 0, successCount: 0, errorCount: 0,
  inputTokens: 0, outputTokens: 0, totalTokens: 0,
  totalDurationMs: 0, totalFirstTokenMs: 0, firstTokenCount: 0,
  totalRequestBodyBytes: 0,
};

export function getSessionStats(): Readonly<SessionStats> {
  return sessionAcc;
}

// ---------------------------------------------------------------------------
// Ring buffer — O(1) writes.
// ---------------------------------------------------------------------------
const usageRing = new Array<UsageLogEntry | undefined>(MAX_USAGE_LOGS);
let usageHead = 0;
let usageCount = 0;
let usageVersion = 0;

// O(1) lookup by id (entry is removed from map when evicted from the ring).
const usageIdMap = new Map<string, UsageLogEntry>();

export function sanitizeRequestBody(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== "object") return undefined;
  try {
    const json = JSON.stringify(body);
    if (Buffer.byteLength(json, "utf8") > MAX_REQUEST_BODY_BYTES) return undefined;
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function pushUsageLog(entry: UsageLogEntry): void {
  // Update unbounded session accumulator first.
  sessionAcc.requests++;
  sessionAcc.inputTokens  += entry.inputTokens;
  sessionAcc.outputTokens += entry.outputTokens;
  sessionAcc.totalTokens  += entry.inputTokens + entry.outputTokens;
  sessionAcc.totalDurationMs += entry.durationMs ?? 0;
  sessionAcc.totalRequestBodyBytes += entry.requestBodyBytes;
  if (entry.status === "success") sessionAcc.successCount++;
  else                            sessionAcc.errorCount++;
  if (entry.firstTokenMs != null) {
    sessionAcc.totalFirstTokenMs += entry.firstTokenMs;
    sessionAcc.firstTokenCount++;
  }

  // Write to ring buffer (evicts oldest when full).
  if (usageCount < MAX_USAGE_LOGS) {
    usageRing[(usageHead + usageCount) % MAX_USAGE_LOGS] = entry;
    usageCount++;
  } else {
    const evicted = usageRing[usageHead];
    if (evicted) usageIdMap.delete(evicted.id);
    usageRing[usageHead] = entry;
    usageHead = (usageHead + 1) % MAX_USAGE_LOGS;
  }
  usageIdMap.set(entry.id, entry);
  usageVersion++;

  // Mirror a compact line to the real-time log buffer so users can search
  // by request ID across the 实时日志 tab.
  const statusStr = entry.status === "success" ? `${entry.statusCode}` : `${entry.statusCode} ERR`;
  pushLog(
    entry.status === "success" ? "info" : "error",
    `[${entry.id}] ${entry.model} ${entry.provider} ${statusStr} ${entry.durationMs}ms`,
    { id: entry.id, model: entry.model, provider: entry.provider, endpoint: entry.endpoint, statusCode: entry.statusCode, durationMs: entry.durationMs },
  );
}

export function getUsageLogVersion(): number {
  return usageVersion;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/api/usage-logs/:id", adminAuth, (req: Request, res: Response) => {
  const entry = usageIdMap.get(String(req.params["id"]));
  if (!entry) { res.status(404).json({ error: { message: "Log entry not found" } }); return; }
  res.json(entry);
});

router.get("/api/usage-logs", adminAuth, (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, MAX_USAGE_LOGS);
  const model    = req.query.model    as string | undefined;
  const provider = req.query.provider as string | undefined;
  const status   = req.query.status   as string | undefined;
  const lModel   = model ? model.toLowerCase() : undefined;

  const filtered: UsageLogEntry[] = [];
  const stats = { totalRequests: 0, successCount: 0, errorCount: 0, totalTokens: 0 };

  // Single reverse-order pass: accumulate global stats from every entry,
  // push matching entries into filtered until the limit is reached.
  // Avoids array copy, chained filter(), reverse(), and a separate reduce().
  for (let i = usageCount - 1; i >= 0; i--) {
    const e = usageRing[(usageHead + i) % MAX_USAGE_LOGS];
    if (!e) continue;
    stats.totalRequests++;
    stats.totalTokens += e.inputTokens + e.outputTokens;
    if (e.status === "success") stats.successCount++;
    else stats.errorCount++;

    if (filtered.length < limit) {
      if (lModel   && !e.model.toLowerCase().includes(lModel)) continue;
      if (provider && e.provider !== provider)                  continue;
      if (status   && e.status   !== status)                    continue;
      filtered.push(e);
    }
  }

  res.json({ logs: filtered, total: usageCount, stats });
});

router.post("/api/usage-logs/clear", adminAuth, (_req: Request, res: Response) => {
  usageHead = 0;
  usageCount = 0;
  usageRing.fill(undefined);
  usageIdMap.clear();
  usageVersion++;
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Read-only accessor for other modules (e.g. billing route)
// ---------------------------------------------------------------------------
export function readAllUsageLogs(): UsageLogEntry[] {
  const result: UsageLogEntry[] = [];
  for (let i = 0; i < usageCount; i++) {
    const e = usageRing[(usageHead + i) % MAX_USAGE_LOGS];
    if (e) result.push(e);
  }
  return result;
}

export default router;
