import type { Response } from "express";
import type { IncomingHttpHeaders } from "http";
import { getConfig } from "../config";
import {
  applyDisguiseToFetch,
  isDisguiseActive,
  type DisguisePreset,
} from "../lib/disguise";
import { logger } from "../lib/logger";
import { flushRes, type ProviderType } from "../lib/providers";
import type { ChatCompletionRequestBody, ChatMessage } from "./proxy-format";
import type { LogUsage } from "./proxy-usage";

// ---------------------------------------------------------------------------
// Vendor-specific defaults
// ---------------------------------------------------------------------------

const ANTHROPIC_DEFAULT_BASE = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const GEMINI_DEFAULT_BASE = "https://generativelanguage.googleapis.com";

function stripOSeriesThinkingAlias(model: string): string {
  if (model.endsWith("-thinking-visible"))
    return model.slice(0, -"-thinking-visible".length);
  if (model.endsWith("-thinking")) return model.slice(0, -"-thinking".length);
  return model;
}

function normalizeProviderModel(provider: ProviderType, model: string): string {
  if (provider === "groq" && model.startsWith("groq/"))
    return model.slice("groq/".length);
  if (provider === "together" && model.startsWith("together/"))
    return model.slice("together/".length);
  if (provider === "siliconflow" && model.startsWith("siliconflow/"))
    return model.slice("siliconflow/".length);
  if (provider === "cerebras" && model.startsWith("cerebras/"))
    return model.slice("cerebras/".length);
  if (provider === "fireworks" && model.startsWith("fireworks/"))
    return model.slice("fireworks/".length);
  if (provider === "novita" && model.startsWith("novita/"))
    return model.slice("novita/".length);
  if (provider === "hyperbolic" && model.startsWith("hyperbolic/"))
    return model.slice("hyperbolic/".length);
  return model;
}

function buildPassthroughBody(
  body: ChatCompletionRequestBody,
  model: string,
  messages: ChatMessage[],
  stream: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body, model, stream, messages };
  delete out.contents;
  delete out.systemInstruction;
  delete out.generationConfig;
  return out;
}

// ---------------------------------------------------------------------------
// Raw passthrough helpers — get provider base URL / API key from config or env
// ---------------------------------------------------------------------------

const RESPONSE_HEADERS_NOT_FORWARDED = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const REQUEST_HEADERS_NOT_FORWARDED = new Set([
  "host",
  "connection",
  "content-length",
  "content-encoding",
  "accept-encoding",
  "authorization",
  "x-api-key",
  "x-goog-api-key",
  "anthropic-version",
  "cookie",
  "set-cookie",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "via",
  "x-gateway-debug-headers",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cdn-loop",
]);

interface UsageCounts {
  inputTokens?: number;
  outputTokens?: number;
}

type PassthroughBody = unknown;

interface UsageParserState {
  buffer: string;
  inputTokens: number;
  outputTokens: number;
}

function toFetchBody(body: PassthroughBody): Buffer | Uint8Array | string {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return body;
  if (typeof body === "string") return body;
  return JSON.stringify(body ?? {});
}

function buildUpstreamHeaders(
  requiredHeaders: Record<string, string>,
  incomingHeaders?: IncomingHttpHeaders,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(incomingHeaders ?? {})) {
    const lowerKey = key.toLowerCase();
    if (REQUEST_HEADERS_NOT_FORWARDED.has(lowerKey)) continue;
    if (value === undefined) continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  headers["Accept-Encoding"] = "identity";
  if (
    !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
  ) {
    headers["Content-Type"] = "application/json";
  }
  for (const [key, value] of Object.entries(requiredHeaders)) {
    headers[key] = value;
  }
  return headers;
}

function toHeaderRecord(
  headers: RequestInit["headers"],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) out[key] = value;
  } else {
    Object.assign(out, headers);
  }
  return out;
}

function deleteHeader(
  headers: Record<string, string>,
  headerName: string,
): void {
  const lowerName = headerName.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lowerName) delete headers[key];
  }
}

// Auth-related and content-type headers are always restored from the gateway's
// own values after disguise injection, then excluded from the secondary strip pass.
const DISGUISE_PRESERVE_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "x-goog-api-key",
  "anthropic-version",
  "content-type",
]);

