import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";
import { getUrlAutoCorrect, setUrlAutoCorrect } from "../app";
import { getConfig, updateConfig, getPublicConfig, maskKey, DEFAULT_CONFIG } from "../config";
import type { AppConfig, ProviderConfig } from "../config";
import { adminAuth, safeCompare } from "../lib/auth";
import { extractApiKey } from "../lib/auth";
import { DISGUISE_PROFILES, type DisguisePreset } from "../lib/disguise";
import { getAvailableModels } from "./proxy-models";

// ---------------------------------------------------------------------------
// SSRF guard: reject baseUrl values that resolve to private/loopback networks
// ---------------------------------------------------------------------------
// Matches hostnames / IPv6 that resolve to loopback or private networks.
// Covers:
//   - IPv4 loopback/private/link-local/CGNAT ranges
//   - IPv4-mapped-IPv6 (::ffff:*) bypasses
//   - GCP instance metadata hostname
//   - ULA (fd00::/8) and loopback (::1) IPv6
// Node.js URL#hostname INCLUDES brackets for IPv6 (e.g. [::1]), so we
// strip them before testing to get the bare address.
const PRIVATE_IP_RE =
  /^(localhost|0\.0\.0\.0|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|::ffff:|fd[0-9a-f]{2}:|metadata\.google\.internal)/i;

function isPrivateUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    // Block non-http/https schemes that could reach local resources (file://, ftp://, etc.)
    if (!["http:", "https:"].includes(u.protocol)) return true;
    // Strip IPv6 brackets so the regex can match bare addresses (e.g. [::1] → ::1)
    const hostname = u.hostname.replace(/^\[|\]$/g, "");
    return PRIVATE_IP_RE.test(hostname);
  } catch {
    return false;
  }
}

const MIN_KEY_LENGTH = 16;
const MAX_BUDGET_USD = 100_000;

const router: IRouter = Router();

router.use(healthRouter);

router.get("/config", (_req, res) => {
  const config = getConfig();
  const provided = extractApiKey(_req);
  const adminKey = config.adminKey;
  const proxyKey = config.proxyApiKey;
  const requiredKey = adminKey || proxyKey;
  const authed = !!(provided && requiredKey && safeCompare(provided, requiredKey));
  res.json(getPublicConfig(authed));
});

router.get("/models", async (req, res) => {
  const forceRefresh = req.query.refresh === "1";
  // Forced refresh triggers real upstream API calls, consuming upstream quota.
  // Require authentication so unauthenticated callers cannot exhaust it.
  if (forceRefresh) {
    const config = getConfig();
    const requiredKey = config.adminKey || config.proxyApiKey;
    if (requiredKey) {
      const provided = extractApiKey(req);
      if (!provided || !safeCompare(provided, requiredKey)) {
        res.status(401).json({
          error: {
            message: "Unauthorized: ?refresh=1 requires authentication",
            type: "invalid_request_error",
            code: "invalid_api_key",
          },
        });
        return;
      }
    }
  }
  const now = Math.floor(Date.now() / 1000);
  const { models, sources } = await getAvailableModels(forceRefresh);
  res.json({
    object: "list",
    source: "replit_live_sync",
    refreshed_at: now,
    sync_ttl_seconds: 60,
    sources,
    data: models.map((m) => ({
      id: m.id,
      object: "model",
      created: now,
      owned_by: m.provider,
      ...(m.contextLength ? { context_length: m.contextLength } : {}),
    })),
  });
});

router.post("/config/admin-key", adminAuth, async (req, res) => {
  const { newKey, confirmKey } = req.body as { newKey: string; confirmKey: string };
  if (newKey === "") {
    await updateConfig({ adminKey: "" });
    res.json({ adminKeyConfigured: false, message: "Admin Key 已清除，将回退为 Proxy Key 验证" });
    return;
  }
  if (!newKey || typeof newKey !== "string" || newKey.length < MIN_KEY_LENGTH) {
    res.status(400).json({ error: { message: `Admin Key 长度不能少于 ${MIN_KEY_LENGTH} 个字符` } });
    return;
  }
  if (newKey !== confirmKey) {
    res.status(400).json({ error: { message: "两次输入的 Admin Key 不一致" } });
    return;
  }
  await updateConfig({ adminKey: newKey });
  res.json({ adminKeyConfigured: true });
});

router.post("/config/proxy-key", adminAuth, async (req, res) => {
  const { newKey, confirmKey } = req.body as { newKey: string; confirmKey: string };
  if (!newKey || typeof newKey !== "string" || newKey.length < MIN_KEY_LENGTH) {
    res.status(400).json({ error: { message: `API Key 长度不能少于 ${MIN_KEY_LENGTH} 个字符` } });
    return;
  }
  if (newKey !== confirmKey) {
    res.status(400).json({ error: { message: "两次输入的 API Key 不一致" } });
    return;
  }
  const config = await updateConfig({ proxyApiKey: newKey });
  res.json({ proxyApiKey: maskKey(config.proxyApiKey), isDefaultKey: config.proxyApiKey === DEFAULT_CONFIG.proxyApiKey });
});

