import { getConfig } from "../config";
import type { ProviderType } from "./providers";

export type DisguisePreset =
  | "none"
  | "auto"
  | "auto-no-replit"
  | "openai-sdk"
  | "openai-sdk-py"
  | "openai-sdk-py-async"
  | "openai-sdk-bun"
  | "openai-sdk-deno"
  | "anthropic-sdk"
  | "anthropic-sdk-py"
  | "anthropic-sdk-py-async"
  | "anthropic-sdk-bun"
  | "gemini-sdk"
  | "gemini-sdk-py"
  | "openrouter-sdk"
  | "litellm"
  | "vercel-ai-sdk"
  | "httpx"
  | "curl"
  | "python-requests"
  | "browser-chrome";

export interface DisguiseProfile {
  label: string;
  desc: string;
  headers: Record<string, string>;
  strip: string[];
}

const NODE_VERSION = process.version;

const PLATFORM = (() => {
  switch (process.platform) {
    case "darwin": return "macOS";
    case "win32": return "Windows";
    default: return "Linux";
  }
})();

const ARCH = (() => {
  switch (process.arch) {
    case "arm64": return "arm64";
    case "arm": return "arm";
    case "ia32": return "x86";
    default: return "x64";
  }
})();

const PYTHON_VERSION = "3.12.13";

// ---------------------------------------------------------------------------
// Replit environment metadata headers
// Present whenever the gateway runs inside a Replit container.
// Spread into every SDK-based preset so all outbound requests carry the
// Replit identity regardless of which SDK fingerprint is active.
// CLI/browser presets (curl, python-requests, browser-chrome, httpx) are
// intentionally excluded — those tools never carry this header in the wild.
// ---------------------------------------------------------------------------

const REPLIT_HEADERS: Record<string, string> = {
  ...(process.env.REPL_ID ? { "x-replit-repl-id": process.env.REPL_ID } : {}),
  ...(process.env.REPLIT_SUBCLUSTER ? { "x-replit-cluster": process.env.REPLIT_SUBCLUSTER } : {}),
};

// ---------------------------------------------------------------------------
// Strip lists
// ---------------------------------------------------------------------------

// Headers injected by reverse proxies, CDNs, and load balancers that can
// reveal the request was forwarded through an intermediate layer.
const COMMON_PROXY_STRIP = [
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-forwarded-server",
  "x-real-ip",
  "x-real-port",
  "via",
  "forwarded",
  "x-proxy-id",
  "x-request-id",
  "cf-connecting-ip",
  "cf-ray",
  "x-amzn-trace-id",
  "true-client-ip",
  "x-cluster-client-ip",
  "cdn-loop",
  // W3C distributed tracing headers — can expose proxy chains
  "traceparent",
  "tracestate",
  "baggage",
  // Zipkin/B3 tracing
  "x-b3-traceid",
  "x-b3-spanid",
  "x-b3-parentspanid",
  "x-b3-sampled",
  "x-b3-flags",
];

// Additional headers that browser fetch() adds but no SDK/CLI tool sends.
const BROWSER_ONLY_STRIP = [
  "origin",
  "referer",
  "priority",
  "sec-purpose",
  "purpose",
  "x-requested-with",
];

const BROWSER_STRIP = [
  ...COMMON_PROXY_STRIP,
  ...BROWSER_ONLY_STRIP,
];

// Everything a browser adds, plus sec-fetch-* headers.
const SDK_STRIP = [
  ...COMMON_PROXY_STRIP,
  ...BROWSER_ONLY_STRIP,
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-dest",
  "te",
];

// For curl / python-requests disguise: also strip stainless SDK headers that
// the real incoming request might already carry (e.g., if the caller used an
// OpenAI SDK and we want to re-disguise as curl).
const CURL_EXTRA_STRIP = [
  "x-stainless-lang",
  "x-stainless-package-version",
  "x-stainless-os",
  "x-stainless-arch",
  "x-stainless-runtime",
  "x-stainless-runtime-version",
  "x-stainless-retry-count",
  "x-stainless-async",
  "x-stainless-helper-method",
  "x-stainless-timeout",
  "anthropic-version",
  "x-goog-api-client",
];