function applyPassthroughDisguise(
  init: RequestInit,
  provider?: ProviderType,
  overridePreset?: DisguisePreset,
  requestPath?: string,
  incomingUserAgent?: string,
): RequestInit {
  const originalHeaders = toHeaderRecord(init.headers);
  const disguised = applyDisguiseToFetch(
    init,
    overridePreset,
    provider,
    requestPath,
    incomingUserAgent,
  );
  const headers = toHeaderRecord(disguised.headers);

  // Step 1: restore gateway-controlled headers that disguise profiles must not override.
  // deleteHeader is case-insensitive, which prevents duplicate keys from merging.
  for (const [key, value] of Object.entries(originalHeaders)) {
    if (DISGUISE_PRESERVE_HEADERS.has(key.toLowerCase())) {
      deleteHeader(headers, key);
      headers[key] = value;
    }
  }

  // Step 2: strip any hop-by-hop / proxy-chain headers the disguise profile may
  // have left behind (e.g. "connection: keep-alive" is in all SDK profiles for
  // documentation accuracy, but must not be forwarded to HTTP/2 upstreams and is
  // not a meaningful signal — Node.js undici manages the connection itself).
  // Auth headers are excluded because they were just restored in step 1.
  for (const headerName of REQUEST_HEADERS_NOT_FORWARDED) {
    if (!DISGUISE_PRESERVE_HEADERS.has(headerName)) {
      deleteHeader(headers, headerName);
    }
  }

  // Step 3: profiles declare "accept-encoding: gzip, deflate, br" to match the
  // real SDK fingerprint, but the gateway always forces identity so Express's
  // already-decoded body is forwarded without re-encoding surprises.
  deleteHeader(headers, "accept-encoding");
  headers["Accept-Encoding"] = "identity";

  return { ...disguised, headers };
}

// HTTP status codes that may indicate the disguise headers caused the upstream
// to reject the request. Only these codes trigger an automatic no-disguise retry.
const DISGUISE_RETRY_STATUSES = new Set([400, 403, 407, 422]);

// Default upstream request timeout in milliseconds (10 minutes).
// Long enough for extended reasoning / large completions, short enough to
// release hung connections before they exhaust server resources.
const UPSTREAM_TIMEOUT_MS = 10 * 60 * 1000;

function sanitizeUrlForLog(url: string): string {
  return url.replace(
    /([?&](?:key|api_key|access_token|token)=)[^&]+/gi,
    "$1***",
  );
}

function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/**
 * Executes a fetch request with the active disguise applied.
 * If the response status is in DISGUISE_RETRY_STATUSES and disguise is active,
 * the request is automatically retried once without any disguise headers.
 * The `baseInit` must NOT have disguise already applied — it is the plain init
 * that `applyPassthroughDisguise` will be called on internally.
 * All requests are subject to UPSTREAM_TIMEOUT_MS to prevent hung connections.
 */
async function fetchWithDisguiseFallback(
  url: string,
  baseInit: RequestInit,
  provider?: ProviderType,
  requestPathOverride?: string,
  incomingUserAgent?: string,
): Promise<{
  response: globalThis.Response;
  usedFallback: boolean;
  upstreamRequestHeaders: Record<string, string>;
}> {
  let urlPath: string | undefined;
  try {
    urlPath = new URL(url).pathname;
  } catch {
    /* ignore malformed URLs */
  }
  const requestPath = requestPathOverride ?? urlPath;

  const disguisedInit = applyPassthroughDisguise(
    baseInit,
    provider,
    undefined,
    requestPath,
    incomingUserAgent,
  );
  const upstreamRequestHeaders = toHeaderRecord(disguisedInit.headers);
  const response = await fetchWithTimeout(url, disguisedInit);

  if (
    !response.ok &&
    isDisguiseActive() &&
    DISGUISE_RETRY_STATUSES.has(response.status)
  ) {
    // Drain the failed response body to free the underlying socket before retry.
    try {
      if (response.body) await response.body.cancel();
    } catch {
      /* ignore */
    }

    logger.warn(
      { status: response.status, provider, url: sanitizeUrlForLog(url) },
      "[disguise-fallback] Request failed while disguise is active; retrying without disguise",
    );

    const plainInit = applyPassthroughDisguise(
      baseInit,
      provider,
      "none",
      requestPath,
      incomingUserAgent,
    );
    const retryHeaders = toHeaderRecord(plainInit.headers);
    return {
      response: await fetchWithTimeout(url, plainInit),
      usedFallback: true,
      upstreamRequestHeaders: retryHeaders,
    };
  }

  return { response, usedFallback: false, upstreamRequestHeaders };
}

// ---------------------------------------------------------------------------
// Upstream response size guard for non-streaming paths
// ---------------------------------------------------------------------------
// 100 MB cap: generous enough for any real AI completion response (the largest
// non-streaming JSON payload is typically <<10 MB even for long documents), yet
// low enough to protect against a misbehaving upstream sending GB-scale bodies.
const MAX_UPSTREAM_RESPONSE_BYTES = 100 * 1024 * 1024;

