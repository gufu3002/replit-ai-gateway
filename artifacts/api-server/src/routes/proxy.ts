import { Router, type IRouter, type Request, type Response } from "express";
import { authMiddleware as sharedAuth } from "../lib/auth";
import { geminiToOpenAIMessages } from "../lib/format";
import { logger } from "../lib/logger";
import { detectProvider, type ProviderType } from "../lib/providers";
import {
  GEMINI_NON_CHAT_MODELS,
  getAvailableModels,
  MODELS,
  OPENAI_NON_CHAT_MODELS,
  OPENAI_RESPONSES_API_MODELS,
} from "./proxy-models";
import {
  type ChatCompletionRequestBody,
  type ChatMessage,
} from "./proxy-format";
import {
  nonStreamRawProvider,
  streamRawProvider,
  getProviderCredentials,
  rawPassthroughStream,
  rawPassthroughNonStream,
} from "./proxy-raw";
import {
  setupSseHeaders,
  startKeepalive,
  extractUpstreamStatus,
} from "./proxy-sse";
import { createUsageTracker } from "./proxy-usage";
import {
  handleAnthropicStream,
  handleAnthropicNonStream,
} from "./proxy-anthropic";
import { handleGeminiStream, handleGeminiNonStream } from "./proxy-gemini";

const router: IRouter = Router();

const authMiddleware = sharedAuth;

type RawProvider = Exclude<ProviderType, "anthropic" | "gemini">;

const RAW_PROVIDERS = new Set<RawProvider>([
  "openai",
  "openrouter",
  "deepseek",
  "xai",
  "mistral",
  "moonshot",
  "groq",
  "together",
  "siliconflow",
  "cerebras",
  "fireworks",
  "novita",
  "hyperbolic",
]);

function isRawProvider(provider: ProviderType | null): provider is RawProvider {
  return provider !== null && RAW_PROVIDERS.has(provider as RawProvider);
}

// ---------------------------------------------------------------------------
// GET /models
// OpenAI format:    GET /v1/models       (default)
// Anthropic format: GET /v1/models  with anthropic-version header
//   Reference: https://docs.anthropic.com/en/api/models-list
// ---------------------------------------------------------------------------

