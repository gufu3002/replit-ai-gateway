/**
 * /v1/messages — Claude API format endpoint
 *
 * Accepts requests in the Claude Messages API format and routes them to the
 * appropriate backend (Anthropic, OpenAI, Gemini, or OpenRouter) based on the
 * model name. Returns responses in Claude format.
 *
 * Anthropic → Anthropic: TRUE native passthrough — request body is forwarded
 * byte-for-byte; response bytes flow back without any parsing or conversion.
 *
 * Non-Anthropic backends: Claude format is converted to the target format,
 * the call is made, and the response is converted back to Claude format.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { authMiddleware } from "../lib/auth";
import { claudeToOpenAIMessages, claudeToolsToOpenAI, claudeToolChoiceToOpenAI } from "../lib/format";
import type { ClaudeRequestBody } from "../lib/format";
import { toGeminiContents } from "./proxy-format";
import { logger } from "../lib/logger";
import { pushUsageLog, sanitizeRequestBody } from "./usage-logs";

const router: IRouter = Router();

import { detectProvider, parseThinkingSuffix as getAnthropicBaseModel, flushRes } from "../lib/providers";
import { getActiveDisguise } from "../lib/disguise";
import {
  getAnthropicCredentials,
  getAnthropicMessagesUrl,
  buildAnthropicHeaders,
  rawVendorPassthroughStream,
  rawVendorPassthroughNonStream,
  getGeminiCredentials,
  fetchGeminiRaw,
  parseGeminiSSE,
  getProviderCredentials,
  fetchOpenAICompatibleRaw,
  parseOpenAISSE,
  readResponseTextCapped,
} from "./proxy-raw";

type RawRequest = Request & { rawBody?: Buffer };

/**
 * Writes a Claude-format SSE event.
 */
function writeClaudeEvent(res: Response, eventType: string, data: object): void {
  res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  flushRes(res);
}