export async function readResponseBufferCapped(upstream: globalThis.Response): Promise<ArrayBuffer> {
  const contentLengthHeader = upstream.headers.get("content-length");
  if (contentLengthHeader) {
    const cl = parseInt(contentLengthHeader, 10);
    if (Number.isFinite(cl) && cl > MAX_UPSTREAM_RESPONSE_BYTES) {
      // Drain and discard so the socket is released.
      try { await upstream.body?.cancel(); } catch { /* ignore */ }
      throw Object.assign(new Error(`Upstream response too large (Content-Length: ${cl} bytes, max: ${MAX_UPSTREAM_RESPONSE_BYTES})`), { status: 502 });
    }
  }
  if (!upstream.body) return upstream.arrayBuffer();

  // Stream-read with byte counter to catch responses that omit Content-Length.
  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_UPSTREAM_RESPONSE_BYTES) {
        try { await reader.cancel(); } catch { /* ignore */ }
        throw Object.assign(new Error(`Upstream response too large (>${MAX_UPSTREAM_RESPONSE_BYTES} bytes)`), { status: 502 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return combined.buffer;
}

/** Convenience wrapper: reads the capped buffer and decodes to UTF-8 string. */
export async function readResponseTextCapped(upstream: globalThis.Response): Promise<string> {
  return new TextDecoder().decode(await readResponseBufferCapped(upstream));
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function pickFirstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const n = numberValue(value);
    if (n !== undefined) return n;
  }
  return undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function extractUsageCounts(payload: unknown): UsageCounts {
  const root = getRecord(payload);
  if (!root) return {};

  const response = getRecord(root.response);
  const usage = getRecord(root.usage) ?? getRecord(response?.usage);
  if (usage) {
    return {
      inputTokens: pickFirstNumber(usage.prompt_tokens, usage.input_tokens),
      outputTokens: pickFirstNumber(
        usage.completion_tokens,
        usage.output_tokens,
      ),
    };
  }

  // Gemini native format: usageMetadata
  const usageMeta = getRecord(root.usageMetadata);
  if (usageMeta) {
    return {
      inputTokens: pickFirstNumber(usageMeta.promptTokenCount),
      outputTokens: pickFirstNumber(usageMeta.candidatesTokenCount),
    };
  }

  return {};
}

function consumeUsageSseText(state: UsageParserState, text: string): void {
  state.buffer += text;
  const lines = state.buffer.split("\n");
  state.buffer = lines.pop() ?? "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const usage = extractUsageCounts(JSON.parse(data));
      state.inputTokens = usage.inputTokens ?? state.inputTokens;
      state.outputTokens = usage.outputTokens ?? state.outputTokens;
    } catch {
      logger.warn("Failed to parse SSE usage data from upstream");
    }
  }
}

function flushUsageSseText(
  state: UsageParserState,
  decoder: TextDecoder,
): void {
  const tail = decoder.decode();
  if (tail) consumeUsageSseText(state, tail);
  if (state.buffer.trim()) consumeUsageSseText(state, "\n");
}

// ---------------------------------------------------------------------------
// Vendor credential helpers
// ---------------------------------------------------------------------------

function buildAnthropicBase(rawBase: string): string {
  const b = rawBase.replace(/\/+$/, "");
  if (/\/v\d+$/.test(b)) return b;
  return `${b}/v1`;
}

function buildGeminiBase(rawBase: string): string {
  const b = rawBase.replace(/\/+$/, "");
  // If the URL already contains a version segment (e.g. /v1beta, /v1), use as-is.
  if (/\/v\d/.test(b)) return b;
  // For Google's official generativelanguage API, append the default version.
  // For other hosts (e.g. Replit modelfarm proxy, custom proxies), the base URL
  // is already complete and should not have a version path appended.
  if (b.includes("generativelanguage.googleapis.com")) return `${b}/v1beta`;
  return b;
}

export function getAnthropicCredentials(): { baseUrl: string; apiKey: string } {
  const config = getConfig();
  const p = config.providers.anthropic;
  const baseUrl =
    p.baseUrl ||
    process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"] ||
    ANTHROPIC_DEFAULT_BASE;
  const apiKey =
    p.apiKey || process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] || "";
  return { baseUrl, apiKey };
}