router.post("/config/provider", adminAuth, async (req, res) => {
  const { provider, baseUrl, apiKey } = req.body as { provider: string; baseUrl?: string; apiKey?: string };
  const validProviders: Array<keyof AppConfig["providers"]> = [
    "openai", "anthropic", "gemini", "deepseek", "xai",
    "mistral", "moonshot", "groq", "together", "siliconflow",
    "cerebras", "fireworks", "novita", "hyperbolic", "openrouter",
  ];
  if (!validProviders.includes(provider as keyof AppConfig["providers"])) {
    res.status(400).json({ error: { message: `Invalid provider: ${provider}` } });
    return;
  }
  const providerKey = provider as keyof AppConfig["providers"];
  const providerUpdate: Partial<ProviderConfig> = {};
  if (baseUrl !== undefined) {
    if (baseUrl && isPrivateUrl(baseUrl)) {
      res.status(400).json({ error: { message: "baseUrl 不能指向私有/内网地址（SSRF 防护）" } });
      return;
    }
    providerUpdate.baseUrl = baseUrl;
  }
  if (apiKey !== undefined) providerUpdate.apiKey = apiKey;
  await updateConfig({ providers: { [providerKey]: providerUpdate } as AppConfig["providers"] });
  res.json(getPublicConfig(true));
});

router.get("/settings/url-autocorrect", adminAuth, (_req, res) => {
  const config = getUrlAutoCorrect();
  res.json({ ...config, enabled: config.global });
});

// "global" is the internal config field; "enabled" is an alias accepted for
// external API consumers. Both map to the same toggle. The frontend uses "global".
const URL_AC_VALID_KEYS = new Set(["chatCompletions", "messages", "models", "geminiGenerate", "geminiStream", "global", "enabled"]);

router.post("/settings/url-autocorrect", adminAuth, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    res.status(400).json({ error: { message: "Request body must be a non-empty JSON object" } });
    return;
  }
  const updates: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(body)) {
    if (!URL_AC_VALID_KEYS.has(key)) continue;
    if (typeof val !== "boolean") {
      res.status(400).json({ error: { message: `Field "${key}" must be a boolean` } });
      return;
    }
    if (key === "enabled") {
      updates.global = val;
    } else {
      updates[key] = val;
    }
  }
  await setUrlAutoCorrect(updates);
  const config = getUrlAutoCorrect();
  res.json({ ...config, enabled: config.global });
});

// ---------------------------------------------------------------------------
// Budget quota settings
// ---------------------------------------------------------------------------

router.get("/settings/budget", adminAuth, (_req, res) => {
  const config = getConfig();
  res.json({ budgetQuotaUsd: config.budgetQuotaUsd ?? 10.0 });
});

router.post("/settings/budget", adminAuth, async (req: Request, res: Response) => {
  const { budgetQuotaUsd } = req.body as { budgetQuotaUsd: unknown };
  const val = Number(budgetQuotaUsd);
  if (!Number.isFinite(val) || val < 0 || val > MAX_BUDGET_USD) {
    res.status(400).json({ error: { message: `budgetQuotaUsd must be between 0 and ${MAX_BUDGET_USD}` } });
    return;
  }
  await updateConfig({ budgetQuotaUsd: val });
  res.json({ budgetQuotaUsd: val });
});

// ---------------------------------------------------------------------------
// Disguise mode settings
// ---------------------------------------------------------------------------

router.get("/settings/disguise", (_req, res) => {
  const config = getConfig();
  const preset = (config.settings.disguisePreset as DisguisePreset) || "none";
  // Profiles that are meta/special modes (dynamic resolution, no fixed headers)
  const SPECIAL_IDS = new Set(["auto", "auto-no-replit"]);
  res.json({
    preset,
    profiles: Object.entries(DISGUISE_PROFILES).map(([id, p]) => ({
      id,
      label: p.label,
      desc: p.desc,
      isSpecial: SPECIAL_IDS.has(id),
      // headers intentionally omitted — exposing full SDK fingerprint details
      // in a public endpoint would reveal the disguise strategy to observers.
    })),
  });
});

router.post("/settings/disguise", adminAuth, async (req: Request, res: Response) => {
  const { preset } = req.body as { preset: string };
  if (!preset || !Object.keys(DISGUISE_PROFILES).includes(preset)) {
    res.status(400).json({ error: { message: `Invalid preset. Valid values: ${Object.keys(DISGUISE_PROFILES).join(", ")}` } });
    return;
  }
  await updateConfig({ settings: { ...(getConfig().settings), disguisePreset: preset } });
  res.json({ preset });
});

export default router;
