import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../lib/auth";
import { logger } from "../lib/logger";
import type { ProviderType } from "../lib/providers";
import { createUsageTracker } from "./proxy-usage";
import { getProviderCredentials, rawPassthroughNonStream } from "./proxy-raw";

const router = Router();

// ---------------------------------------------------------------------------
// Image-generation provider detection
//
// Supported upstream providers and their model routing rules:
//   openai     — dall-e-2, dall-e-3, gpt-image-1 (default)
//   xai        — aurora, aurora-* (xAI's image model)
//   fireworks  — fireworks/* (strip namespace prefix before forwarding)
//   novita     — novita/* (strip namespace prefix before forwarding)
//   hyperbolic — hyperbolic/* (strip namespace prefix before forwarding)
//   openrouter — any remaining org/model slug containing "/"
// ---------------------------------------------------------------------------

type ImageProvider = Extract<
  ProviderType,
  "openai" | "openrouter" | "xai" | "fireworks" | "novita" | "hyperbolic"
>;

const IMAGE_PROVIDER_LABELS: Record<ImageProvider, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  xai: "xAI",
  fireworks: "Fireworks AI",
  novita: "Novita AI",
  hyperbolic: "Hyperbolic",
};

function detectImageProvider(model: string): ImageProvider {
  if (model === "aurora" || model.startsWith("aurora-")) return "xai";
  if (model.startsWith("fireworks/")) return "fireworks";
  if (model.startsWith("novita/")) return "novita";
  if (model.startsWith("hyperbolic/")) return "hyperbolic";
  if (model.includes("/")) return "openrouter";
  return "openai";
}

const NAMESPACE_PREFIXES: Partial<Record<ImageProvider, string>> = {
  fireworks: "fireworks/",
  novita: "novita/",
  hyperbolic: "hyperbolic/",
  // "openrouter/auto", "openrouter/free" etc. must have the routing prefix
  // stripped before forwarding; plain org/model slugs (e.g. "anthropic/claude-…")
  // reach OpenRouter without a prefix and are sent as-is.
  openrouter: "openrouter/",
};

function normalizeImageModel(provider: ImageProvider, model: string): string {
  const prefix = NAMESPACE_PREFIXES[provider];
  if (prefix && model.startsWith(prefix)) return model.slice(prefix.length);
  return model;
}

// ---------------------------------------------------------------------------
// Core handler
// ---------------------------------------------------------------------------

async function handleImagesGenerations(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const model = typeof body.model === "string" ? body.model : "gpt-image-1";

  const provider = detectImageProvider(model);
  const { baseUrl, apiKey } = getProviderCredentials(provider);

  if (!baseUrl || !apiKey) {
    const label = IMAGE_PROVIDER_LABELS[provider] ?? provider;
    res.status(401).json({
      error: {
        message: `${label} is not configured. Please enter the API Key in the Settings page.`,
        type: "server_error",
      },
    });
    return;
  }

  const effectiveModel = normalizeImageModel(provider, model);

  // Use the original raw bytes if the model name is unchanged (zero re-serialization).
  // If the model was rewritten (namespace prefix stripped), rebuild the body with the
  // normalized model name so the upstream receives the correct identifier.
  const passthroughBody: Buffer | Record<string, unknown> =
    rawBody && effectiveModel === model
      ? rawBody
      : { ...body, model: effectiveModel };

  const { logUsage } = createUsageTracker(
    model,
    provider,
    "/v1/images/generations",
    false,
    body,
    rawBody?.length,
  );

  try {
    await rawPassthroughNonStream(
      baseUrl,
      apiKey,
      "/images/generations",
      passthroughBody,
      res,
      logUsage,
      provider,
      req.headers,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { err, provider, model },
      "Unhandled error in images/generations",
    );
    logUsage({ status: "error", statusCode: 500, errorMessage: message });
    if (!res.headersSent) {
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  }
}

function routeHandler(req: Request, res: Response): void {
  handleImagesGenerations(req, res).catch((err) => {
    logger.error({ err }, "Unexpected error in images/generations handler");
    if (!res.headersSent) {
      res.status(500).json({
        error: { message: "Internal server error", type: "server_error" },
      });
    }
  });
}

// Register both /images/generations (mounted under /v1 in app.ts) and the
// explicit /v1/images/generations path so it works when app.use(imagesRouter)
// is called without a prefix, consistent with other route files.
router.post("/images/generations", authMiddleware, routeHandler);

export default router;