// Also used by gemini-sdk-py: strips x-goog-api-client so the profile can
// re-inject the correct Python SDK fingerprint (genai-py/... vs genai-js/...).
const CLI_STRIP = [
  ...COMMON_PROXY_STRIP,
  ...BROWSER_ONLY_STRIP,
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-dest",
  ...CURL_EXTRA_STRIP,
];

// ---------------------------------------------------------------------------
// Provider → preset mapping
// ---------------------------------------------------------------------------

const PROVIDER_PRESET_MAP: Record<ProviderType, DisguisePreset> = {
  openai:      "openai-sdk",
  anthropic:   "anthropic-sdk",
  gemini:      "gemini-sdk",
  openrouter:  "openrouter-sdk",
  deepseek:    "openai-sdk",
  xai:         "openai-sdk",
  mistral:     "openai-sdk",
  moonshot:    "openai-sdk",
  groq:        "openai-sdk",
  together:    "openai-sdk",
  siliconflow: "openai-sdk",
  cerebras:    "openai-sdk",
  fireworks:   "openai-sdk",
  novita:      "openai-sdk",
  hyperbolic:  "openai-sdk",
};

/**
 * Resolve which disguise preset to use for `auto` / `auto-no-replit` mode.
 *
 * Resolution order (highest priority first):
 * 1. requestPath — /v1/messages → anthropic-sdk; Gemini native endpoints → gemini-sdk
 * 2. incomingUserAgent — Bun/Deno/python-httpx runtime detection for variant presets
 * 3. provider mapping via PROVIDER_PRESET_MAP
 */
export function resolvePresetForProvider(
  provider: ProviderType,
  requestPath?: string,
  incomingUserAgent?: string,
): DisguisePreset {
  if (requestPath) {
    if (requestPath.includes("/messages")) {
      if (incomingUserAgent?.includes("Bun/")) return "anthropic-sdk-bun";
      return "anthropic-sdk";
    }
    if (requestPath.includes(":generateContent") || requestPath.includes(":streamGenerateContent")) {
      if (incomingUserAgent?.includes("python-httpx")) return "gemini-sdk-py";
      return "gemini-sdk";
    }
  }
  // Runtime UA sniffing: detect Bun / Deno / Python httpx variant presets
  if (incomingUserAgent?.includes("Deno/")) return "openai-sdk-deno";
  if (incomingUserAgent?.includes("Bun/")) {
    if (provider === "anthropic") return "anthropic-sdk-bun";
    return "openai-sdk-bun";
  }
  if (incomingUserAgent?.includes("python-httpx")) {
    if (provider === "gemini") return "gemini-sdk-py";
    if (provider === "anthropic") return "anthropic-sdk-py";
    return "openai-sdk-py";
  }
  return PROVIDER_PRESET_MAP[provider] ?? "openai-sdk";
}

export function getDisguiseHeadersForProvider(
  provider: ProviderType,
  requestPath?: string,
  incomingUserAgent?: string,
): Record<string, string> {
  const raw = getActiveDisguise();
  if (raw === "none") return {};
  if (raw === "auto-no-replit") {
    const resolved = resolvePresetForProvider(provider, requestPath, incomingUserAgent);
    return buildDisguiseHeaders(resolved, {}, { skipReplitHeaders: true });
  }
  const resolved = raw === "auto" ? resolvePresetForProvider(provider, requestPath, incomingUserAgent) : raw;
  return buildDisguiseHeaders(resolved);
}

/** Returns true when any disguise preset (other than "none") is currently active. */
export function isDisguiseActive(): boolean {
  return getActiveDisguise() !== "none";
}

// ---------------------------------------------------------------------------
// Profile definitions
// ---------------------------------------------------------------------------

