import fs from "fs";
import path from "path";
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
  budgetQuotaUsd: number;   // session spend limit in USD; warn at 80%, hard-alert at 100%
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

const DEFAULT_CONFIG: AppConfig = {
  proxyApiKey: "",
  adminKey: "",
  budgetQuotaUsd: 10.0,
  providers: {
    openai:      { baseUrl: "", apiKey: "" },
    anthropic:   { baseUrl: "", apiKey: "" },
    gemini:      { baseUrl: "", apiKey: "" },
    openrouter:  { baseUrl: "", apiKey: "" },
    deepseek:    { baseUrl: "", apiKey: "" },
    xai:         { baseUrl: "", apiKey: "" },
    mistral:     { baseUrl: "", apiKey: "" },
    moonshot:    { baseUrl: "", apiKey: "" },
    groq:        { baseUrl: "", apiKey: "" },
    together:    { baseUrl: "", apiKey: "" },
    siliconflow: { baseUrl: "", apiKey: "" },
    cerebras:    { baseUrl: "", apiKey: "" },
    fireworks:   { baseUrl: "", apiKey: "" },
    novita:      { baseUrl: "", apiKey: "" },
    hyperbolic:  { baseUrl: "", apiKey: "" },
  },
  settings: {
    urlAutoCorrect: {
      chatCompletions: true,
      messages: true,
      models: true,
      geminiGenerate: true,
      geminiStream: true,
      global: true,
    },
    disguisePreset: "auto",
  },
};

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

export function loadConfig(): AppConfig {
  if (_config) return _config;

  let fileConfig: Partial<AppConfig> = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch { logger.warn("Failed to read config file, using defaults"); }

  _config = deepMerge(DEFAULT_CONFIG, fileConfig);

  const proxyKeyEnv = ["PROXY", "API", "KEY"].join("_");
  const envKey = process.env[proxyKeyEnv];
  if (envKey && _config.proxyApiKey === DEFAULT_CONFIG.proxyApiKey) {
    _config.proxyApiKey = envKey;
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
  // DeepSeek uses user-provided credentials (no Replit integration).
  // Its default Base URL is maintained in PROVIDER_DEFAULTS in proxy-raw.ts,
  // not here, so no default assignment is needed.

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