function getErrorStatus(err: unknown): number {
  if (err instanceof Error && "status" in err && typeof (err as { status: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  return 500;
}

function claudeErrorType(statusCode: number): string {
  if (statusCode === 401 || statusCode === 403) return "authentication_error";
  if (statusCode === 429) return "rate_limit_error";
  if (statusCode >= 400 && statusCode < 500) return "invalid_request_error";
  return "api_error";
}

// ---------------------------------------------------------------------------
// POST /messages
// ---------------------------------------------------------------------------

router.post("/messages", authMiddleware, async (req: Request, res: Response) => {
  const body = req.body as ClaudeRequestBody;
  const { model, stream = false } = body;
  const provider = detectProvider(model);

  logger.info({ model, provider, stream, endpoint: "claude-messages" }, "Claude format request");

  if (!provider) {
    res.status(400).json({
      type: "error",
      error: { type: "invalid_request_error", message: `Unknown model: ${model}` },
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
      endpoint: "claude-messages",
      stream,
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
  // Anthropic → Anthropic: TRUE NATIVE PASSTHROUGH
  // The request body is already in Anthropic Messages format. We inject auth
  // headers and pipe every byte from the upstream response straight through.
  // No parsing, no conversion, no synthetic events.
  // =========================================================================
  if (provider === "anthropic") {
    const { baseUrl, apiKey } = getAnthropicCredentials();
    if (!apiKey) {
      const msg = "Anthropic API key is not configured. Please set the API Key in settings.";
      logUsage({ status: "error", statusCode: 401, errorMessage: msg });
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
        writeClaudeEvent(res, "error", { type: "error", error: { type: "authentication_error", message: msg } });
        res.end();
      } else {
        res.status(401).json({ type: "error", error: { type: "authentication_error", message: msg } });
      }
      return;
    }

    const url = getAnthropicMessagesUrl(baseUrl);
    const vendorHeaders = buildAnthropicHeaders(apiKey);
    const rawBody = (req as RawRequest).rawBody ?? req.body;

    try {
      if (stream) {
        await rawVendorPassthroughStream(
          url, vendorHeaders, rawBody, res,
          () => { usageFirstTokenMs = Date.now() - usageStart; },
          logUsage, "anthropic", req.headers, req.originalUrl,
        );
      } else {
        await rawVendorPassthroughNonStream(url, vendorHeaders, rawBody, res, logUsage, "anthropic", req.headers, req.originalUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      logger.error({ err, model }, "Anthropic native passthrough error");
      logUsage({ status: "error", statusCode: 502, errorMessage: message });
      if (!res.headersSent) {
        res.status(502).json({ type: "error", error: { type: "api_error", message } });
      }
    }
    return;
  }

  // =========================================================================
  // Non-Anthropic providers: convert Claude format → target format → Claude
  // =========================================================================

  const openAIMessages = claudeToOpenAIMessages(body);
  const openAITools = body.tools && body.tools.length > 0 ? claudeToolsToOpenAI(body.tools) : undefined;
  const openAIToolChoice = claudeToolChoiceToOpenAI(body.tool_choice);
  const maxTokens = body.max_tokens ?? 16000;
  const msgId = `msg_${Date.now()}`;
  const requestedModel = model;

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const keepaliveInterval = setInterval(() => {
      try { res.write(": keepalive\n\n"); } catch { logger.warn("Keepalive write failed for Claude SSE client"); }
    }, 5000);

    req.on("close", () => clearInterval(keepaliveInterval));

    try {
      // Send message_start + ping
      writeClaudeEvent(res, "message_start", {
        type: "message_start",
        message: {
          id: msgId, type: "message", role: "assistant", content: [],
          model: requestedModel, stop_reason: null, stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      });
      writeClaudeEvent(res, "ping", { type: "ping" });

      if (provider === "gemini") {
        const { baseModel: actualModel } = getAnthropicBaseModel(model);
        const { baseUrl, apiKey } = getGeminiCredentials();
        if (!apiKey) throw new Error("Gemini API key is not configured. Please set the API Key in settings.");
        const systemContent = openAIMessages.filter((m) => m.role === "system").map((m) => typeof m.content === "string" ? m.content : "").join("\n");
        const contents = toGeminiContents(openAIMessages as never);

        writeClaudeEvent(res, "content_block_start", {
          type: "content_block_start", index: 0,
          content_block: { type: "text", text: "" },
        });

        const upstream = await fetchGeminiRaw(baseUrl, apiKey, actualModel, "streamGenerateContent", {
          contents,
          generationConfig: { maxOutputTokens: maxTokens },
          ...(systemContent ? { systemInstruction: { parts: [{ text: systemContent }] } } : {}),
        }, "gemini", req.originalUrl);
        if (!upstream.ok) {
          const err = new Error(await readResponseTextCapped(upstream)) as Error & { status?: number };
          err.status = upstream.status;
          throw err;
        }
        if (!upstream.body) throw new Error("No response body from Gemini");

        let inputTokens = 0;
        let outputTokens = 0;
        for await (const chunk of parseGeminiSSE(upstream.body)) {
          const usage = chunk.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
          inputTokens = usage?.promptTokenCount ?? inputTokens;
          outputTokens = usage?.candidatesTokenCount ?? outputTokens;
          const candidates = (chunk as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates;
          for (const candidate of candidates ?? []) {
            for (const part of candidate.content?.parts ?? []) {
              const text = part.text ?? "";
              if (text) {
                if (usageFirstTokenMs === null) usageFirstTokenMs = Date.now() - usageStart;
                writeClaudeEvent(res, "content_block_delta", {
                  type: "content_block_delta", index: 0,
                  delta: { type: "text_delta", text },
                });
              }
            }
          }
        }

        writeClaudeEvent(res, "content_block_stop", { type: "content_block_stop", index: 0 });
        writeClaudeEvent(res, "message_delta", {
          type: "message_delta",
          delta: { stop_reason: "end_turn", stop_sequence: null },
          usage: { output_tokens: outputTokens },
        });
        writeClaudeEvent(res, "message_stop", { type: "message_stop" });
        logUsage({ status: "success", statusCode: upstream.status, inputTokens, outputTokens });

      } else {
        const { baseModel: actualModel } = getAnthropicBaseModel(model);
        const { baseUrl, apiKey } = getProviderCredentials(provider);
        if (!baseUrl || !apiKey) throw new Error(`${provider} provider is not configured. Please set the Base URL and API Key in settings.`);
        const upstream = await fetchOpenAICompatibleRaw(baseUrl, apiKey, "/chat/completions", {
          model: actualModel,
          messages: openAIMessages,
          max_tokens: maxTokens,
          ...(openAITools ? { tools: openAITools } : {}),
          ...(openAITools && openAIToolChoice !== undefined ? { tool_choice: openAIToolChoice } : {}),
          stream: true,
        }, provider, req.originalUrl);
        if (!upstream.ok) {
          const err = new Error(await readResponseTextCapped(upstream)) as Error & { status?: number };
          err.status = upstream.status;
          throw err;
        }
        if (!upstream.body) throw new Error(`No response body from ${provider}`);

        let nextBlockIndex = 0;
        let textBlockIndex = -1;
        let textBlockOpen = false;
        const toolBlockMap = new Map<number, number>();
        let hadToolCalls = false;
        let inputTokens = 0;
        let outputTokens = 0;

        for await (const chunk of parseOpenAISSE(upstream.body)) {
          const usage = chunk.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
          inputTokens = usage?.prompt_tokens ?? inputTokens;
          outputTokens = usage?.completion_tokens ?? outputTokens;
          const choices = chunk.choices as Array<{ delta?: unknown; finish_reason?: string | null }> | undefined;
          const delta = choices?.[0]?.delta as {
            content?: string | null;
            tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
          } | undefined;
          const finishReason = choices?.[0]?.finish_reason;

          if (delta?.content) {
            if (!textBlockOpen) {
              textBlockIndex = nextBlockIndex++;
              textBlockOpen = true;
              writeClaudeEvent(res, "content_block_start", {
                type: "content_block_start", index: textBlockIndex,
                content_block: { type: "text", text: "" },
              });
            }
            if (usageFirstTokenMs === null) usageFirstTokenMs = Date.now() - usageStart;
            writeClaudeEvent(res, "content_block_delta", {
              type: "content_block_delta", index: textBlockIndex,
              delta: { type: "text_delta", text: delta.content },
            });
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id && !toolBlockMap.has(tc.index)) {
                hadToolCalls = true;
                if (textBlockOpen) {
                  writeClaudeEvent(res, "content_block_stop", { type: "content_block_stop", index: textBlockIndex });
                  textBlockOpen = false;
                }
                const toolBlockIndex = nextBlockIndex++;
                toolBlockMap.set(tc.index, toolBlockIndex);
                writeClaudeEvent(res, "content_block_start", {
                  type: "content_block_start", index: toolBlockIndex,
                  content_block: { type: "tool_use", id: tc.id, name: tc.function?.name ?? "", input: {} },
                });
                if (usageFirstTokenMs === null) usageFirstTokenMs = Date.now() - usageStart;
              }
              if (tc.function?.arguments && toolBlockMap.has(tc.index)) {
                writeClaudeEvent(res, "content_block_delta", {
                  type: "content_block_delta", index: toolBlockMap.get(tc.index)!,
                  delta: { type: "input_json_delta", partial_json: tc.function.arguments },
                });
              }
            }
          }

          if (finishReason) {
            if (textBlockOpen) {
              writeClaudeEvent(res, "content_block_stop", { type: "content_block_stop", index: textBlockIndex });
            }
            for (const blockIdx of toolBlockMap.values()) {
              writeClaudeEvent(res, "content_block_stop", { type: "content_block_stop", index: blockIdx });
            }
            writeClaudeEvent(res, "message_delta", {
              type: "message_delta",
              delta: {
                stop_reason: hadToolCalls ? "tool_use" : "end_turn",
                stop_sequence: null,
              },
              usage: { output_tokens: outputTokens },
            });
            writeClaudeEvent(res, "message_stop", { type: "message_stop" });
          }
        }

        logUsage({ status: "success", statusCode: upstream.status, inputTokens, outputTokens });
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const statusCode = getErrorStatus(err);
      logger.error({ err, model }, "Claude streaming error");
      logUsage({ status: "error", statusCode, errorMessage: message });
      try {
        writeClaudeEvent(res, "error", { type: "error", error: { type: claudeErrorType(statusCode), message } });
      } catch { logger.warn("Failed to write error event to Claude SSE client"); }
    } finally {
      clearInterval(keepaliveInterval);
      res.end();
    }

  } else {
    // ----------------------------------------------------------------
    // Non-streaming
    // ----------------------------------------------------------------
    try {
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason = "end_turn";

      if (provider === "gemini") {
        const { baseModel: actualModel } = getAnthropicBaseModel(model);
        const { baseUrl, apiKey } = getGeminiCredentials();
        if (!apiKey) throw new Error("Gemini API key is not configured. Please set the API Key in settings.");
        const systemContent = openAIMessages.filter((m) => m.role === "system").map((m) => typeof m.content === "string" ? m.content : "").join("\n");
        const contents = toGeminiContents(openAIMessages as never);

        const upstream = await fetchGeminiRaw(baseUrl, apiKey, actualModel, "generateContent", {
          contents,
          generationConfig: { maxOutputTokens: maxTokens },
          ...(systemContent ? { systemInstruction: { parts: [{ text: systemContent }] } } : {}),
        }, "gemini", req.originalUrl);
        const responseTextRaw = await readResponseTextCapped(upstream);
        if (!upstream.ok) {
          const err = new Error(responseTextRaw) as Error & { status?: number };
          err.status = upstream.status;
          throw err;
        }
        const geminiResponse = JSON.parse(responseTextRaw);

        const typedGeminiResp = geminiResponse as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };
        let responseText = "";
        for (const candidate of typedGeminiResp.candidates ?? []) {
          for (const part of candidate.content?.parts ?? []) {
            if (part.text) responseText += part.text;
          }
        }
        inputTokens = typedGeminiResp.usageMetadata?.promptTokenCount ?? 0;
        outputTokens = typedGeminiResp.usageMetadata?.candidatesTokenCount ?? 0;

        logUsage({ status: "success", statusCode: upstream.status, inputTokens, outputTokens });
        res.json({
          id: msgId, type: "message", role: "assistant",
          content: [{ type: "text", text: responseText }],
          model: requestedModel, stop_reason: "end_turn", stop_sequence: null,
          usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        });

      } else {
        const { baseModel: actualModel } = getAnthropicBaseModel(model);
        const { baseUrl, apiKey } = getProviderCredentials(provider);
        if (!baseUrl || !apiKey) throw new Error(`${provider} provider is not configured. Please set the Base URL and API Key in settings.`);
        const upstream = await fetchOpenAICompatibleRaw(baseUrl, apiKey, "/chat/completions", {
          model: actualModel,
          messages: openAIMessages,
          max_tokens: maxTokens,
          ...(openAITools ? { tools: openAITools } : {}),
          ...(openAITools && openAIToolChoice !== undefined ? { tool_choice: openAIToolChoice } : {}),
          stream: false,
        }, provider, req.originalUrl);
        const responseTextRaw = await readResponseTextCapped(upstream);
        if (!upstream.ok) {
          const err = new Error(responseTextRaw) as Error & { status?: number };
          err.status = upstream.status;
          throw err;
        }
        const completion = JSON.parse(responseTextRaw);

        const raw = completion as {
          choices?: {
            message?: {
              content?: string | null;
              tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
            };
            finish_reason?: string;
          }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        inputTokens = raw.usage?.prompt_tokens ?? 0;
        outputTokens = raw.usage?.completion_tokens ?? 0;
        const finishReason = raw.choices?.[0]?.finish_reason ?? "stop";
        const message = raw.choices?.[0]?.message;

        if (finishReason === "tool_calls" && message?.tool_calls?.length) {
          // Build Claude content array: text block (if any) + tool_use blocks
          const contentBlocks: object[] = [];
          if (message.content) {
            contentBlocks.push({ type: "text", text: message.content });
          }
          for (const tc of message.tool_calls) {
            let input: Record<string, unknown> = {};
            try { input = JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch { input = { _raw: tc.function.arguments }; }
            contentBlocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
          }

          logUsage({ status: "success", statusCode: 200, inputTokens, outputTokens });
          res.json({
            id: msgId, type: "message", role: "assistant",
            content: contentBlocks,
            model: requestedModel, stop_reason: "tool_use", stop_sequence: null,
            usage: { input_tokens: inputTokens, output_tokens: outputTokens },
          });
        } else {
          const responseText = message?.content ?? "";
          stopReason = finishReason === "stop" ? "end_turn" : (finishReason ?? "end_turn");

          logUsage({ status: "success", statusCode: 200, inputTokens, outputTokens });
          res.json({
            id: msgId, type: "message", role: "assistant",
            content: [{ type: "text", text: responseText }],
            model: requestedModel, stop_reason: stopReason, stop_sequence: null,
            usage: { input_tokens: inputTokens, output_tokens: outputTokens },
          });
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const statusCode = getErrorStatus(err);
      logger.error({ err, model }, "Claude non-streaming error");
      logUsage({ status: "error", statusCode, errorMessage: message });
      res.status(statusCode).json({
        type: "error",
        error: { type: claudeErrorType(statusCode), message },
      });
    }
  }
});

export default router;
