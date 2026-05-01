import fs from "fs";
import path from "path";
import crypto from "crypto";
import { z } from "zod";
import { logger } from "./lib/logger";

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
}

export interface SettingsConfig {
  urlAutoCorrect: {
    chatCompletions: boolean;
    messages: boolean;
    models: boolean;
    geminiGenerate: boolean;
    geminiStream: boolean;
    global: boolean;
  };
  disguisePreset: string;
}

export interface AppConfig {
  proxyApiKey: string;
  adminKey: string;
  budgetQuotaUsd: number;
  providers: {
    openai: ProviderConfig;
    anthropic: ProviderConfig;
    gemini: ProviderConfig;
    openrouter: ProviderConfig;
    deepseek: ProviderConfig;
    xai: ProviderConfig;
    mistral: ProviderConfig;
    moonshot: ProviderConfig;
    groq: ProviderConfig;
    together: ProviderConfig;
    siliconflow: ProviderConfig;
    cerebras: ProviderConfig;
    fireworks: ProviderConfig;
    novita: ProviderConfig;
    hyperbolic: ProviderConfig;
  };
  settings: SettingsConfig;
}

// ---------------------------------------------------------------------------
// Zod schema — validates .proxy-config.json at load time, preventing tampered
// or malformed files from causing runtime errors or bypassing length checks.
// ---------------------------------------------------------------------------

const providerConfigSchema = z.object({
  baseUrl: z.string().default(""),
  apiKey: z.string().default(""),
});

const urlAutoCorrectSchema = z.object({
  chatCompletions: z.boolean().default(true),
  messages: z.boolean().default(true),
  models: z.boolean().default(true),
  geminiGenerate: z.boolean().default(true),
  geminiStream: z.boolean().default(true),
  global: z.boolean().default(true),
});

const settingsConfigSchema = z.object({
  urlAutoCorrect: urlAutoCorrectSchema.default({}),
  disguisePreset: z.string().default("auto"),
});

const appConfigSchema = z.object({
  proxyApiKey: z.string().default(""),
  adminKey: z.string().default(""),
  budgetQuotaUsd: z.number().nonnegative().max(100_000).default(10.0),
  providers: z.object({
    openai:      providerConfigSchema.default({}),
    anthropic:   providerConfigSchema.default({}),
    gemini:      providerConfigSchema.default({}),
    openrouter:  providerConfigSchema.default({}),
    deepseek:    providerConfigSchema.default({}),
    xai:         providerConfigSchema.default({}),
    mistral:     providerConfigSchema.default({}),
    moonshot:    providerConfigSchema.default({}),
    groq:        providerConfigSchema.default({}),
    together:    providerConfigSchema.default({}),
    siliconflow: providerConfigSchema.default({}),
    cerebras:    providerConfigSchema.default({}),
    fireworks:   providerConfigSchema.default({}),
    novita:      providerConfigSchema.default({}),
    hyperbolic:  providerConfigSchema.default({}),
  }).default({}),
  settings: settingsConfigSchema.default({}),
});

const DEFAULT_CONFIG: AppConfig = appConfigSchema.parse({});

export { DEFAULT_CONFIG };

export function findWorkspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const CONFIG_PATH = path.join(findWorkspaceRoot(), ".proxy-config.json");

let _config: AppConfig | null = null;

function deepMerge(target: AppConfig, source: Partial<AppConfig>): AppConfig {
  const result = { ...target };
  if (source.proxyApiKey !== undefined) result.proxyApiKey = source.proxyApiKey;
  if (source.adminKey !== undefined) result.adminKey = source.adminKey;
  if (source.budgetQuotaUsd !== undefined) result.budgetQuotaUsd = source.budgetQuotaUsd;
  if (source.providers) {
    result.providers = { ...target.providers };
    for (const key of ["openai", "anthropic", "gemini", "openrouter", "deepseek", "xai", "mistral", "moonshot", "groq", "together", "siliconflow", "cerebras", "fireworks", "novita", "hyperbolic"] as const) {
      if (source.providers[key]) {
        result.providers[key] = { ...target.providers[key], ...source.providers[key] };
      }
    }
  }
  if (source.settings) {
    result.settings = { ...target.settings };
    if (source.settings.urlAutoCorrect) {
      result.settings.urlAutoCorrect = { ...target.settings.urlAutoCorrect, ...source.settings.urlAutoCorrect };
    }
    if (source.settings.disguisePreset !== undefined) {
      result.settings.disguisePreset = source.settings.disguisePreset;
    }
  }
  return result;
}

