import type { Request, Response } from "express";
import { logger } from "../lib/logger";

export function sseChunk(
  id: string,
  created: number,
  model: string,
  delta: Record<string, unknown>,
  finishReason: string | null = null,
): string {
  return `data: ${JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;
}

export function setupSseHeaders(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

export function startKeepalive(
  res: Response,
  req: Request,
): ReturnType<typeof setInterval> {
  const interval = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(interval);
      return;
    }
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(interval);
      logger.warn("Keepalive write failed for SSE client");
    }
  }, 5000);
  req.on("close", () => clearInterval(interval));
  return interval;
}

export function extractUpstreamStatus(err: unknown): number | null {
  if (
    err instanceof Error &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    return (err as { status: number }).status;
  }
  return null;
}
