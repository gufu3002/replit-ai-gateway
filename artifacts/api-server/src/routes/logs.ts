import { Router, type IRouter, type Request, type Response } from "express";
import { adminAuth } from "../lib/auth";

const router: IRouter = Router();

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  meta?: Record<string, unknown>;
}

const MAX_BUFFER_SIZE = 1000;

// ---------------------------------------------------------------------------
// Ring buffer — O(1) writes, no array shifting.
// Slots are pre-allocated; head/count track the valid window.
// ---------------------------------------------------------------------------
const ring = new Array<LogEntry>(MAX_BUFFER_SIZE);
let head = 0;   // index of the oldest entry in ring[]
let count = 0;  // number of valid entries (0..MAX_BUFFER_SIZE)

// totalWritten is a monotonically increasing counter that never resets,
// even after buffer clears. Clients use it as sinceIndex for incremental polls.
let totalWritten = 0;

export function pushLog(level: LogEntry["level"], message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta,
  };
  if (count < MAX_BUFFER_SIZE) {
    ring[(head + count) % MAX_BUFFER_SIZE] = entry;
    count++;
  } else {
    // Buffer full: overwrite the oldest slot and advance head.
    ring[head] = entry;
    head = (head + 1) % MAX_BUFFER_SIZE;
  }
  totalWritten++;
}

// Return entries ring[fromPos..count-1] in insertion order.
function getEntriesFrom(fromPos: number): LogEntry[] {
  const result: LogEntry[] = [];
  for (let i = fromPos; i < count; i++) {
    result.push(ring[(head + i) % MAX_BUFFER_SIZE]);
  }
  return result;
}

router.get("/api/logs", adminAuth, (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 200, MAX_BUFFER_SIZE);
  const sinceIndex = parseInt(req.query.sinceIndex as string, 10);

  if (!isNaN(sinceIndex)) {
    if (sinceIndex >= totalWritten) {
      res.json({ logs: [], total: totalWritten });
      return;
    }
    const bufferStart = totalWritten - count;
    const fromPos = Math.max(0, sinceIndex - bufferStart);
    res.json({ logs: getEntriesFrom(fromPos), total: totalWritten });
    return;
  }

  // Initial load: return the most recent `limit` entries.
  const fromPos = Math.max(0, count - limit);
  res.json({ logs: getEntriesFrom(fromPos), total: totalWritten });
});

router.post("/api/logs/clear", adminAuth, (_req: Request, res: Response) => {
  head = 0;
  count = 0;
  // totalWritten intentionally NOT reset — keeps client sinceIndex valid.
  res.json({ success: true, total: totalWritten });
});

export default router;