function anthropicDisplayName(id: string): string {
  const parts = id.split("-");
  const merged: string[] = [];
  let i = 0;
  while (i < parts.length) {
    if (/^\d+$/.test(parts[i]) && i + 1 < parts.length && /^\d+$/.test(parts[i + 1])) {
      merged.push(`${parts[i]}.${parts[i + 1]}`);
      i += 2;
    } else {
      merged.push(parts[i]);
      i++;
    }
  }
  return merged.map((part) => {
    if (/^\d/.test(part)) return part;
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}

router.get("/models", authMiddleware, async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const { models } = await getAvailableModels(req.query.refresh === "1");

  // Detect Anthropic clients via the anthropic-version header
  if (req.headers["anthropic-version"]) {
    // Exclude gateway-synthesised -thinking / -thinking-visible aliases:
    // upstream Anthropic /v1/models never returns these, so leaking them would
    // make our response shape diverge from the real Anthropic API surface.
    const anthropicModels = models.filter(
      (m) =>
        m.provider === "anthropic" &&
        !m.id.endsWith("-thinking") &&
        !m.id.endsWith("-thinking-visible"),
    );
    const data = anthropicModels.map((m) => ({
      type: "model",
      id: m.id,
      display_name: anthropicDisplayName(m.id),
      created_at: "2025-01-01T00:00:00Z",
    }));
    res.json({
      data,
      has_more: false,
      first_id: data[0]?.id ?? null,
      last_id: data[data.length - 1]?.id ?? null,
    });
    return;
  }

  // Default: OpenAI format
  res.json({
    object: "list",
    data: models.map((m) => ({
      id: m.id,
      object: "model",
      created: now,
      owned_by: m.provider,
      ...(m.contextLength ? { context_length: m.contextLength } : {}),
    })),
  });
});

// ---------------------------------------------------------------------------
// POST /chat/completions
// ---------------------------------------------------------------------------

router.post(
  "/chat/completions",
  authMiddleware,
  async (req: Request, res: Response) => {
    const body = req.body as ChatCompletionRequestBody;
    const { model, stream = false } = body;
    if (typeof model !== "string" || model.trim() === "") {
      res.status(400).json({
        error: {
          message: "Missing required field: model",
          type: "invalid_request_error",
          code: "missing_model",
        },
      });
      return;
    }

    // Auto-detect Gemini format (has `contents` but no `messages`)
    // and convert to OpenAI messages format transparently.
    let messages: ChatMessage[];
    if (!body.messages && body.contents) {
      const converted = geminiToOpenAIMessages({
        contents: body.contents,
        systemInstruction: body.systemInstruction,
        generationConfig: body.generationConfig,
      });
      messages = converted as ChatMessage[];
      logger.info(
        { model, endpoint: "chat/completions" },
        "Auto-detected Gemini format, converted to OpenAI messages",
      );
    } else {
      messages = [...(body.messages ?? [])];
    }

    const baseModelForCheck = model.replace(/-thinking(-visible)?$/, "");
    if (OPENAI_RESPONSES_API_MODELS.has(baseModelForCheck)) {
      res.status(400).json({
        error: {
          message: `Model '${model}' only supports the Responses API. Use POST /v1/responses instead of /v1/chat/completions.`,
          type: "invalid_request_error",
          code: "model_not_supported",
        },
      });
      return;
    }
    if (OPENAI_NON_CHAT_MODELS.has(baseModelForCheck)) {
      const hint: Record<string, string> = {
        "gpt-image-1": "Use POST /v1/images/generations instead.",
        "gpt-audio": "Use the audio endpoints instead.",
        "gpt-audio-mini": "Use the audio endpoints instead.",
        "gpt-4o-mini-transcribe":
          "Use the audio/transcriptions endpoint instead.",
      };
      res.status(400).json({
        error: {
          message: `Model '${model}' is not compatible with the chat/completions endpoint. ${hint[baseModelForCheck] ?? ""}`,
          type: "invalid_request_error",
          code: "model_not_supported",
        },
      });
      return;
    }
    if (GEMINI_NON_CHAT_MODELS.has(baseModelForCheck)) {
      res.status(400).json({
        error: {
          message: `Model '${model}' is an image generation model and is not compatible with the chat/completions endpoint. Use the Gemini native image generation API instead.`,
          type: "invalid_request_error",
          code: "model_not_supported",
        },
      });
      return;
    }

    const provider = detectProvider(model);
    const { trackFirstToken, logUsage } = createUsageTracker(
      model,
      provider || "unknown",
      "chat/completions",
      stream,
      req.body,
      (req as Request & { rawBody?: Buffer }).rawBody?.length,
    );

    logger.info(
      {
        model,
        provider,
        stream,
        messageCount: messages.length,
        messages: messages.map((m, i) => ({
          index: i,
          role: m.role,
          contentLength:
            typeof m.content === "string"
              ? m.content.length
              : JSON.stringify(m.content).length,
        })),
      },
      "Chat completion request",
    );

    if (!provider) {
      const allModelIds = (await getAvailableModels().catch(() => ({ models: MODELS }))).models.map((m) => m.id);
      const keyword = model.split("-")[0].split("/").pop() || "";
      const suggestions = allModelIds
        .filter(
          (m) =>
            m.includes(keyword) ||
            (keyword.length > 2 &&
              m.split("-").some((p) => keyword.includes(p))),
        )
        .slice(0, 5);
      logUsage({
        status: "error",
        statusCode: 400,
        errorMessage: `Unknown model: ${model}`,
      });
      res.status(400).json({
        error: {
          message: `Unknown model: ${model}`,
          type: "invalid_request_error",
          code: "model_not_found",
          hint: `该模型名称无法识别。提示：1) OpenRouter 模型需使用 "provider/model-name" 格式（如 "anthropic/claude-opus-4.6"）  2) 检查模型名拼写是否正确  3) 访问 GET /v1/models 获取完整模型列表`,
          supported_model_count: allModelIds.length,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
          docs: (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0].trim() || undefined,
        },
      });
      return;
    }

    if (stream) {
      let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

      try {
        if (isRawProvider(provider)) {
          // Raw passthrough: bytes flow directly from upstream to client.
          // Must return immediately — [DONE] must NOT be appended to raw streams.
          await streamRawProvider(
            provider,
            body,
            messages,
            res,
            trackFirstToken,
            logUsage,
            (req as Request & { rawBody?: Buffer }).rawBody,
            req.headers,
          );
          return;
        } else if (provider === "anthropic") {
          setupSseHeaders(res);
          keepaliveInterval = startKeepalive(res, req);
          await handleAnthropicStream(
            body,
            model,
            messages,
            res,
            trackFirstToken,
            logUsage,
          );
        } else if (provider === "gemini") {
          setupSseHeaders(res);
          keepaliveInterval = startKeepalive(res, req);
          await handleGeminiStream(
            body,
            model,
            messages,
            res,
            trackFirstToken,
            logUsage,
          );
        }

        // [DONE] is only appended for cross-format conversion paths (anthropic/gemini)
        // where the gateway constructs the SSE stream. Raw passthrough paths return
        // before reaching this line so upstream [DONE] frames are never duplicated.
        res.write("data: [DONE]\n\n");
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Internal server error";
        const upstreamStatus = extractUpstreamStatus(err);
        const streamErrStatus =
          upstreamStatus ?? (/\b4\d\d\b/.test(errorMessage) ? 400 : 502);
        logUsage({
          status: "error",
          statusCode: streamErrStatus,
          errorMessage,
        });
        logger.error({ err, model, provider }, "Streaming error");
        try {
          const errCode =
            streamErrStatus >= 400 && streamErrStatus < 500
              ? "bad_request"
              : "provider_error";
          res.write(
            `data: ${JSON.stringify({
              error: {
                message: errorMessage,
                type:
                  errCode === "bad_request"
                    ? "invalid_request_error"
                    : "upstream_error",
                code: errCode,
                provider,
                model,
                hint:
                  errCode === "bad_request"
                    ? `上游 ${provider} 返回了错误，请检查模型名和请求参数是否正确`
                    : `上游 ${provider} 服务返回了错误，可能是服务暂时不可用或配额已用尽`,
              },
            })}\n\n`,
          );
        } catch {
          logger.warn("Failed to write error SSE event to client");
        }
      } finally {
        if (keepaliveInterval) clearInterval(keepaliveInterval);
        res.end();
      }
    } else {
      try {
        if (isRawProvider(provider)) {
          await nonStreamRawProvider(
            provider,
            body,
            messages,
            res,
            logUsage,
            (req as Request & { rawBody?: Buffer }).rawBody,
            req.headers,
          );
        } else if (provider === "anthropic") {
          await handleAnthropicNonStream(body, model, messages, res, logUsage);
        } else if (provider === "gemini") {
          await handleGeminiNonStream(body, model, messages, res, logUsage);
        }
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Internal server error";
        const upstreamStatus = extractUpstreamStatus(err);
        const statusCode = upstreamStatus
          ? upstreamStatus >= 400 && upstreamStatus < 500
            ? upstreamStatus
            : 502
          : /\b4\d\d\b/.test(errorMessage)
            ? 400
            : 502;
        logUsage({ status: "error", statusCode, errorMessage });
        logger.error({ err, model, provider }, "Non-streaming error");
        const isClientError = statusCode >= 400 && statusCode < 500;
        res.status(statusCode).json({
          error: {
            message: errorMessage,
            type: isClientError ? "invalid_request_error" : "upstream_error",
            code: isClientError ? "bad_request" : "provider_error",
            provider,
            model,
            hint: isClientError
              ? `上游 ${provider} 返回了 ${statusCode} 错误，可能原因：1) 模型名 "${model}" 在 ${provider} 侧不存在  2) 请求参数格式不符合 ${provider} 要求  3) 访问 GET /v1/models 确认可用的模型名称`
              : `上游 ${provider} 服务返回了错误。可能原因：1) ${provider} 服务暂时不可用  2) API 配额已用尽  3) 请求内容被 ${provider} 拒绝`,
          },
        });
      }
    }
  },
);

// ---------------------------------------------------------------------------
// POST /responses — OpenAI Responses API passthrough (for codex models)
// ---------------------------------------------------------------------------

router.post(
  "/responses",
  authMiddleware,
  async (req: Request, res: Response) => {
    const body = req.body;
    const model = body?.model as string;
    const stream = body?.stream === true;

    if (!model) {
      res.status(400).json({
        error: {
          message: "Missing required field: model",
          type: "invalid_request_error",
          code: "missing_model",
        },
      });
      return;
    }

    const { trackFirstToken, logUsage } = createUsageTracker(
      model,
      "openai",
      "responses",
      stream,
      req.body,
      (req as Request & { rawBody?: Buffer }).rawBody?.length,
    );

    logger.info(
      { model, endpoint: "responses", stream },
      "Responses API request",
    );

    const { baseUrl, apiKey } = getProviderCredentials("openai");

    if (!baseUrl || !apiKey) {
      logUsage({
        status: "error",
        statusCode: 500,
        errorMessage: "OpenAI provider not configured",
      });
      res.status(500).json({
        error: {
          message:
            "OpenAI provider is not configured. Please set the Base URL and API Key in settings.",
          type: "server_error",
        },
      });
      return;
    }

    try {
      if (stream) {
        try {
          await rawPassthroughStream(
            baseUrl,
            apiKey,
            "/responses",
            (req as Request & { rawBody?: Buffer }).rawBody ?? body,
            res,
            trackFirstToken,
            logUsage,
            "openai",
            req.headers,
          );
        } finally {
          res.end();
        }
      } else {
        await rawPassthroughNonStream(
          baseUrl,
          apiKey,
          "/responses",
          (req as Request & { rawBody?: Buffer }).rawBody ?? body,
          res,
          logUsage,
          "openai",
          req.headers,
        );
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Internal server error";
      logUsage({ status: "error", statusCode: 502, errorMessage });
      logger.error({ err, model }, "Responses API error");
      if (stream && res.headersSent) {
        try {
          res.write(
            `data: ${JSON.stringify({ error: { message: errorMessage, type: "upstream_error", code: "provider_error" } })}\n\n`,
          );
        } catch {
          logger.warn("Failed to write error event to responses SSE client");
        }
        try {
          res.end();
        } catch {
          logger.warn("Failed to end response for responses SSE client");
        }
      } else {
        res.status(502).json({
          error: {
            message: errorMessage,
            type: "upstream_error",
            code: "provider_error",
            model,
            hint: `上游 OpenAI Responses API 返回了错误: ${errorMessage}`,
          },
        });
      }
    }
  },
);

export default router;