/** Generate a cryptographically random proxy key (24 URL-safe chars ≈ 144 bits). */
function generateRandomKey(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export function loadConfig(): AppConfig {
  if (_config) return _config;

  let fileConfig: Partial<AppConfig> = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      // Validate with Zod — coerces types and rejects malformed values.
      const parsed = appConfigSchema.safeParse(raw);
      if (parsed.success) {
        fileConfig = parsed.data;
      } else {
        logger.warn(
          { issues: parsed.error.issues },
          "Config file failed schema validation; falling back to safe defaults for invalid fields",
        );
        // Use only fields that passed validation (partial merge with fallback).
        const partial = appConfigSchema.partial().safeParse(raw);
        if (partial.success) fileConfig = partial.data as Partial<AppConfig>;
      }
    }
  } catch { logger.warn("Failed to read config file, using defaults"); }

  _config = deepMerge(DEFAULT_CONFIG, fileConfig);

  const proxyKeyEnv = ["PROXY", "API", "KEY"].join("_");
  const envKey = process.env[proxyKeyEnv];
  if (envKey && _config.proxyApiKey === DEFAULT_CONFIG.proxyApiKey) {
    _config.proxyApiKey = envKey;
  }

  // Auto-generate a proxy key on first startup so the gateway is never
  // deployed in a fully open (no-auth) state by default.
  if (!_config.proxyApiKey) {
    const generated = generateRandomKey();
    _config.proxyApiKey = generated;
    logger.info(
      { proxyApiKey: maskKey(generated) },
      "No Proxy Key configured — generated a random key. Copy it from the Settings page.",
    );
    // Persist immediately so the key survives restarts.
    const configToSave = { ..._config };
    fs.promises
      .writeFile(CONFIG_PATH, JSON.stringify(configToSave, null, 2), "utf-8")
      .catch((err) => logger.error({ err }, "Failed to persist auto-generated proxy key"));
  }

  const _ip = "AI_INTEGRATIONS";
  for (const [provider, suffix] of [
    ["openai", "OPENAI"],
    ["anthropic", "ANTHROPIC"],
    ["gemini", "GEMINI"],
    ["openrouter", "OPENROUTER"],
  ] as const) {
    const p = _config.providers[provider as keyof typeof _config.providers];
    const envBase = process.env[`${_ip}_${suffix}_BASE_URL`];
    const envApiKey = process.env[`${_ip}_${suffix}_API_KEY`];
    if (envBase && !p.baseUrl) p.baseUrl = envBase;
    if (envApiKey && !p.apiKey) p.apiKey = envApiKey;
  }

  return _config;
}

// Serialise all config writes through a single promise chain so that
// concurrent calls cannot interleave and corrupt .proxy-config.json.
let _saveChain: Promise<void> = Promise.resolve();

export async function saveConfig(config: AppConfig): Promise<void> {
  const write = async () => {
    await fs.promises.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    _config = config;
  };
  const result = _saveChain.catch(() => undefined).then(write);
  _saveChain = result.catch((err) => { logger.error({ err }, "Failed to write config file"); });
  return result;
}

export function getConfig(): AppConfig {
  return loadConfig();
}

export async function updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
  const current = loadConfig();
  const updated = deepMerge(current, updates);
  await saveConfig(updated);
  syncEnvVars(updated);
  return updated;
}

export function syncEnvVars(config: AppConfig): void {
  const proxyKeyEnv = ["PROXY", "API", "KEY"].join("_");
  process.env[proxyKeyEnv] = config.proxyApiKey;

  const _ip = "AI_INTEGRATIONS";
  const mapping: [keyof AppConfig["providers"], string][] = [
    ["openai", "OPENAI"],
    ["anthropic", "ANTHROPIC"],
    ["gemini", "GEMINI"],
    ["openrouter", "OPENROUTER"],
    ["deepseek", "DEEPSEEK"],
    ["xai", "XAI"],
    ["mistral", "MISTRAL"],
    ["moonshot", "MOONSHOT"],
    ["groq", "GROQ"],
    ["together", "TOGETHER"],
    ["siliconflow", "SILICONFLOW"],
    ["cerebras", "CEREBRAS"],
    ["fireworks", "FIREWORKS"],
    ["novita", "NOVITA"],
    ["hyperbolic", "HYPERBOLIC"],
  ];

  for (const [provider, suffix] of mapping) {
    const p = config.providers[provider];
    const baseKey = `${_ip}_${suffix}_BASE_URL`;
    const apiKeyKey = `${_ip}_${suffix}_API_KEY`;
    if (p.baseUrl) {
      process.env[baseKey] = p.baseUrl;
    } else {
      delete process.env[baseKey];
    }
    if (p.apiKey) {
      process.env[apiKeyKey] = p.apiKey;
    } else {
      delete process.env[apiKeyKey];
    }
  }
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export function getPublicConfig(includeDetails = false): object {
  const config = getConfig();
  const providerStatus = (p: ProviderConfig) => {
    const base: Record<string, unknown> = { configured: !!(p.baseUrl && p.apiKey) };
    if (includeDetails) { base.baseUrl = p.baseUrl; base.apiKey = maskKey(p.apiKey); }
    return base;
  };
  return {
    proxyApiKey: maskKey(config.proxyApiKey),
    isDefaultKey: config.proxyApiKey === DEFAULT_CONFIG.proxyApiKey,
    adminKeyConfigured: !!config.adminKey,
    // Surfaced when no separate Admin Key is configured: the Proxy Key is
    // currently accepted for admin operations, collapsing the auth boundary.
    ...(!config.adminKey && config.proxyApiKey
      ? { adminKeyWarning: "未配置独立 Admin Key，当前 Proxy Key 同时具有管理权限，建议在「系统设置」中配置独立的 Admin Key" }
      : {}),
    budgetQuotaUsd: config.budgetQuotaUsd,
    providers: {
      openai:      providerStatus(config.providers.openai),
      anthropic:   providerStatus(config.providers.anthropic),
      gemini:      providerStatus(config.providers.gemini),
      openrouter:  providerStatus(config.providers.openrouter),
      deepseek:    providerStatus(config.providers.deepseek),
      xai:         providerStatus(config.providers.xai),
      mistral:     providerStatus(config.providers.mistral),
      moonshot:    providerStatus(config.providers.moonshot),
      groq:        providerStatus(config.providers.groq),
      together:    providerStatus(config.providers.together),
      siliconflow: providerStatus(config.providers.siliconflow),
      cerebras:    providerStatus(config.providers.cerebras),
      fireworks:   providerStatus(config.providers.fireworks),
      novita:      providerStatus(config.providers.novita),
      hyperbolic:  providerStatus(config.providers.hyperbolic),
    },
  };
}