export function getGeminiCredentials(): { baseUrl: string; apiKey: string } {
  const config = getConfig();
  const p = config.providers.gemini;
  const baseUrl =
    p.baseUrl ||
    process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"] ||
    GEMINI_DEFAULT_BASE;
  const apiKey =
    p.apiKey || process.env["AI_INTEGRATIONS_GEMINI_API_KEY"] || "";
  return { baseUrl, apiKey };
}

export function getAnthropicMessagesUrl(baseUrl: string): string {
  return `${buildAnthropicBase(baseUrl)}/messages`;
}

export function getGeminiModelUrl(
  baseUrl: string,
  model: string,
  action: string,
): string {
  return `${buildGeminiBase(baseUrl)}/models/${model}:${action}`;
}

export function buildAnthropicHeaders(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  };
}

export function buildGeminiHeaders(apiKey: string): Record<string, string> {
  return { "x-goog-api-key": apiKey };
}

// ---------------------------------------------------------------------------
// Generic vendor passthrough — accepts a fully-specified URL and auth headers.
// Used for native-format endpoints (Anthropic /v1/messages, Gemini generateContent)
// where we just need to inject auth and pipe bytes straight through.
// ---------------------------------------------------------------------------

export async function rawVendorPassthroughStream(
  url: string,
  vendorHeaders: Record<string, string>,
  body: PassthroughBody,
  res: Response,
  trackFirstToken: () => void,
  logUsage: LogUsage,
  provider?: ProviderType,
  incomingHeaders?: IncomingHttpHeaders,
  requestPath?: string,
): Promise<boolean> {
  const { response: upstream, usedFallback } = await fetchWithDisguiseFallback(
    url,
    {
      method: "POST",
      headers: buildUpstreamHeaders(vendorHeaders, incomingHeaders),
      body: toFetchBody(body),
    },
    provider,
    requestPath,
    incomingHeaders?.["user-agent"] as string | undefined,
  );
  if (usedFallback) {
    logger.info(
      { provider, url: sanitizeUrlForLog(url) },
      "[disguise-fallback] Vendor stream passthrough completed without disguise",
    );
  }

  if (!upstream.ok) {
    const responseBuffer = await readResponseBufferCapped(upstream);
    const errText = new TextDecoder().decode(responseBuffer);
    logUsage({
      status: "error",
      statusCode: upstream.status,
      errorMessage: errText,
    });
    res.status(upstream.status);
    forwardUpstreamHeaders(res, upstream);
    res.send(Buffer.from(responseBuffer));
    return false;
  }

  if (!upstream.body) {
    const message = "No response body from upstream";
    logUsage({ status: "error", statusCode: 502, errorMessage: message });
    if (!res.headersSent) {
      res.status(502).json({
        error: { message, type: "upstream_error", code: "empty_response" },
      });
    } else if (!res.writableEnded) {
      res.end();
    }
    return false;
  }

  res.status(upstream.status);
  forwardUpstreamHeaders(res, upstream);
  setStreamProxyHeaders(res);

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let firstToken = false;
  const usageState: UsageParserState = {
    buffer: "",
    inputTokens: 0,
    outputTokens: 0,
  };
  let streamCompleted = false;
  let readerCanceled = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        streamCompleted = true;
        break;
      }
      if (res.writableEnded || res.destroyed) {
        try {
          await reader.cancel();
        } catch {
          logger.warn(
            "Failed to cancel upstream stream after client disconnect",
          );
        }
        readerCanceled = true;
        break;
      }
      const text = decoder.decode(value, { stream: true });
      if (
        !firstToken &&
        (text.includes('"delta"') ||
          text.includes('"text"') ||
          text.includes('"parts"'))
      ) {
        firstToken = true;
        trackFirstToken();
      }
      consumeUsageSseText(usageState, text);
      res.write(Buffer.from(value));
      flushRes(res);
    }
    flushUsageSseText(usageState, decoder);
  } finally {
    if (!streamCompleted && !readerCanceled) {
      try {
        await reader.cancel();
      } catch {
        logger.warn(
          "Failed to cancel upstream stream after stream interruption",
        );
      }
    }
    reader.releaseLock();
  }
  if (readerCanceled) {
    // Client disconnected before the stream finished — log as an error
    // (HTTP 499 = Client Closed Request, nginx convention).
    // Token counts up to disconnect are preserved for partial billing accuracy.
    logUsage({
      status: "error",
      statusCode: 499,
      inputTokens: usageState.inputTokens,
      outputTokens: usageState.outputTokens,
      errorMessage: "Client closed connection before stream completed",
    });
  } else {
    logUsage({
      status: "success",
      statusCode: upstream.status,
      inputTokens: usageState.inputTokens,
      outputTokens: usageState.outputTokens,
    });
  }
  if (!res.writableEnded) res.end();
  return true;
}

