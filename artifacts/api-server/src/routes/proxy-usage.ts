import { getActiveDisguise } from "../lib/disguise";
import {
  pushUsageLog,
  sanitizeRequestBody,
  type UsageLogEntry,
} from "./usage-logs";

export type LogUsage = (opts: {
  status: UsageLogEntry["status"];
  statusCode: number;
  inputTokens?: number;
  outputTokens?: number;
  errorMessage?: string;
}) => void;

export interface UsageTracker {
  start: number;
  trackFirstToken: () => void;
  logUsage: LogUsage;
}

export function createUsageTracker(
  model: string,
  provider: string,
  endpoint: string,
  stream: boolean,
  requestBody?: unknown,
  rawBodyBytes?: number,
): UsageTracker {
  const start = Date.now();
  let firstTokenMs: number | null = null;
  const disguisePreset = getActiveDisguise();
  const storedBody = sanitizeRequestBody(requestBody);
  // Prefer the raw body byte length (accurate); fall back to JSON.stringify length.
  const bodyBytes =
    rawBodyBytes ??
    (requestBody !== undefined && requestBody !== null
      ? (() => {
          try {
            return Buffer.byteLength(JSON.stringify(requestBody), "utf8");
          } catch {
            return 0;
          }
        })()
      : 0);
  return {
    start,
    trackFirstToken: () => {
      if (firstTokenMs === null) firstTokenMs = Date.now() - start;
    },
    logUsage: (opts) => {
      pushUsageLog({
        id: `req-${start}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date(start).toISOString(),
        model,
        provider,
        endpoint,
        stream,
        status: opts.status,
        statusCode: opts.statusCode,
        durationMs: Date.now() - start,
        firstTokenMs,
        inputTokens: opts.inputTokens ?? 0,
        outputTokens: opts.outputTokens ?? 0,
        requestBodyBytes: bodyBytes,
        errorMessage: opts.errorMessage,
        disguisePreset,
        requestBody: storedBody,
      });
    },
  };
}