export const DISGUISE_PROFILES: Record<DisguisePreset, DisguiseProfile> = {
  none: {
    label: "不伪装",
    desc: "使用原始请求头，不做任何修改",
    headers: {},
    strip: [],
  },

  auto: {
    label: "自动（推荐）",
    desc: "综合考虑入站请求路径与目标服务商，自动选择最匹配的 SDK 请求头，并为 SDK 类伪装自动注入 Replit 环境标识（x-replit-repl-id / x-replit-cluster）",
    headers: {},
    strip: [],
  },

  "auto-no-replit": {
    label: "自动（不含 Replit Headers）",
    desc: "与「自动」相同的智能路由逻辑，但不注入任何 Replit 专属 Headers（x-replit-repl-id / x-replit-cluster），适用于需要完全隐藏 Replit 环境信息的场景",
    headers: {},
    strip: [],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Stainless-based Node.js SDKs
  // All stainless-ts SDKs emit x-stainless-async: "false" in Node.js context.
  // ──────────────────────────────────────────────────────────────────────────

  "openai-sdk": {
    label: "OpenAI SDK (Node.js)",
    desc: "伪装为官方 OpenAI Node.js SDK 请求（openai@6.35.0）",
    headers: {
      "user-agent": "OpenAI/JS 6.35.0",
      "x-stainless-lang": "js",
      "x-stainless-package-version": "6.35.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "node",
      "x-stainless-runtime-version": NODE_VERSION,
      "x-stainless-async": "false",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Stainless-based Python SDKs
  // Python httpx sync client → x-stainless-async: "false"
  // Python httpx async client → x-stainless-async: "async"
  // We default to "false" (sync, the most common scripting pattern).
  // ──────────────────────────────────────────────────────────────────────────

  "openai-sdk-py": {
    label: "OpenAI SDK (Python)",
    desc: "伪装为官方 OpenAI Python SDK 请求（openai==2.33.0，同步客户端）",
    headers: {
      "user-agent": "OpenAI/Python 2.33.0",
      "x-stainless-lang": "python",
      "x-stainless-package-version": "2.33.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "CPython",
      "x-stainless-runtime-version": PYTHON_VERSION,
      "x-stainless-async": "false",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  "anthropic-sdk": {
    label: "Anthropic SDK (Node.js)",
    desc: "伪装为官方 Anthropic Node.js SDK 请求（@anthropic-ai/sdk@0.92.0）",
    headers: {
      "user-agent": "Anthropic/JS 0.92.0",
      "anthropic-version": "2023-06-01",
      "x-stainless-lang": "js",
      "x-stainless-package-version": "0.92.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "node",
      "x-stainless-runtime-version": NODE_VERSION,
      "x-stainless-async": "false",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  "anthropic-sdk-py": {
    label: "Anthropic SDK (Python)",
    desc: "伪装为官方 Anthropic Python SDK 请求（anthropic==0.97.0，同步客户端）",
    headers: {
      "user-agent": "Anthropic/Python 0.97.0",
      "anthropic-version": "2023-06-01",
      "x-stainless-lang": "python",
      "x-stainless-package-version": "0.97.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "CPython",
      "x-stainless-runtime-version": PYTHON_VERSION,
      "x-stainless-async": "false",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Python async variants — same as sync but x-stainless-async: "async"
  // Covers asyncio-based frameworks: FastAPI, LangChain, CrewAI, etc.
  // ──────────────────────────────────────────────────────────────────────────

  "openai-sdk-py-async": {
    label: "OpenAI SDK (Python, async)",
    desc: "伪装为官方 OpenAI Python SDK 异步客户端请求（openai==2.33.0，AsyncOpenAI）",
    headers: {
      "user-agent": "OpenAI/Python 2.33.0",
      "x-stainless-lang": "python",
      "x-stainless-package-version": "2.33.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "CPython",
      "x-stainless-runtime-version": PYTHON_VERSION,
      "x-stainless-async": "async",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Bun runtime — stainless-ts SDKs running under Bun identify with
  // x-stainless-runtime: "bun" and use Bun's own version string.
  // ──────────────────────────────────────────────────────────────────────────

  "openai-sdk-bun": {
    label: "OpenAI SDK (Bun)",
    desc: "伪装为官方 OpenAI Node.js SDK 在 Bun 运行时发出的请求（openai@6.35.0，bun@1.3.13）",
    headers: {
      "user-agent": "OpenAI/JS 6.35.0",
      "x-stainless-lang": "js",
      "x-stainless-package-version": "6.35.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "bun",
      "x-stainless-runtime-version": "1.3.13",
      "x-stainless-async": "false",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Deno runtime — stainless-ts SDKs running under Deno identify with
  // x-stainless-runtime: "deno" and use Deno's own version string.
  // Deno's built-in fetch also sets a "Deno/<version>" User-Agent.
  // ──────────────────────────────────────────────────────────────────────────

  "openai-sdk-deno": {
    label: "OpenAI SDK (Deno)",
    desc: "伪装为官方 OpenAI Node.js SDK 在 Deno 运行时发出的请求（openai@6.35.0，deno@2.7.14）",
    headers: {
      "user-agent": "Deno/2.7.14",
      "x-stainless-lang": "js",
      "x-stainless-package-version": "6.35.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "deno",
      "x-stainless-runtime-version": "2.7.14",
      "x-stainless-async": "false",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  "anthropic-sdk-py-async": {
    label: "Anthropic SDK (Python, async)",
    desc: "伪装为官方 Anthropic Python SDK 异步客户端请求（anthropic==0.97.0，AsyncAnthropic）",
    headers: {
      "user-agent": "Anthropic/Python 0.97.0",
      "anthropic-version": "2023-06-01",
      "x-stainless-lang": "python",
      "x-stainless-package-version": "0.97.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "CPython",
      "x-stainless-runtime-version": PYTHON_VERSION,
      "x-stainless-async": "async",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Anthropic SDK in Bun runtime — same stainless-ts fingerprint, different
  // x-stainless-runtime / x-stainless-runtime-version values.
  // ──────────────────────────────────────────────────────────────────────────

  "anthropic-sdk-bun": {
    label: "Anthropic SDK (Bun)",
    desc: "伪装为官方 Anthropic Node.js SDK 在 Bun 运行时发出的请求（@anthropic-ai/sdk@0.92.0，bun@1.3.13）",
    headers: {
      "user-agent": "Anthropic/JS 0.92.0",
      "anthropic-version": "2023-06-01",
      "x-stainless-lang": "js",
      "x-stainless-package-version": "0.92.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "bun",
      "x-stainless-runtime-version": "1.3.13",
      "x-stainless-async": "false",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Google GenAI SDK — does NOT use stainless, uses google-auth-library
  // ──────────────────────────────────────────────────────────────────────────

  "gemini-sdk": {
    label: "Google GenAI SDK (Node.js)",
    desc: "伪装为官方 Google Generative AI Node.js SDK 请求（@google/genai@1.51.0）",
    headers: {
      "user-agent": `google-genai-sdk/1.51.0 gl-node/${NODE_VERSION}`,
      "x-goog-api-client": `genai-js/1.51.0 gl-node/${NODE_VERSION}`,
      "accept": "application/json, text/event-stream",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Google GenAI Python SDK — uses httpx instead of google-auth-library,
  // produces a distinct fingerprint: user-agent is "python-httpx/<ver>" and
  // x-goog-api-client uses "genai-py/<ver> gl-python/<ver>" instead of
  // "genai-js/<ver> gl-node/<ver>". No brotli by default (httpx without brotli
  // extra installed uses "gzip, deflate" only).
  // ──────────────────────────────────────────────────────────────────────────

  "gemini-sdk-py": {
    label: "Google GenAI SDK (Python)",
    desc: "伪装为官方 Google Generative AI Python SDK 请求（google-genai==1.74.0），使用 httpx/0.28.1 作为底层客户端",
    headers: {
      "user-agent": "python-httpx/0.28.1",
      "x-goog-api-client": `genai-py/1.74.0 gl-python/${PYTHON_VERSION} httpx/0.28.1`,
      "accept": "application/json",
      "accept-encoding": "gzip, deflate",
      "connection": "keep-alive",
    },
    strip: CLI_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // OpenRouter — built on top of the OpenAI Node.js SDK (stainless-ts)
  // ──────────────────────────────────────────────────────────────────────────

  "openrouter-sdk": {
    label: "OpenRouter (Node.js)",
    desc: "伪装为通过 OpenRouter 官方客户端发出的 Node.js 请求",
    headers: {
      "user-agent": "OpenAI/JS 6.35.0",
      "x-stainless-lang": "js",
      "x-stainless-package-version": "6.35.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "node",
      "x-stainless-runtime-version": NODE_VERSION,
      "x-stainless-async": "false",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "HTTP-Referer": "https://openrouter.ai",
      "X-Title": "OpenRouter Playground",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // LiteLLM — uses the OpenAI Python SDK (stainless-py) internally via httpx
  // x-stainless-package-version reflects litellm's pinned openai dependency.
  // ──────────────────────────────────────────────────────────────────────────

  "litellm": {
    label: "LiteLLM",
    desc: "伪装为 LiteLLM 代理发出的请求（litellm==1.83.14，openai==2.24.0）",
    headers: {
      "user-agent": "litellm/1.83.14",
      "x-stainless-lang": "python",
      "x-stainless-package-version": "2.24.0",
      "x-stainless-os": PLATFORM,
      "x-stainless-arch": ARCH,
      "x-stainless-runtime": "CPython",
      "x-stainless-runtime-version": PYTHON_VERSION,
      "x-stainless-async": "false",
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "600000",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: SDK_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Vercel AI SDK v6 — uses Node.js native fetch (undici) which does NOT set
  // a User-Agent. We strip any incoming user-agent to match this behaviour.
  // ──────────────────────────────────────────────────────────────────────────

  "vercel-ai-sdk": {
    label: "Vercel AI SDK",
    desc: "伪装为 Vercel AI SDK 发出的 Node.js 请求（ai@6.0.170，使用 Node.js 原生 fetch，不携带 user-agent）",
    headers: {
      "accept": "application/json, text/event-stream",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: [...SDK_STRIP, "user-agent"],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Python httpx — direct HTTP client used by LangChain, LlamaIndex, CrewAI
  // when not going through stainless-py wrappers. No x-stainless-* headers.
  // ──────────────────────────────────────────────────────────────────────────

  httpx: {
    label: "Python httpx",
    desc: "伪装为 Python httpx 库直接发出的请求（httpx==0.28.1），常见于 LangChain、LlamaIndex、CrewAI 等框架",
    headers: {
      "user-agent": "python-httpx/0.28.1",
      "accept": "application/json",
      "accept-encoding": "gzip, deflate, br",
      "connection": "keep-alive",
    },
    strip: CLI_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CLI tools — strip any SDK-specific headers the caller may have sent
  // ──────────────────────────────────────────────────────────────────────────

  curl: {
    label: "curl",
    desc: "伪装为 curl 命令行工具请求（curl/8.20.0）",
    headers: {
      "user-agent": "curl/8.20.0",
      "accept": "*/*",
      "connection": "keep-alive",
    },
    strip: CLI_STRIP,
  },

  "python-requests": {
    label: "Python requests",
    desc: "伪装为 Python requests 库发出的请求（requests==2.33.1）",
    headers: {
      "user-agent": "python-requests/2.33.1",
      "accept-encoding": "gzip, deflate, br",
      "accept": "*/*",
      "connection": "keep-alive",
    },
    strip: CLI_STRIP,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Browser — Chrome 147 fetch() pattern (Stable; 148 is currently in Beta)
  // ──────────────────────────────────────────────────────────────────────────

  "browser-chrome": {
    label: "Chrome 浏览器",
    desc: "伪装为 Chrome 147 浏览器通过 fetch() 发出的请求",
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      "accept": "application/json, text/event-stream, */*",
      "accept-encoding": "gzip, deflate, br, zstd",
      "accept-language": "en-US,en;q=0.9",
      "sec-ch-ua": `"Chromium";v="147", "Google Chrome";v="147", "Not-A.Brand";v="24"`,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": `"Windows"`,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site",
      "connection": "keep-alive",
    },
    strip: BROWSER_STRIP,
  },
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export function getActiveDisguise(): DisguisePreset {
  try {
    const cfg = getConfig();
    return (cfg.settings.disguisePreset as DisguisePreset) || "none";
  } catch {
    return "none";
  }
}

// CLI and browser presets mimic tools that run outside Replit and would
// never carry Replit-specific env headers. All other (SDK-based) presets
// get REPLIT_HEADERS injected automatically.
// "auto-no-replit" is excluded here because its Replit header skip is handled
// explicitly in applyDisguiseToFetch / buildDisguiseHeaders.
const NON_SDK_PRESETS = new Set<DisguisePreset>(["none", "auto", "auto-no-replit", "curl", "python-requests", "browser-chrome", "httpx"]);

export function buildDisguiseHeaders(
  preset: DisguisePreset,
  base: Record<string, string> = {},
  options?: { skipReplitHeaders?: boolean },
): Record<string, string> {
  // Meta presets must be resolved by callers before reaching here.
  if (preset === "none" || preset === "auto" || preset === "auto-no-replit") return base;
  const profile = DISGUISE_PROFILES[preset];
  if (!profile) return base;

  const result: Record<string, string> = { ...base };

  // Strip list entries are lowercase literals; we must match case-insensitively
  // against result keys (which may carry the original casing from requiredHeaders
  // or profile injection). A plain `delete result[key]` would miss "Accept-Encoding"
  // if the strip list has "accept-encoding".
  for (const stripKey of profile.strip) {
    const lowerStrip = stripKey.toLowerCase();
    for (const resultKey of Object.keys(result)) {
      if (resultKey.toLowerCase() === lowerStrip) delete result[resultKey];
    }
  }

  for (const [k, v] of Object.entries(profile.headers)) {
    result[k] = v;
  }

  // Inject Replit environment metadata into SDK-based presets.
  // - skipReplitHeaders (auto-no-replit mode): never inject
  // - default: inject only for SDK-based presets (not CLI/browser)
  const shouldInjectReplit = options?.skipReplitHeaders ? false : !NON_SDK_PRESETS.has(preset);

  if (shouldInjectReplit) {
    for (const [k, v] of Object.entries(REPLIT_HEADERS)) {
      result[k] = v;
    }
  }

  return result;
}

export function applyDisguiseToFetch(
  init: RequestInit,
  overridePreset?: DisguisePreset,
  provider?: ProviderType,
  requestPath?: string,
  incomingUserAgent?: string,
): RequestInit {
  const rawPreset = overridePreset ?? getActiveDisguise();
  if (rawPreset === "none") return init;

  // Resolve meta-presets to a concrete profile preset, carrying extra flags.
  let preset: DisguisePreset;
  let skipReplitHeaders = false;

  if (rawPreset === "auto-no-replit") {
    // Auto-resolve without any Replit headers.
    preset = provider ? resolvePresetForProvider(provider, requestPath, incomingUserAgent) : "openai-sdk";
    skipReplitHeaders = true;
  } else if (rawPreset === "auto") {
    // Auto-resolve with Replit headers for SDK presets (default behaviour).
    preset = provider ? resolvePresetForProvider(provider, requestPath, incomingUserAgent) : "openai-sdk";
  } else {
    preset = rawPreset;
  }

  const baseHeaders: Record<string, string> = {};
  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => { baseHeaders[k] = v; });
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) baseHeaders[k] = v;
    } else {
      Object.assign(baseHeaders, init.headers);
    }
  }

  return {
    ...init,
    headers: buildDisguiseHeaders(preset, baseHeaders, { skipReplitHeaders }),
  };
}