export async function rawVendorPassthroughNonStream(
  url: string,
  vendorHeaders: Record<string, string>,
  body: PassthroughBody,
  res: Response,
  logUsage: LogUsage,
  provider?: ProviderType,
  incomingHeaders?: IncomingHttpHeaders,
  requestPath?: string,
): Promise<void> {
  const { response: upstream, usedFallback } = await fetchWithDisguiseFallback(
    url,
    {
      method: "POST",
      headers: buildUpstreamHeaders(vendorHeaders, incomingHeaders),
      body: toFetchBody(body),
    },
    provider,
    requestPath,
    incomingHeaders?.["user-agent"] as string | undefined,
  );
  if (usedFallback) {
    logger.info(
      { provider, url: sanitizeUrlForLog(url) },
      "[disguise-fallback] Vendor non-stream passthrough completed without disguise",
    );
  }

  const responseBuffer = await readResponseBufferCapped(upstream);
  const responseData = new TextDecoder().decode(responseBuffer);
  let usage: UsageCounts = {};
  try {
    const parsed = JSON.parse(responseData);
    usage = extractUsageCounts(parsed);
  } catch {
    usage = {};
  }

  if (!upstream.ok) {
    logUsage({
      status: "error",
      statusCode: upstream.status,
      errorMessage: responseData,
    });
  } else {
    logUsage({
      status: "success",
      statusCode: upstream.status,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    });
  }

  res.status(upstream.status);
  forwardUpstreamHeaders(res, upstream);
  res.send(Buffer.from(responseBuffer));
}

// ---------------------------------------------------------------------------
// Raw HTTP helpers for cross-format conversion paths
// (OpenAI → Anthropic/Gemini, used in proxy-anthropic.ts and proxy-gemini.ts)
// ---------------------------------------------------------------------------

/**
 * POST a pre-built request body to an Anthropic-compatible endpoint and
 * return the raw upstream Response so the caller can stream or parse it.
 */
export async function fetchAnthropicRaw(
  baseUrl: string,
  apiKey: string,
  body: unknown,
  provider: ProviderType = "anthropic",
  requestPath?: string,
  extraHeaders?: Record<string, string>,
): Promise<globalThis.Response> {
  const url = getAnthropicMessagesUrl(baseUrl);
  const { response, usedFallback } = await fetchWithDisguiseFallback(
    url,
    {
      method: "POST",
      headers: buildUpstreamHeaders({ ...buildAnthropicHeaders(apiKey), ...(extraHeaders ?? {}) }),
      body: JSON.stringify(body),
    },
    provider,
    requestPath,
  );
  if (usedFallback) {
    logger.info(
      { provider },
      "[disguise-fallback] Anthropic raw fetch completed without disguise",
    );
  }
  return response;
}

/**
 * POST a pre-built request body to a Gemini-compatible endpoint and
 * return the raw upstream Response so the caller can stream or parse it.
 */
export async function fetchGeminiRaw(
  baseUrl: string,
  apiKey: string,
  model: string,
  action: string,
  body: unknown,
  provider: ProviderType = "gemini",
  requestPath?: string,
): Promise<globalThis.Response> {
  const url = getGeminiModelUrl(baseUrl, model, action);
  const { response, usedFallback } = await fetchWithDisguiseFallback(
    url,
    {
      method: "POST",
      headers: buildUpstreamHeaders(buildGeminiHeaders(apiKey)),
      body: JSON.stringify(body),
    },
    provider,
    requestPath,
  );
  if (usedFallback) {
    logger.info(
      { provider, model },
      "[disguise-fallback] Gemini raw fetch completed without disguise",
    );
  }
  return response;
}

export async function fetchOpenAICompatibleRaw(
  baseUrl: string,
  apiKey: string,
  endpoint: string,
  body: unknown,
  provider: ProviderType,
  requestPath?: string,
): Promise<globalThis.Response> {
  const url = `${baseUrl.replace(/\/+$/, "")}${endpoint}`;
  const { response, usedFallback } = await fetchWithDisguiseFallback(
    url,
    {
      method: "POST",
      headers: buildUpstreamHeaders({ Authorization: `Bearer ${apiKey}` }),
      body: JSON.stringify(body),
    },
    provider,
    requestPath,
  );
  if (usedFallback) {
    logger.info(
      { provider },
      "[disguise-fallback] OpenAI-compatible raw fetch completed without disguise",
    );
  }
  return response;
}

