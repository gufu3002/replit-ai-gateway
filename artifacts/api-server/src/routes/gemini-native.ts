/**
 * Gemini native format endpoints:
 *   GET  /v1beta/models                           — list models (Google format)
 *   GET  /v1beta/models/:model                    — get single model (Google format)
 *   POST /v1beta/models/:modelAction              — generateContent / streamGenerateContent
 *
 * Canonical path follows Google's official API convention (/v1beta).
 * Accepts requests in the Gemini native API format, routes to the appropriate
 * backend, and returns responses in Gemini format.
 *
 * Gemini → Gemini: TRUE native passthrough — request body is forwarded
 * byte-for-byte; response bytes flow back without any parsing or conversion.
 *
 * Non-Gemini backends: Gemini format is converted to the target format and the
 * response is converted back to Gemini format.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { authMiddleware } from "../lib/auth";
import { geminiToOpenAIMessages } from "../lib/format";
import type { GeminiRequestBody } from "../lib/format";
import { logger } from "../lib/logger";
import { getActiveDisguise } from "../lib/disguise";
import { pushUsageLog, sanitizeRequestBody } from "./usage-logs";
import { getAvailableModels } from "./proxy-models";

const router: IRouter = Router();

import { detectProvider, parseThinkingSuffix, flushRes } from "../lib/providers";
import { ANTHROPIC_MAX_TOKENS, ANTHROPIC_THINKING_BUDGET } from "../lib/model-limits";
import {
  getGeminiCredentials,
  getGeminiModelUrl,
  buildGeminiHeaders,
  rawVendorPassthroughStream,
  rawVendorPassthroughNonStream,
  getAnthropicCredentials,
  fetchAnthropicRaw,
  parseAnthropicSSE,
  getProviderCredentials,
  fetchOpenAICompatibleRaw,
  parseOpenAISSE,
  readResponseTextCapped,
} from "./proxy-raw";

// ---------------------------------------------------------------------------
// Helpers for Gemini-format model objects
// ---------------------------------------------------------------------------

function geminiDisplayName(id: string): string {
  return id.split("-").map((part) => {
    if (/^\d/.test(part)) return part;
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}

function buildGeminiModelObject(id: string) {
  return {
    name: `models/${id}`,
    version: "001",
    displayName: geminiDisplayName(id),
    description: `${geminiDisplayName(id)} — served via AI Gateway`,
    supportedGenerationMethods: ["generateContent", "streamGenerateContent"],
  };
}

// ---------------------------------------------------------------------------
// GET /models  — list all Gemini models (Google native format)
// Reference: GET https://generativelanguage.googleapis.com/v1beta/models
// ---------------------------------------------------------------------------

router.get("/models", authMiddleware, async (req: Request, res: Response) => {
  const { models } = await getAvailableModels(req.query.refresh === "1");
  const geminiModels = models.filter(
    (m) =>
      !m.id.endsWith("-thinking") &&
      !m.id.endsWith("-thinking-visible"),
  );
  res.json({
    models: geminiModels.map((m) => buildGeminiModelObject(m.id)),
  });
});

// ---------------------------------------------------------------------------
// GET /models/:model  — get single model info (Google native format)
// Reference: GET https://generativelanguage.googleapis.com/v1beta/{name=models/*}
// ---------------------------------------------------------------------------

router.get("/models/:model", authMiddleware, async (req: Request, res: Response) => {
  const rawModel = req.params.model;
  const modelId = Array.isArray(rawModel) ? rawModel[0] : rawModel;
  const { models } = await getAvailableModels();
  const found = models.find((m) => m.provider === "google" && m.id === modelId);
  if (!found) {
    res.status(404).json({
      error: {
        code: 404,
        message: `Model not found: models/${modelId}`,
        status: "NOT_FOUND",
      },
    });
    return;
  }
  res.json(buildGeminiModelObject(modelId));
});

type RawRequest = Request & { rawBody?: Buffer };

/**
 * Converts text to a Gemini-format response chunk.
 */
function makeGeminiChunk(text: string, finishReason?: string): object {
  return {
    candidates: [{
      content: { role: "model", parts: [{ text }] },
      ...(finishReason ? { finishReason: finishReason.toUpperCase() } : {}),
      index: 0,
    }],
  };
}