function parseSseDataBlock(
  block: string,
): { eventType: string; data: string } | null {
  if (!block.trim()) return null;
  let eventType = "";
  const dataLines: string[] = [];
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (dataLines.length === 0) return null;
  const data = dataLines.join("\n").trim();
  if (!data || data === "[DONE]") return null;
  return { eventType, data };
}

function parseSseJsonBlock(
  block: string,
  warningMessage: string,
): Record<string, unknown> | null {
  const parsedBlock = parseSseDataBlock(block);
  if (!parsedBlock) return null;
  try {
    return JSON.parse(parsedBlock.data) as Record<string, unknown>;
  } catch {
    logger.warn(warningMessage);
    return null;
  }
}

export async function* parseOpenAISSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsed = parseSseJsonBlock(
          block,
          "Failed to parse OpenAI-compatible SSE data chunk",
        );
        if (parsed) yield parsed;
      }
    }
    const tail = decoder.decode();
    if (tail) buffer += tail;
    if (buffer.trim()) {
      const parsed = parseSseJsonBlock(
        buffer,
        "Failed to parse OpenAI-compatible SSE data chunk",
      );
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse an Anthropic-style SSE stream into typed event objects.
 * Each block is delimited by double newlines; event type is on the "event:" line,
 * payload on the "data:" line.
 */
export async function* parseAnthropicSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ eventType: string; data: Record<string, unknown> }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsedBlock = parseSseDataBlock(block);
        if (!parsedBlock) continue;
        try {
          yield {
            eventType: parsedBlock.eventType,
            data: JSON.parse(parsedBlock.data) as Record<string, unknown>,
          };
        } catch {
          logger.warn("Failed to parse Anthropic SSE data chunk");
        }
      }
    }
    const tail = decoder.decode();
    if (tail) buffer += tail;
    if (buffer.trim()) {
      const parsedBlock = parseSseDataBlock(buffer);
      if (parsedBlock) {
        try {
          yield {
            eventType: parsedBlock.eventType,
            data: JSON.parse(parsedBlock.data) as Record<string, unknown>,
          };
        } catch {
          logger.warn("Failed to parse Anthropic SSE data chunk");
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse a Gemini-style SSE stream. Each line that starts with "data: " is a
 * standalone JSON chunk (no separate "event:" lines).
 */
export async function* parseGeminiSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsed = parseSseJsonBlock(
          block,
          "Failed to parse Gemini SSE data chunk",
        );
        if (parsed) yield parsed;
      }
    }
    const tail = decoder.decode();
    if (tail) buffer += tail;
    if (buffer.trim()) {
      const parsed = parseSseJsonBlock(
        buffer,
        "Failed to parse Gemini SSE data chunk",
      );
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}

function forwardUpstreamHeaders(
  res: Response,
  upstream: globalThis.Response,
): void {
  upstream.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!RESPONSE_HEADERS_NOT_FORWARDED.has(lowerKey)) {
      res.setHeader(key, value);
    }
  });
}

function setStreamProxyHeaders(res: Response): void {
  res.setHeader("X-Accel-Buffering", "no");
}

// Default base URLs for all OpenAI-compatible providers
const PROVIDER_DEFAULTS: Partial<Record<string, string>> = {
  deepseek: "https://api.deepseek.com/v1",
  xai: "https://api.x.ai/v1",
  mistral: "https://api.mistral.ai/v1",
  moonshot: "https://api.moonshot.cn/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  siliconflow: "https://api.siliconflow.cn/v1",
  cerebras: "https://api.cerebras.ai/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  novita: "https://api.novita.ai/v3/openai",
  hyperbolic: "https://api.hyperbolic.xyz/v1",
};

// Replit AI Integration environment variable suffixes (only for Replit-managed providers)
const REPLIT_AI_INTEGRATION_SUFFIX: Partial<Record<string, string>> = {
  openai: "OPENAI",
  openrouter: "OPENROUTER",
  anthropic: "ANTHROPIC",
  gemini: "GEMINI",
};

export function getProviderCredentials(
  provider:
    | "openai"
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
    | "hyperbolic",
): { baseUrl: string; apiKey: string } {
  const config = getConfig();
  const p = config.providers[provider as keyof typeof config.providers];
  const envSuffix = REPLIT_AI_INTEGRATION_SUFFIX[provider];
  const defaultBase = PROVIDER_DEFAULTS[provider] ?? "";

  const baseUrl =
    p?.baseUrl ||
    (envSuffix
      ? process.env[`AI_INTEGRATIONS_${envSuffix}_BASE_URL`]
      : undefined) ||
    defaultBase;
  const apiKey =
    p?.apiKey ||
    (envSuffix
      ? process.env[`AI_INTEGRATIONS_${envSuffix}_API_KEY`]
      : undefined) ||
    "";
  return { baseUrl, apiKey };
}

export async function rawPassthroughStream(
  providerBaseUrl: string,
  providerApiKey: string,
  endpoint: string,
  body: PassthroughBody,
  res: Response,
  trackFirstToken: () => void,
  logUsage: LogUsage,
  provider?: ProviderType,
  incomingHeaders?: IncomingHttpHeaders,
  requestPath?: string,
): Promise<boolean> {
  const url = `${providerBaseUrl.replace(/\/+$/, "")}${endpoint}`;
  const { response: upstream, usedFallback } = await fetchWithDisguiseFallback(
    url,
    {
      method: "POST",
      headers: buildUpstreamHeaders(
        { Authorization: `Bearer ${providerApiKey}` },
        incomingHeaders,
      ),
      body: toFetchBody(body),
    },
    provider,
    requestPath,
    incomingHeaders?.["user-agent"] as string | undefined,
  );
  if (usedFallback) {
    logger.info(
      { provider },
      "[disguise-fallback] Raw passthrough stream completed without disguise",
    );
  }

  if (!upstream.ok) {
    const responseBuffer = await readResponseBufferCapped(upstream);
    const errText = new TextDecoder().decode(responseBuffer);
    logUsage({
      status: "error",
      statusCode: upstream.status,
      errorMessage: errText,
    });
    res.status(upstream.status);
    forwardUpstreamHeaders(res, upstream);
    res.send(Buffer.from(responseBuffer));
    return false;
  }

  if (!upstream.body) {
    const message = "No response body from upstream";
    logUsage({ status: "error", statusCode: 502, errorMessage: message });
    if (!res.headersSent) {
      res.status(502).json({
        error: { message, type: "upstream_error", code: "empty_response" },
      });
    } else if (!res.writableEnded) {
      res.end();
    }
    return false;
  }

  res.status(upstream.status);
  forwardUpstreamHeaders(res, upstream);
  setStreamProxyHeaders(res);

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let firstToken = false;
  const usageState: UsageParserState = {
    buffer: "",
    inputTokens: 0,
    outputTokens: 0,
  };
  let streamCompleted = false;
  let readerCanceled = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        streamCompleted = true;
        break;
      }
      if (res.writableEnded || res.destroyed) {
        try {
          await reader.cancel();
        } catch {
          logger.warn(
            "Failed to cancel upstream stream after client disconnect",
          );
        }
        readerCanceled = true;
        break;
      }
      const text = decoder.decode(value, { stream: true });
      if (
        !firstToken &&
        (text.includes('"delta"') ||
          text.includes('"text"') ||
          text.includes('"parts"'))
      ) {
        firstToken = true;
        trackFirstToken();
      }
      consumeUsageSseText(usageState, text);
      res.write(Buffer.from(value));
      flushRes(res);
    }
    flushUsageSseText(usageState, decoder);
  } finally {
    if (!streamCompleted && !readerCanceled) {
      try {
        await reader.cancel();
      } catch {
        logger.warn(
          "Failed to cancel upstream stream after stream interruption",
        );
      }
    }
    reader.releaseLock();
  }
  if (readerCanceled) {
    logUsage({
      status: "error",
      statusCode: 499,
      inputTokens: usageState.inputTokens,
      outputTokens: usageState.outputTokens,
      errorMessage: "Client closed connection before stream completed",
    });
  } else {
    logUsage({
      status: "success",
      statusCode: upstream.status,
      inputTokens: usageState.inputTokens,
      outputTokens: usageState.outputTokens,
    });
  }
  if (!res.writableEnded) res.end();
  return true;
}