function getErrorStatus(err: unknown): number {
  if (err instanceof Error && "status" in err && typeof (err as { status: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  return 500;
}

function geminiErrorStatus(statusCode: number): string {
  if (statusCode === 401 || statusCode === 403) return "UNAUTHENTICATED";
  if (statusCode === 429) return "RESOURCE_EXHAUSTED";
  if (statusCode >= 400 && statusCode < 500) return "INVALID_ARGUMENT";
  return "INTERNAL";
}

// ---------------------------------------------------------------------------
// POST /models/...  (matches MODEL:generateContent and MODEL:streamGenerateContent)
// Use router.use() to avoid path-to-regexp v8 wildcard restrictions.
// ---------------------------------------------------------------------------

// Wrap as middleware so Express 5 / path-to-regexp 8 does not reject the wildcard.
router.use("/models", authMiddleware, async (req: Request, res: Response) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: { code: 405, message: "Method Not Allowed", status: "METHOD_NOT_ALLOWED" } });
    return;
  }
  // req.path here is everything after /models: "/<model>:<action>" e.g. "/gemini-2.5-flash:generateContent"
  const wildcard = req.path.replace(/^\//, "");
  const colonIdx = wildcard.lastIndexOf(":");
  const modelName = colonIdx >= 0 ? wildcard.slice(0, colonIdx) : wildcard;
  const action = colonIdx >= 0 ? wildcard.slice(colonIdx + 1) : "generateContent";
  // "stream" is an undocumented alias for "streamGenerateContent" supported as
  // a convenience shorthand (e.g. some SDK versions emit this shorter action).
  const isStream = action === "streamGenerateContent" || action === "stream";

  // The model can also be specified in the body
  const body = req.body as GeminiRequestBody & { model?: string };
  const model = body.model ?? modelName;
  const provider = detectProvider(model);

  logger.info({ model, provider, action, isStream, endpoint: "gemini-native" }, "Gemini native format request");

  if (!provider) {
    res.status(400).json({
      error: { code: 400, message: `Unknown model: ${model}`, status: "INVALID_ARGUMENT" },
    });
    return;
  }

  const usageStart = Date.now();
  let usageFirstTokenMs: number | null = null;
  const usageDisguisePreset = getActiveDisguise();
  const storedRequestBody = sanitizeRequestBody(req.body);
  const rawBodyLength = (req as RawRequest).rawBody?.length;
  const bodyBytes = rawBodyLength ?? (req.body != null ? (() => { try { return Buffer.byteLength(JSON.stringify(req.body), "utf8"); } catch { return 0; } })() : 0);
  const logUsage = (opts: { status: "success" | "error"; statusCode: number; inputTokens?: number; outputTokens?: number; errorMessage?: string }) => {
    pushUsageLog({
      id: `req-${usageStart}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(usageStart).toISOString(),
      model,
      provider,
      endpoint: isStream ? "gemini-stream" : "gemini-generate",
      stream: isStream,
      status: opts.status,
      statusCode: opts.statusCode,
      durationMs: Date.now() - usageStart,
      firstTokenMs: usageFirstTokenMs,
      inputTokens: opts.inputTokens ?? 0,
      outputTokens: opts.outputTokens ?? 0,
      requestBodyBytes: bodyBytes,
      errorMessage: opts.errorMessage,
      disguisePreset: usageDisguisePreset,
      requestBody: storedRequestBody,
    });
  };

  // =========================================================================
  // Gemini → Gemini: TRUE NATIVE PASSTHROUGH
  // The request body is already in Gemini generateContent format. We inject
  // auth headers and pipe every byte of the upstream response straight through.
  // =========================================================================
  if (provider === "gemini") {
    const { baseUrl, apiKey } = getGeminiCredentials();
    if (!apiKey) {
      const msg = "Gemini API key is not configured. Please set the API Key in settings.";
      logUsage({ status: "error", statusCode: 401, errorMessage: msg });
      res.status(401).json({ error: { code: 401, message: msg, status: "UNAUTHENTICATED" } });
      return;
    }

    const { baseModel: actualModel } = parseThinkingSuffix(model);
    const upstreamBase = getGeminiModelUrl(baseUrl, actualModel, action);
    // Forward non-auth query params (e.g. alt=sse) from the original request.
    // Exclude "key" since that is the proxy's key and must not reach the upstream.
    const forwardedParams = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === "key") continue;
      forwardedParams.append(k, String(v));
    }
    const queryString = forwardedParams.toString();
    const url = queryString ? `${upstreamBase}?${queryString}` : upstreamBase;
    const vendorHeaders = buildGeminiHeaders(apiKey);
    const rawBody = (req as RawRequest).rawBody ?? req.body;

    try {
      if (isStream) {
        await rawVendorPassthroughStream(
          url, vendorHeaders, rawBody, res,
          () => { usageFirstTokenMs = Date.now() - usageStart; },
          logUsage, "gemini", req.headers, req.originalUrl,
        );
      } else {
        await rawVendorPassthroughNonStream(url, vendorHeaders, rawBody, res, logUsage, "gemini", req.headers, req.originalUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      logger.error({ err, model }, "Gemini native passthrough error");
      logUsage({ status: "error", statusCode: 502, errorMessage: message });
      if (!res.headersSent) {
        res.status(502).json({ error: { code: 502, message, status: "INTERNAL" } });
      }
    }
    return;
  }

  // =========================================================================
  // Non-Gemini providers: convert Gemini format → target format → Gemini
  // =========================================================================

  const openAIMessages = geminiToOpenAIMessages(body);
  const systemMessages = openAIMessages.filter((m) => m.role === "system");
  const chatMessages = openAIMessages.filter((m) => m.role !== "system");
  const systemContent = systemMessages.map((m) => typeof m.content === "string" ? m.content : "").join("\n");
  const maxTokens = body.generationConfig?.maxOutputTokens ?? 8192;

  if (isStream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const keepaliveInterval = setInterval(() => {
      try { res.write(": keepalive\n\n"); } catch { logger.warn("Keepalive write failed for Gemini SSE client"); }
    }, 5000);
    req.on("close", () => clearInterval(keepaliveInterval));

    try {
      if (provider === "anthropic") {
        const { baseModel: actualModel } = parseThinkingSuffix(model);
        const { baseUrl, apiKey } = getAnthropicCredentials();
        if (!apiKey) throw new Error("Anthropic API key is not configured. Please set the API Key in settings.");
        const anthropicMaxTokens = ANTHROPIC_MAX_TOKENS[actualModel] ?? maxTokens;
        const thinkingBudget = body.generationConfig?.thinkingConfig?.thinkingBudget ?? ANTHROPIC_THINKING_BUDGET[actualModel];
        const enableThinking = !!thinkingBudget;

        const upstream = await fetchAnthropicRaw(baseUrl, apiKey, {
          model: actualModel,
          max_tokens: anthropicMaxTokens,
          ...(systemContent ? { system: systemContent } : {}),
          ...(enableThinking ? { thinking: { type: "enabled", budget_tokens: thinkingBudget! } } : {}),
          messages: chatMessages,
          stream: true,
        }, "anthropic", req.originalUrl);
        if (!upstream.ok) {
          const err = new Error(await readResponseTextCapped(upstream)) as Error & { status?: number };
          err.status = upstream.status;
          throw err;
        }
        if (!upstream.body) throw new Error("No response body from Anthropic");

        let anthropicInputTokens = 0;
        let anthropicOutputTokens = 0;
        for await (const { data: event } of parseAnthropicSSE(upstream.body)) {
          if (event.type === "message_start") {
            anthropicInputTokens = (event.message as { usage?: { input_tokens?: number } } | undefined)?.usage?.input_tokens ?? 0;
          } else if (event.type === "content_block_delta" && (event.delta as { type?: string }).type === "text_delta") {
            if (usageFirstTokenMs === null) usageFirstTokenMs = Date.now() - usageStart;
            res.write(`data: ${JSON.stringify(makeGeminiChunk((event.delta as { text?: string }).text ?? ""))}\n\n`);
            flushRes(res);
          } else if (event.type === "message_delta") {
            anthropicOutputTokens = (event.usage as { output_tokens?: number } | undefined)?.output_tokens ?? 0;
          } else if (event.type === "message_stop") {
            res.write(`data: ${JSON.stringify(makeGeminiChunk("", "STOP"))}\n\n`);
            flushRes(res);
          }
        }
        logUsage({ status: "success", statusCode: upstream.status, inputTokens: anthropicInputTokens, outputTokens: anthropicOutputTokens });

      } else {
        const { baseModel: actualModel } = parseThinkingSuffix(model);
        const { baseUrl, apiKey } = getProviderCredentials(provider);
        if (!baseUrl || !apiKey) throw new Error(`${provider} provider is not configured. Please set the Base URL and API Key in settings.`);
        const upstream = await fetchOpenAICompatibleRaw(baseUrl, apiKey, "/chat/completions", {
          model: actualModel,
          messages: openAIMessages,
          max_tokens: maxTokens,
          stream: true,
        }, provider, req.originalUrl);
        if (!upstream.ok) {
          const err = new Error(await readResponseTextCapped(upstream)) as Error & { status?: number };
          err.status = upstream.status;
          throw err;
        }
        if (!upstream.body) throw new Error(`No response body from ${provider}`);
        let promptTokens = 0;
        let candidateTokens = 0;
        for await (const chunk of parseOpenAISSE(upstream.body)) {
          const usage = chunk.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
          promptTokens = usage?.prompt_tokens ?? promptTokens;
          candidateTokens = usage?.completion_tokens ?? candidateTokens;
          const choices = chunk.choices as Array<{ delta?: { content?: string | null }; finish_reason?: string | null }> | undefined;
          const text = choices?.[0]?.delta?.content ?? "";
          const finishReason = choices?.[0]?.finish_reason;
          // Skip writing chunks that carry no content and have no finish reason
          // (e.g. usage-only events sent by some providers)
          if (!text && !finishReason) continue;
          if (text && usageFirstTokenMs === null) usageFirstTokenMs = Date.now() - usageStart;
          res.write(`data: ${JSON.stringify(makeGeminiChunk(text, finishReason ?? undefined))}\n\n`);
          flushRes(res);
        }
        logUsage({ status: "success", statusCode: upstream.status, inputTokens: promptTokens, outputTokens: candidateTokens });
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const statusCode = getErrorStatus(err);
      logger.error({ err, model }, "Gemini native streaming error");
      logUsage({ status: "error", statusCode, errorMessage: message });
      try {
        res.write(`data: ${JSON.stringify({ error: { code: statusCode, message, status: geminiErrorStatus(statusCode) } })}\n\n`);
      } catch { logger.warn("Failed to write error event to Gemini SSE client"); }
    } finally {
      clearInterval(keepaliveInterval);
      res.end();
    }

  } else {
    // ----------------------------------------------------------------
    // Non-streaming — return full Gemini-format response
    // ----------------------------------------------------------------
    try {
      let responseText = "";
      let promptTokens = 0;
      let candidateTokens = 0;

      if (provider === "anthropic") {
        const { baseModel: actualModel } = parseThinkingSuffix(model);
        const { baseUrl, apiKey } = getAnthropicCredentials();
        if (!apiKey) throw new Error("Anthropic API key is not configured. Please set the API Key in settings.");
        const anthropicMaxTokens = ANTHROPIC_MAX_TOKENS[actualModel] ?? maxTokens;
        const thinkingBudget = body.generationConfig?.thinkingConfig?.thinkingBudget ?? ANTHROPIC_THINKING_BUDGET[actualModel];
        const enableThinking = !!thinkingBudget;

        const upstream = await fetchAnthropicRaw(baseUrl, apiKey, {
          model: actualModel,
          max_tokens: anthropicMaxTokens,
          ...(systemContent ? { system: systemContent } : {}),
          ...(enableThinking ? { thinking: { type: "enabled", budget_tokens: thinkingBudget! } } : {}),
          messages: chatMessages,
          stream: false,
        }, "anthropic", req.originalUrl);
        const responseTextRaw = await readResponseTextCapped(upstream);
        if (!upstream.ok) {
          const err = new Error(responseTextRaw) as Error & { status?: number };
          err.status = upstream.status;
          throw err;
        }
        const response = JSON.parse(responseTextRaw) as {
          content?: Array<{ type?: string; text?: string }>;
          usage?: { input_tokens?: number; output_tokens?: number };
        };

        for (const block of response.content ?? []) {
          if (block.type === "text" && block.text) {
            responseText += block.text;
          }
        }
        promptTokens = response.usage?.input_tokens ?? 0;
        candidateTokens = response.usage?.output_tokens ?? 0;

      } else {
        const { baseModel: actualModel } = parseThinkingSuffix(model);
        const { baseUrl, apiKey } = getProviderCredentials(provider);
        if (!baseUrl || !apiKey) throw new Error(`${provider} provider is not configured. Please set the Base URL and API Key in settings.`);
        const upstream = await fetchOpenAICompatibleRaw(baseUrl, apiKey, "/chat/completions", {
          model: actualModel,
          messages: openAIMessages,
          max_tokens: maxTokens,
          stream: false,
        }, provider, req.originalUrl);
        const responseTextRaw = await readResponseTextCapped(upstream);
        if (!upstream.ok) {
          const err = new Error(responseTextRaw) as Error & { status?: number };
          err.status = upstream.status;
          throw err;
        }
        const completion = JSON.parse(responseTextRaw);
        const raw = completion as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        responseText = raw.choices?.[0]?.message?.content ?? "";
        promptTokens = raw.usage?.prompt_tokens ?? 0;
        candidateTokens = raw.usage?.completion_tokens ?? 0;
      }

      logUsage({ status: "success", statusCode: 200, inputTokens: promptTokens, outputTokens: candidateTokens });
      res.json({
        candidates: [{
          content: { role: "model", parts: [{ text: responseText }] },
          finishReason: "STOP",
          index: 0,
        }],
        usageMetadata: {
          promptTokenCount: promptTokens,
          candidatesTokenCount: candidateTokens,
          totalTokenCount: promptTokens + candidateTokens,
        },
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const statusCode = getErrorStatus(err);
      logger.error({ err, model }, "Gemini native non-streaming error");
      logUsage({ status: "error", statusCode, errorMessage: message });
      res.status(statusCode).json({
        error: { code: statusCode, message, status: geminiErrorStatus(statusCode) },
      });
    }
  }
});

export default router;