export async function rawPassthroughNonStream(
  providerBaseUrl: string,
  providerApiKey: string,
  endpoint: string,
  body: PassthroughBody,
  res: Response,
  logUsage: LogUsage,
  provider?: ProviderType,
  incomingHeaders?: IncomingHttpHeaders,
  requestPath?: string,
): Promise<void> {
  const url = `${providerBaseUrl.replace(/\/+$/, "")}${endpoint}`;
  const { response: upstream, usedFallback } = await fetchWithDisguiseFallback(
    url,
    {
      method: "POST",
      headers: buildUpstreamHeaders(
        { Authorization: `Bearer ${providerApiKey}` },
        incomingHeaders,
      ),
      body: toFetchBody(body),
    },
    provider,
    requestPath,
    incomingHeaders?.["user-agent"] as string | undefined,
  );
  if (usedFallback) {
    logger.info(
      { provider },
      "[disguise-fallback] Raw passthrough non-stream completed without disguise",
    );
  }

  const responseBuffer = await readResponseBufferCapped(upstream);
  const responseData = new TextDecoder().decode(responseBuffer);
  let usage: UsageCounts = {};
  try {
    const parsed = JSON.parse(responseData);
    usage = extractUsageCounts(parsed);
  } catch {
    usage = {};
  }

  if (!upstream.ok) {
    logUsage({
      status: "error",
      statusCode: upstream.status,
      errorMessage: responseData,
    });
  } else {
    logUsage({
      status: "success",
      statusCode: upstream.status,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    });
  }

  res.status(upstream.status);
  forwardUpstreamHeaders(res, upstream);
  res.send(Buffer.from(responseBuffer));
}

const RAW_PROVIDER_LABELS: Partial<Record<string, string>> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  xai: "xAI",
  mistral: "Mistral AI",
  moonshot: "Moonshot AI",
  groq: "Groq",
  together: "Together AI",
  siliconflow: "SiliconFlow",
  cerebras: "Cerebras",
  fireworks: "Fireworks AI",
  novita: "Novita AI",
  hyperbolic: "Hyperbolic",
};

// Deduplicated streaming handler for OpenAI-compatible raw passthrough providers.
export async function streamRawProvider(
  provider:
    | "openai"
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
    | "hyperbolic",
  body: ChatCompletionRequestBody,
  messages: ChatMessage[],
  res: Response,
  trackFirstToken: () => void,
  logUsage: LogUsage,
  rawBody?: Buffer,
  incomingHeaders?: IncomingHttpHeaders,
): Promise<boolean> {
  const { baseUrl, apiKey } = getProviderCredentials(provider);
  const configured = !!baseUrl && !!apiKey;
  if (!configured) {
    const label = RAW_PROVIDER_LABELS[provider] ?? provider;
    const msg = `${label} is not configured. Please enter the API Key in the Settings page.`;
    const status = 401;
    logUsage({
      status: "error",
      statusCode: status,
      errorMessage: `${provider} provider not configured`,
    });
    if (!res.headersSent) {
      res.status(status);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      setStreamProxyHeaders(res);
    }
    res.write(
      `data: ${JSON.stringify({ error: { message: msg, type: "server_error" } })}\n\n`,
    );
    if (!res.writableEnded) res.end();
    return false;
  }
  const effectiveModel = normalizeProviderModel(
    provider,
    provider === "openai" ? stripOSeriesThinkingAlias(body.model) : body.model,
  );
  const passthroughBody =
    rawBody && body.messages && !body.contents && effectiveModel === body.model
      ? rawBody
      : buildPassthroughBody(body, effectiveModel, messages, true);
  return rawPassthroughStream(
    baseUrl,
    apiKey,
    "/chat/completions",
    passthroughBody,
    res,
    trackFirstToken,
    logUsage,
    provider,
    incomingHeaders,
  );
}

// Deduplicated non-streaming handler for OpenAI-compatible raw passthrough providers.
export async function nonStreamRawProvider(
  provider:
    | "openai"
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
    | "hyperbolic",
  body: ChatCompletionRequestBody,
  messages: ChatMessage[],
  res: Response,
  logUsage: LogUsage,
  rawBody?: Buffer,
  incomingHeaders?: IncomingHttpHeaders,
): Promise<void> {
  const { baseUrl, apiKey } = getProviderCredentials(provider);
  const configured = !!baseUrl && !!apiKey;
  if (!configured) {
    const label = RAW_PROVIDER_LABELS[provider] ?? provider;
    const msg = `${label} is not configured. Please enter the API Key in the Settings page.`;
    logUsage({
      status: "error",
      statusCode: 401,
      errorMessage: `${provider} provider not configured`,
    });
    res.status(401).json({ error: { message: msg, type: "server_error" } });
    return;
  }
  const effectiveModel = normalizeProviderModel(
    provider,
    provider === "openai" ? stripOSeriesThinkingAlias(body.model) : body.model,
  );
  const passthroughBody =
    rawBody && body.messages && !body.contents && effectiveModel === body.model
      ? rawBody
      : buildPassthroughBody(body, effectiveModel, messages, false);
  await rawPassthroughNonStream(
    baseUrl,
    apiKey,
    "/chat/completions",
    passthroughBody,
    res,
    logUsage,
    provider,
    incomingHeaders,
  );
}
