import { Router, type Request, type Response } from "express";
import { adminAuth } from "../lib/auth";
import { getConfig } from "../config";
import { readAllUsageLogs, getSessionStats, getUsageLogVersion, SERVER_START_MS, type UsageLogEntry } from "./usage-logs";

const router = Router();

// ---------------------------------------------------------------------------
// Model pricing table (USD per 1M tokens, updated 2026-04)
//
// ⚠️  MAINTENANCE RULE — READ BEFORE EDITING:
//   Before adding or changing ANY price, you MUST do a live web search to
//   verify the official provider pricing page. Never guess or copy from
//   memory. Official source URLs are listed in /MAINTENANCE.md §一.
//
//   Pattern ordering: more-specific patterns MUST come BEFORE less-specific
//   ones (e.g. "claude-opus-4-7" before "claude-opus-4"), or the broad
//   pattern will match first and the specific one will never be reached.
// ---------------------------------------------------------------------------
interface ModelPrice {
  inputPer1M: number;
  outputPer1M: number;
}

const PRICING_TABLE: Array<{ match: string; price: ModelPrice }> = [
  // ── Provider-namespaced exact matches (MUST be first; beats generic includes) ──
  // Together AI (source: api.together.ai/models, April 2026)
  { match: "together/meta-llama/llama-4-maverick-17b-128e-instruct-fp8", price: { inputPer1M: 0.27, outputPer1M: 0.85   } },
  { match: "together/meta-llama/llama-4-scout-17b-16e-instruct",         price: { inputPer1M: 0.18, outputPer1M: 0.59   } },
  { match: "together/meta-llama/meta-llama-3.3-70b-instruct-turbo",      price: { inputPer1M: 0.88, outputPer1M: 0.88   } },
  { match: "together/meta-llama/meta-llama-3.1-405b-instruct-turbo",     price: { inputPer1M: 3.50, outputPer1M: 3.50   } },
  { match: "together/meta-llama/meta-llama-3.1-70b-instruct-turbo",      price: { inputPer1M: 0.88, outputPer1M: 0.88   } },
  { match: "together/meta-llama/meta-llama-3.1-8b-instruct-turbo",       price: { inputPer1M: 0.18, outputPer1M: 0.18   } },
  { match: "together/deepseek-ai/deepseek-r1",                           price: { inputPer1M: 7.00, outputPer1M: 7.00   } },
  { match: "together/deepseek-ai/deepseek-v3",                           price: { inputPer1M: 1.25, outputPer1M: 1.25   } },
  { match: "together/qwen/qwen2.5-72b-instruct-turbo",                   price: { inputPer1M: 1.20, outputPer1M: 1.20   } },
  { match: "together/qwen/qwq-32b",                                      price: { inputPer1M: 0.90, outputPer1M: 0.90   } },
  { match: "together/mistralai/mixtral-8x22b-instruct-v0.1",             price: { inputPer1M: 1.20, outputPer1M: 1.20   } },
  { match: "together/mistralai/mixtral-8x7b-instruct-v0.1",              price: { inputPer1M: 0.60, outputPer1M: 0.60   } },
  // Groq (namespace-prefixed, provider-specific; source: groq.com/pricing, April 2026)
  { match: "groq/qwen/qwen3-32b",                                        price: { inputPer1M: 0.29, outputPer1M: 0.59   } },
  { match: "groq/openai/gpt-oss-120b",                                   price: { inputPer1M: 0.15, outputPer1M: 0.60   } },
  { match: "groq/openai/gpt-oss-20b",                                    price: { inputPer1M: 0.075,outputPer1M: 0.30   } },
  { match: "groq/qwen-qwq-32b",                                          price: { inputPer1M: 0.29, outputPer1M: 0.39   } },
  { match: "groq/llama-4-maverick",                                      price: { inputPer1M: 0.50, outputPer1M: 0.77   } },
  { match: "groq/llama-4-scout",                                         price: { inputPer1M: 0.11, outputPer1M: 0.34   } },
  { match: "groq/llama-3.3-70b",                                         price: { inputPer1M: 0.59, outputPer1M: 0.79   } },
  { match: "groq/llama-3.1-70b",                                         price: { inputPer1M: 0.59, outputPer1M: 0.79   } },
  { match: "groq/llama-3.1-8b",                                          price: { inputPer1M: 0.05, outputPer1M: 0.08   } },
  { match: "groq/deepseek-r1-distill-llama-70b",                         price: { inputPer1M: 0.75, outputPer1M: 0.99   } },
  { match: "groq/deepseek-r1-distill-qwen-32b",                          price: { inputPer1M: 0.69, outputPer1M: 0.69   } },
  // Cerebras (source: cloud.cerebras.ai/pricing, April 2026)
  { match: "cerebras/llama3.3-70b",                                      price: { inputPer1M: 0.60, outputPer1M: 0.60   } },
  { match: "cerebras/llama3.1-8b",                                       price: { inputPer1M: 0.10, outputPer1M: 0.10   } },
  // Hyperbolic (source: docs.hyperbolic.xyz, April 2026)
  { match: "hyperbolic/meta-llama/llama-3.3-70b",                        price: { inputPer1M: 0.40, outputPer1M: 0.40   } },
  { match: "hyperbolic/meta-llama/meta-llama-3.1-405b",                  price: { inputPer1M: 4.00, outputPer1M: 4.00   } },
  { match: "hyperbolic/deepseek-ai/deepseek-r1",                         price: { inputPer1M: 3.00, outputPer1M: 3.00   } },
  { match: "hyperbolic/deepseek-ai/deepseek-v3",                         price: { inputPer1M: 0.20, outputPer1M: 0.20   } },
  // SiliconFlow (source: siliconflow.cn, April 2026)
  { match: "siliconflow/deepseek-ai/deepseek-r1",                        price: { inputPer1M: 0.55, outputPer1M: 2.19   } },
  { match: "siliconflow/deepseek-ai/deepseek-v3",                        price: { inputPer1M: 0.28, outputPer1M: 0.28   } },
  // Novita (source: novita.ai/llm-api/pricing, April 2026)
  { match: "novita/deepseek/deepseek-r1",                                price: { inputPer1M: 0.55, outputPer1M: 2.19   } },
  { match: "novita/deepseek/deepseek-v3",                                price: { inputPer1M: 0.28, outputPer1M: 0.28   } },

  // ── OpenRouter exclusive owner namespaces ─────────────────────────────────
  // Source: openrouter.ai/api/v1/models live API (2026-04-21 audit)
  // Patterns are owner-prefixed (e.g. "cohere/command-r") so they never match
  // direct-provider models. Specifics MUST come BEFORE generics within each
  // owner block.

  // Cohere Command
  { match: "cohere/command-a",                                           price: { inputPer1M: 2.50, outputPer1M: 10.00  } },
  { match: "cohere/command-r-plus",                                      price: { inputPer1M: 2.50, outputPer1M: 10.00  } },
  { match: "cohere/command-r7b",                                         price: { inputPer1M: 0.0375, outputPer1M: 0.15 } },
  { match: "cohere/command-r",                                           price: { inputPer1M: 0.15, outputPer1M: 0.60   } },

  // Perplexity Sonar
  { match: "perplexity/sonar-pro-search",                                price: { inputPer1M: 3.00, outputPer1M: 15.00  } },
  { match: "perplexity/sonar-reasoning-pro",                             price: { inputPer1M: 2.00, outputPer1M: 8.00   } },
  { match: "perplexity/sonar-deep-research",                             price: { inputPer1M: 2.00, outputPer1M: 8.00   } },
  { match: "perplexity/sonar-pro",                                       price: { inputPer1M: 3.00, outputPer1M: 15.00  } },
  { match: "perplexity/sonar",                                           price: { inputPer1M: 1.00, outputPer1M: 1.00   } },

  // NVIDIA Nemotron
  { match: "nvidia/llama-3.3-nemotron-super-49b",                        price: { inputPer1M: 0.10, outputPer1M: 0.40   } },
  { match: "nvidia/llama-3.1-nemotron-70b",                              price: { inputPer1M: 1.20, outputPer1M: 1.20   } },
  { match: "nvidia/nemotron-3-super-120b",                               price: { inputPer1M: 0.09, outputPer1M: 0.45   } },
  { match: "nvidia/nemotron-3-nano-30b",                                 price: { inputPer1M: 0.05, outputPer1M: 0.20   } },
  { match: "nvidia/nemotron-nano-12b",                                   price: { inputPer1M: 0.20, outputPer1M: 0.60   } },
  { match: "nvidia/nemotron-nano-9b",                                    price: { inputPer1M: 0.04, outputPer1M: 0.16   } },

  // Amazon Nova
  { match: "amazon/nova-premier",                                        price: { inputPer1M: 2.50, outputPer1M: 12.50  } },
  { match: "amazon/nova-2-lite",                                         price: { inputPer1M: 0.30, outputPer1M: 2.50   } },
  { match: "amazon/nova-pro",                                            price: { inputPer1M: 0.80, outputPer1M: 3.20   } },
  { match: "amazon/nova-lite",                                           price: { inputPer1M: 0.06, outputPer1M: 0.24   } },
  { match: "amazon/nova-micro",                                          price: { inputPer1M: 0.035,outputPer1M: 0.14   } },

  // AI21 Jamba
  { match: "ai21/jamba-large",                                           price: { inputPer1M: 2.00, outputPer1M: 8.00   } },

  // Microsoft (Phi, WizardLM)
  { match: "microsoft/wizardlm-2-8x22b",                                 price: { inputPer1M: 0.62, outputPer1M: 0.62   } },
  { match: "microsoft/phi-4",                                            price: { inputPer1M: 0.065,outputPer1M: 0.14   } },

  // Liquid LFM
  { match: "liquid/lfm-2-24b",                                           price: { inputPer1M: 0.03, outputPer1M: 0.12   } },

  // Inflection
  { match: "inflection/inflection-3",                                    price: { inputPer1M: 2.50, outputPer1M: 10.00  } },

  // MiniMax
  { match: "minimax/minimax-m2.7",                                       price: { inputPer1M: 0.30, outputPer1M: 1.20   } },
  { match: "minimax/minimax-m2.5",                                       price: { inputPer1M: 0.15, outputPer1M: 1.20   } },
  { match: "minimax/minimax-m2-her",                                     price: { inputPer1M: 0.30, outputPer1M: 1.20   } },
  { match: "minimax/minimax-m2.1",                                       price: { inputPer1M: 0.29, outputPer1M: 0.95   } },
  { match: "minimax/minimax-m2",                                         price: { inputPer1M: 0.255,outputPer1M: 1.00   } },
  { match: "minimax/minimax-m1",                                         price: { inputPer1M: 0.40, outputPer1M: 2.20   } },
  { match: "minimax/minimax-01",                                         price: { inputPer1M: 0.20, outputPer1M: 1.10   } },

  // Z.AI GLM (OpenRouter route; pricing differs from direct bigmodel.cn)
  { match: "z-ai/glm-5.1",                                               price: { inputPer1M: 0.698,outputPer1M: 4.40   } },
  { match: "z-ai/glm-5v-turbo",                                          price: { inputPer1M: 1.20, outputPer1M: 4.00   } },
  { match: "z-ai/glm-5-turbo",                                           price: { inputPer1M: 1.20, outputPer1M: 4.00   } },
  { match: "z-ai/glm-5",                                                 price: { inputPer1M: 0.72, outputPer1M: 2.30   } },
  { match: "z-ai/glm-4.7-flash",                                         price: { inputPer1M: 0.06, outputPer1M: 0.40   } },
  { match: "z-ai/glm-4.7",                                               price: { inputPer1M: 0.38, outputPer1M: 1.74   } },
  { match: "z-ai/glm-4.6v",                                              price: { inputPer1M: 0.30, outputPer1M: 0.90   } },
  { match: "z-ai/glm-4.6",                                               price: { inputPer1M: 0.39, outputPer1M: 1.90   } },
  { match: "z-ai/glm-4.5v",                                              price: { inputPer1M: 0.60, outputPer1M: 1.80   } },
  { match: "z-ai/glm-4.5-air",                                           price: { inputPer1M: 0.13, outputPer1M: 0.85   } },
  { match: "z-ai/glm-4.5",                                               price: { inputPer1M: 0.60, outputPer1M: 2.20   } },
  { match: "z-ai/glm-4-32b",                                             price: { inputPer1M: 0.10, outputPer1M: 0.10   } },

  // Baidu ERNIE
  { match: "baidu/ernie-4.5-vl-424b",                                    price: { inputPer1M: 0.42, outputPer1M: 1.25   } },
  { match: "baidu/ernie-4.5-vl-28b",                                     price: { inputPer1M: 0.14, outputPer1M: 0.56   } },
  { match: "baidu/ernie-4.5-300b",                                       price: { inputPer1M: 0.28, outputPer1M: 1.10   } },
  { match: "baidu/ernie-4.5-21b",                                        price: { inputPer1M: 0.07, outputPer1M: 0.28   } },

  // Tencent Hunyuan
  { match: "tencent/hunyuan-a13b",                                       price: { inputPer1M: 0.14, outputPer1M: 0.57   } },

  // ByteDance Seed
  { match: "bytedance-seed/seed-2.0-lite",                               price: { inputPer1M: 0.25, outputPer1M: 2.00   } },
  { match: "bytedance-seed/seed-2.0-mini",                               price: { inputPer1M: 0.10, outputPer1M: 0.40   } },
  { match: "bytedance-seed/seed-1.6-flash",                              price: { inputPer1M: 0.075,outputPer1M: 0.30   } },
  { match: "bytedance-seed/seed-1.6",                                    price: { inputPer1M: 0.25, outputPer1M: 2.00   } },
  { match: "bytedance/ui-tars",                                          price: { inputPer1M: 0.10, outputPer1M: 0.20   } },

  // Alibaba Tongyi
  { match: "alibaba/tongyi-deepresearch",                                price: { inputPer1M: 0.09, outputPer1M: 0.45   } },

  // Allen AI OLMo
  { match: "allenai/olmo-3.1-32b",                                       price: { inputPer1M: 0.20, outputPer1M: 0.60   } },
  { match: "allenai/olmo-3-32b",                                         price: { inputPer1M: 0.15, outputPer1M: 0.50   } },

  // Arcee AI
  { match: "arcee-ai/trinity-large",                                     price: { inputPer1M: 0.22, outputPer1M: 0.85   } },
  { match: "arcee-ai/trinity-mini",                                      price: { inputPer1M: 0.045,outputPer1M: 0.15   } },
  { match: "arcee-ai/spotlight",                                         price: { inputPer1M: 0.18, outputPer1M: 0.18   } },
  { match: "arcee-ai/maestro-reasoning",                                 price: { inputPer1M: 0.90, outputPer1M: 3.30   } },
  { match: "arcee-ai/virtuoso-large",                                    price: { inputPer1M: 0.75, outputPer1M: 1.20   } },
  { match: "arcee-ai/coder-large",                                       price: { inputPer1M: 0.50, outputPer1M: 0.80   } },

  // NousResearch Hermes
  { match: "nousresearch/hermes-4-405b",                                 price: { inputPer1M: 1.00, outputPer1M: 3.00   } },
  { match: "nousresearch/hermes-4-70b",                                  price: { inputPer1M: 0.13, outputPer1M: 0.40   } },
  { match: "nousresearch/hermes-3-llama-3.1-405b",                       price: { inputPer1M: 1.00, outputPer1M: 1.00   } },
  { match: "nousresearch/hermes-3-llama-3.1-70b",                        price: { inputPer1M: 0.30, outputPer1M: 0.30   } },
  { match: "nousresearch/hermes-2-pro-llama-3-8b",                       price: { inputPer1M: 0.14, outputPer1M: 0.14   } },

  // Xiaomi MiMo
  { match: "xiaomi/mimo-v2-pro",                                         price: { inputPer1M: 1.00, outputPer1M: 3.00   } },
  { match: "xiaomi/mimo-v2-omni",                                        price: { inputPer1M: 0.40, outputPer1M: 2.00   } },
  { match: "xiaomi/mimo-v2-flash",                                       price: { inputPer1M: 0.09, outputPer1M: 0.29   } },

  // Writer Palmyra
  { match: "writer/palmyra-x5",                                          price: { inputPer1M: 0.60, outputPer1M: 6.00   } },

  // Upstage Solar
  { match: "upstage/solar-pro-3",                                        price: { inputPer1M: 0.15, outputPer1M: 0.60   } },

  // IBM Granite
  { match: "ibm-granite/granite-4",                                      price: { inputPer1M: 0.017,outputPer1M: 0.11   } },

  // Inception Mercury
  { match: "inception/mercury",                                          price: { inputPer1M: 0.25, outputPer1M: 0.75   } },

  // StepFun
  { match: "stepfun/step-3.5-flash",                                     price: { inputPer1M: 0.10, outputPer1M: 0.30   } },

  // Morph
  { match: "morph/morph-v3-large",                                       price: { inputPer1M: 0.90, outputPer1M: 1.90   } },
  { match: "morph/morph-v3-fast",                                        price: { inputPer1M: 0.80, outputPer1M: 1.20   } },

  // DeepCogito
  { match: "deepcogito/cogito-v2.1-671b",                                price: { inputPer1M: 1.25, outputPer1M: 1.25   } },

  // EssentialAI
  { match: "essentialai/rnj-1",                                          price: { inputPer1M: 0.15, outputPer1M: 0.15   } },

  // PrimeIntellect
  { match: "prime-intellect/intellect-3",                                price: { inputPer1M: 0.20, outputPer1M: 1.10   } },

  // TNG DeepSeek R1T
  { match: "tngtech/deepseek-r1t2",                                      price: { inputPer1M: 0.30, outputPer1M: 1.10   } },

  // Switchpoint Router
  { match: "switchpoint/router",                                         price: { inputPer1M: 0.85, outputPer1M: 3.40   } },

  // Aion Labs
  { match: "aion-labs/aion-1.0-mini",                                    price: { inputPer1M: 0.70, outputPer1M: 1.40   } },
  { match: "aion-labs/aion-1.0",                                         price: { inputPer1M: 4.00, outputPer1M: 8.00   } },
  { match: "aion-labs/aion-2.0",                                         price: { inputPer1M: 0.80, outputPer1M: 1.60   } },
  { match: "aion-labs/aion-rp",                                          price: { inputPer1M: 0.80, outputPer1M: 1.60   } },

  // Reka AI
  { match: "rekaai/reka-flash-3",                                        price: { inputPer1M: 0.10, outputPer1M: 0.20   } },
  { match: "rekaai/reka-edge",                                           price: { inputPer1M: 0.10, outputPer1M: 0.10   } },

  // Relace
  { match: "relace/relace-search",                                       price: { inputPer1M: 1.00, outputPer1M: 3.00   } },
  { match: "relace/relace-apply-3",                                      price: { inputPer1M: 0.85, outputPer1M: 1.25   } },

  // KwaiPilot
  { match: "kwaipilot/kat-coder-pro",                                    price: { inputPer1M: 0.30, outputPer1M: 1.20   } },

  // Nex-AGI
  { match: "nex-agi/deepseek-v3.1-nex",                                  price: { inputPer1M: 0.135,outputPer1M: 0.50   } },

  // Qwen on OpenRouter (extending direct alibabacloud entries below)
  { match: "qwen/qwen3.6-plus",                                          price: { inputPer1M: 0.325, outputPer1M: 1.95  } },
  { match: "qwen/qwen3.5-397b",                                          price: { inputPer1M: 0.39,  outputPer1M: 2.34  } },
  { match: "qwen/qwen3.5-122b",                                          price: { inputPer1M: 0.26,  outputPer1M: 2.08  } },
  { match: "qwen/qwen3.5-35b",                                           price: { inputPer1M: 0.1625,outputPer1M: 1.30  } },
  { match: "qwen/qwen3.5-27b",                                           price: { inputPer1M: 0.195, outputPer1M: 1.56  } },
  { match: "qwen/qwen3.5-9b",                                            price: { inputPer1M: 0.10,  outputPer1M: 0.15  } },
  { match: "qwen/qwen3.5-flash",                                         price: { inputPer1M: 0.065, outputPer1M: 0.26  } },
  { match: "qwen/qwen3.5-plus",                                          price: { inputPer1M: 0.26,  outputPer1M: 1.56  } },
  { match: "qwen/qwen3-vl-235b-a22b-thinking",                           price: { inputPer1M: 0.26,  outputPer1M: 2.60  } },
  { match: "qwen/qwen3-vl-235b",                                         price: { inputPer1M: 0.20,  outputPer1M: 0.88  } },
  { match: "qwen/qwen3-vl-32b",                                          price: { inputPer1M: 0.104, outputPer1M: 0.416 } },
  { match: "qwen/qwen3-vl-30b-a3b-thinking",                             price: { inputPer1M: 0.13,  outputPer1M: 1.56  } },
  { match: "qwen/qwen3-vl-30b",                                          price: { inputPer1M: 0.13,  outputPer1M: 0.52  } },
  { match: "qwen/qwen3-vl-8b-thinking",                                  price: { inputPer1M: 0.117, outputPer1M: 1.365 } },
  { match: "qwen/qwen3-vl-8b",                                           price: { inputPer1M: 0.08,  outputPer1M: 0.50  } },
  { match: "qwen/qwen3-coder-plus",                                      price: { inputPer1M: 0.65,  outputPer1M: 3.25  } },
  { match: "qwen/qwen3-coder-flash",                                     price: { inputPer1M: 0.195, outputPer1M: 0.975 } },
  { match: "qwen/qwen3-coder-next",                                      price: { inputPer1M: 0.15,  outputPer1M: 0.80  } },
  { match: "qwen/qwen3-coder-30b",                                       price: { inputPer1M: 0.07,  outputPer1M: 0.27  } },
  { match: "qwen/qwen3-coder",                                           price: { inputPer1M: 0.22,  outputPer1M: 1.00  } },
  { match: "qwen/qwen3-next-80b",                                        price: { inputPer1M: 0.09,  outputPer1M: 1.10  } },
  { match: "qwen/qwen3-235b-a22b-thinking-2507",                         price: { inputPer1M: 0.13,  outputPer1M: 0.60  } },
  { match: "qwen/qwen3-235b-a22b-2507",                                  price: { inputPer1M: 0.071, outputPer1M: 0.10  } },
  { match: "qwen/qwen3-30b-a3b-thinking",                                price: { inputPer1M: 0.08,  outputPer1M: 0.40  } },
  { match: "qwen/qwen3-30b",                                             price: { inputPer1M: 0.09,  outputPer1M: 0.30  } },
  { match: "qwen/qwen3-14b",                                             price: { inputPer1M: 0.06,  outputPer1M: 0.24  } },
  { match: "qwen/qwen3-8b",                                              price: { inputPer1M: 0.05,  outputPer1M: 0.40  } },
  { match: "qwen/qwen-plus-2025-07-28",                                  price: { inputPer1M: 0.26,  outputPer1M: 0.78  } },
  { match: "qwen/qwen-vl-plus",                                          price: { inputPer1M: 0.1365,outputPer1M: 0.4095} },
  { match: "qwen/qwen-vl-max",                                           price: { inputPer1M: 0.52,  outputPer1M: 2.08  } },
  { match: "qwen/qwen-turbo",                                            price: { inputPer1M: 0.0325,outputPer1M: 0.13  } },
  { match: "qwen/qwen2.5-vl-72b",                                        price: { inputPer1M: 0.25,  outputPer1M: 0.75  } },
  { match: "qwen/qwen-plus",                                             price: { inputPer1M: 0.26,  outputPer1M: 0.78  } },
  { match: "qwen/qwen-max",                                              price: { inputPer1M: 1.04,  outputPer1M: 4.16  } },
  { match: "qwen/qwen-2.5-coder-32b",                                    price: { inputPer1M: 0.66,  outputPer1M: 1.00  } },
  { match: "qwen/qwen-2.5-72b",                                          price: { inputPer1M: 0.12,  outputPer1M: 0.39  } },
  { match: "qwen/qwen-2.5-7b",                                           price: { inputPer1M: 0.04,  outputPer1M: 0.10  } },

  // Meta Llama on OpenRouter (older variants not covered by generic llama-3.3-70b)
  { match: "meta-llama/llama-3.2-11b-vision",                            price: { inputPer1M: 0.245, outputPer1M: 0.245 } },
  { match: "meta-llama/llama-3.2-3b",                                    price: { inputPer1M: 0.051, outputPer1M: 0.34  } },
  { match: "meta-llama/llama-3.2-1b",                                    price: { inputPer1M: 0.027, outputPer1M: 0.20  } },
  { match: "meta-llama/llama-3.1-8b-instruct",                           price: { inputPer1M: 0.02,  outputPer1M: 0.05  } },
  { match: "meta-llama/llama-3.1-70b-instruct",                          price: { inputPer1M: 0.40,  outputPer1M: 0.40  } },
  { match: "meta-llama/llama-3-70b",                                     price: { inputPer1M: 0.51,  outputPer1M: 0.74  } },
  { match: "meta-llama/llama-3-8b",                                      price: { inputPer1M: 0.03,  outputPer1M: 0.04  } },
  { match: "meta-llama/llama-guard-4-12b",                               price: { inputPer1M: 0.18,  outputPer1M: 0.18  } },

  // Community / RP fine-tunes (kept for completeness, some users route via OpenRouter)
  { match: "sao10k/l3.3-euryale-70b",                                    price: { inputPer1M: 0.65,  outputPer1M: 0.75  } },
  { match: "sao10k/l3.1-euryale-70b",                                    price: { inputPer1M: 0.85,  outputPer1M: 0.85  } },
  { match: "sao10k/l3.1-70b-hanami",                                     price: { inputPer1M: 3.00,  outputPer1M: 3.00  } },
  { match: "sao10k/l3-euryale-70b",                                      price: { inputPer1M: 1.48,  outputPer1M: 1.48  } },
  { match: "sao10k/l3-lunaris-8b",                                       price: { inputPer1M: 0.04,  outputPer1M: 0.05  } },
  { match: "thedrummer/cydonia-24b",                                     price: { inputPer1M: 0.30,  outputPer1M: 0.50  } },
  { match: "thedrummer/skyfall-36b",                                     price: { inputPer1M: 0.55,  outputPer1M: 0.80  } },
  { match: "thedrummer/unslopnemo-12b",                                  price: { inputPer1M: 0.40,  outputPer1M: 0.40  } },
  { match: "thedrummer/rocinante-12b",                                   price: { inputPer1M: 0.17,  outputPer1M: 0.43  } },
  { match: "anthracite-org/magnum-v4-72b",                               price: { inputPer1M: 3.00,  outputPer1M: 5.00  } },
  { match: "alpindale/goliath-120b",                                     price: { inputPer1M: 3.75,  outputPer1M: 7.50  } },
  { match: "gryphe/mythomax-l2-13b",                                     price: { inputPer1M: 0.06,  outputPer1M: 0.06  } },
  { match: "mancer/weaver",                                              price: { inputPer1M: 0.75,  outputPer1M: 1.00  } },
  { match: "undi95/remm-slerp-l2-13b",                                   price: { inputPer1M: 0.45,  outputPer1M: 0.65  } },
  { match: "alfredpros/codellama-7b-instruct-solidity",                  price: { inputPer1M: 0.80,  outputPer1M: 1.20  } },

  // ── OpenAI (source: platform.openai.com/docs/pricing, April 2026) ────────
  // Rules: more-specific patterns must come BEFORE less-specific ones.
  { match: "gpt-4.1-mini",              price: { inputPer1M: 0.40,   outputPer1M: 1.60   } },
  { match: "gpt-4.1-nano",              price: { inputPer1M: 0.10,   outputPer1M: 0.40   } },
  { match: "gpt-4.1",                   price: { inputPer1M: 2.00,   outputPer1M: 8.00   } },
  { match: "gpt-4o-mini",               price: { inputPer1M: 0.15,   outputPer1M: 0.60   } },
  { match: "gpt-4o",                    price: { inputPer1M: 2.50,   outputPer1M: 10.00  } },
  { match: "o4-mini",                   price: { inputPer1M: 1.10,   outputPer1M: 4.40   } },
  { match: "o3-mini",                   price: { inputPer1M: 1.10,   outputPer1M: 4.40   } },
  { match: "o3",                        price: { inputPer1M: 2.00,   outputPer1M: 8.00   } },
  { match: "o1",                        price: { inputPer1M: 15.00,  outputPer1M: 60.00  } },
  // ── OpenAI GPT-5 (source: platform.openai.com/docs/pricing, May 2026) ───
  // ⚠ Specifics MUST appear before generics: gpt-5-mini before gpt-5, etc.
  { match: "gpt-5.5-pro",               price: { inputPer1M: 30.00,  outputPer1M: 180.00 } },
  { match: "gpt-5.5",                   price: { inputPer1M: 5.00,   outputPer1M: 30.00  } },
  { match: "gpt-5.4",                   price: { inputPer1M: 15.00,  outputPer1M: 60.00  } },
  { match: "gpt-5.3-codex",             price: { inputPer1M: 3.00,   outputPer1M: 15.00  } },
  { match: "gpt-5.2-codex",             price: { inputPer1M: 1.50,   outputPer1M: 6.00   } },
  { match: "gpt-5.2",                   price: { inputPer1M: 15.00,  outputPer1M: 60.00  } },
  { match: "gpt-5.1",                   price: { inputPer1M: 15.00,  outputPer1M: 60.00  } },
  { match: "gpt-5-mini",                price: { inputPer1M: 0.25,   outputPer1M: 2.00   } },
  { match: "gpt-5-nano",                price: { inputPer1M: 0.10,   outputPer1M: 0.40   } },
  { match: "gpt-5",                     price: { inputPer1M: 1.25,   outputPer1M: 10.00  } },
  // ── Anthropic (source: platform.claude.com/docs, April 2026) ─────────────
  { match: "claude-opus-4-7",           price: { inputPer1M: 5.00,   outputPer1M: 25.00  } },
  { match: "claude-opus-4-6",           price: { inputPer1M: 5.00,   outputPer1M: 25.00  } },
  { match: "claude-opus-4",             price: { inputPer1M: 5.00,   outputPer1M: 25.00  } },
  { match: "claude-sonnet-4",           price: { inputPer1M: 3.00,   outputPer1M: 15.00  } },
  { match: "claude-haiku-4-5",          price: { inputPer1M: 1.00,   outputPer1M: 5.00   } },
  { match: "claude-haiku-4",            price: { inputPer1M: 1.00,   outputPer1M: 5.00   } },
  { match: "claude-3-7-sonnet",         price: { inputPer1M: 3.00,   outputPer1M: 15.00  } },
  { match: "claude-3-5-haiku",          price: { inputPer1M: 0.80,   outputPer1M: 4.00   } },
  { match: "claude-3-5-sonnet",         price: { inputPer1M: 3.00,   outputPer1M: 15.00  } },
  // ── Google Gemini (source: ai.google.dev/pricing, April 2026) ────────────
  { match: "gemini-3.1-flash-lite",     price: { inputPer1M: 0.25,   outputPer1M: 1.50   } },
  { match: "gemini-3.1-pro",            price: { inputPer1M: 2.00,   outputPer1M: 12.00  } },
  { match: "gemini-3.1",                price: { inputPer1M: 2.00,   outputPer1M: 12.00  } },
  { match: "gemini-3-flash",            price: { inputPer1M: 0.50,   outputPer1M: 3.00   } },
  { match: "gemini-3",                  price: { inputPer1M: 0.50,   outputPer1M: 3.00   } },
  { match: "gemini-2.5-flash-lite",     price: { inputPer1M: 0.10,   outputPer1M: 0.40   } },
  { match: "gemini-2.5-flash",          price: { inputPer1M: 0.30,   outputPer1M: 2.50   } },
  { match: "gemini-2.5-pro",            price: { inputPer1M: 1.25,   outputPer1M: 10.00  } },
  { match: "gemini-2.0-flash-lite",     price: { inputPer1M: 0.075,  outputPer1M: 0.30   } },
  { match: "gemini-2.0-flash",          price: { inputPer1M: 0.10,   outputPer1M: 0.40   } },
  // ── DeepSeek (source: api-docs.deepseek.com/quick_start/pricing, April 2026) ──
  { match: "deepseek-v4-pro",           price: { inputPer1M: 1.74,   outputPer1M: 3.48   } },
  { match: "deepseek-v4-flash",         price: { inputPer1M: 0.14,   outputPer1M: 0.28   } },
  { match: "deepseek-chat",             price: { inputPer1M: 0.14,   outputPer1M: 0.28   } },
  { match: "deepseek-reasoner",         price: { inputPer1M: 0.14,   outputPer1M: 0.28   } },
  { match: "deepseek-v3.2",             price: { inputPer1M: 0.28,   outputPer1M: 0.42   } },
  { match: "deepseek-r1",               price: { inputPer1M: 0.28,   outputPer1M: 0.42   } },
  { match: "deepseek-v3",               price: { inputPer1M: 0.28,   outputPer1M: 0.42   } },
  // ── xAI Grok (source: docs.x.ai/developers/models, May 2026) ────────────
  { match: "grok-4.3",                  price: { inputPer1M: 1.25,   outputPer1M: 2.50   } },
  { match: "grok-4-1-fast",             price: { inputPer1M: 0.20,   outputPer1M: 0.50   } },
  { match: "grok-4.1-fast",             price: { inputPer1M: 0.20,   outputPer1M: 0.50   } },
  { match: "grok-4-fast",               price: { inputPer1M: 0.20,   outputPer1M: 0.50   } },
  { match: "grok-4",                    price: { inputPer1M: 2.00,   outputPer1M: 6.00   } },
  { match: "grok-3-mini",               price: { inputPer1M: 0.30,   outputPer1M: 0.50   } },
  { match: "grok-3",                    price: { inputPer1M: 3.00,   outputPer1M: 15.00  } },
  { match: "grok-2-vision-1212",        price: { inputPer1M: 2.00,   outputPer1M: 10.00  } },
  { match: "grok-2-1212",               price: { inputPer1M: 2.00,   outputPer1M: 10.00  } },
  { match: "grok-2",                    price: { inputPer1M: 2.00,   outputPer1M: 10.00  } },
  // ── Mistral AI (source: docs.mistral.ai/platform/pricing, April 2026) ────
  { match: "magistral-medium",          price: { inputPer1M: 2.00,   outputPer1M: 5.00   } },
  { match: "magistral-small",           price: { inputPer1M: 0.50,   outputPer1M: 1.50   } },
  { match: "mistral-large",             price: { inputPer1M: 0.50,   outputPer1M: 1.50   } },
  { match: "mistral-medium",            price: { inputPer1M: 0.40,   outputPer1M: 2.00   } },
  { match: "mistral-small",             price: { inputPer1M: 0.10,   outputPer1M: 0.30   } },
  { match: "mistral-nemo",              price: { inputPer1M: 0.02,   outputPer1M: 0.04   } },
  { match: "codestral",                 price: { inputPer1M: 0.30,   outputPer1M: 0.90   } },
  { match: "devstral-medium",           price: { inputPer1M: 0.40,   outputPer1M: 2.00   } },
  { match: "devstral",                  price: { inputPer1M: 0.07,   outputPer1M: 0.28   } },
  { match: "pixtral",                   price: { inputPer1M: 2.00,   outputPer1M: 6.00   } },
  { match: "ministral-8b",              price: { inputPer1M: 0.10,   outputPer1M: 0.10   } },
  { match: "ministral-3b",              price: { inputPer1M: 0.04,   outputPer1M: 0.04   } },
  { match: "mistral-saba",              price: { inputPer1M: 0.20,   outputPer1M: 0.60   } },
  { match: "voxtral",                   price: { inputPer1M: 0.10,   outputPer1M: 0.30   } },
  // ── Moonshot AI / Kimi (source: platform.kimi.ai/docs/pricing, April 2026) ──
  { match: "moonshot-v1-128k",          price: { inputPer1M: 2.00,   outputPer1M: 5.00   } },
  { match: "moonshot-v1-32k",           price: { inputPer1M: 1.00,   outputPer1M: 3.00   } },
  { match: "moonshot-v1-8k",            price: { inputPer1M: 0.20,   outputPer1M: 2.00   } },
  { match: "moonshot-v1-auto",          price: { inputPer1M: 2.00,   outputPer1M: 5.00   } },
  { match: "kimi-k2.6",                 price: { inputPer1M: 0.60,   outputPer1M: 2.80   } },
  { match: "kimi-k2-turbo",             price: { inputPer1M: 1.15,   outputPer1M: 8.00   } },
  { match: "kimi-k2",                   price: { inputPer1M: 0.60,   outputPer1M: 2.50   } },
  { match: "kimi-thinking",             price: { inputPer1M: 0.60,   outputPer1M: 2.50   } },
  { match: "kimi-latest",               price: { inputPer1M: 2.00,   outputPer1M: 5.00   } },
  // ── Meta Llama (via Groq / Together AI, April 2026) ──────────────────────
  { match: "llama-4-maverick",          price: { inputPer1M: 0.27,   outputPer1M: 0.85   } },
  { match: "llama-4-scout",             price: { inputPer1M: 0.11,   outputPer1M: 0.34   } },
  { match: "llama-3.3-70b",             price: { inputPer1M: 0.59,   outputPer1M: 0.79   } },
  // ── ZhipuAI GLM (source: bigmodel.cn/pricing, April 2026) ────────────────
  { match: "glm-5-turbo",               price: { inputPer1M: 0.96,   outputPer1M: 3.20   } },
  { match: "glm-5",                     price: { inputPer1M: 1.00,   outputPer1M: 1.00   } },
  { match: "glm-4.7",                   price: { inputPer1M: 0.39,   outputPer1M: 1.75   } },
  { match: "glm-4.6",                   price: { inputPer1M: 0.69,   outputPer1M: 0.69   } },
  { match: "glm-4.5",                   price: { inputPer1M: 0.60,   outputPer1M: 2.20   } },
  { match: "glm-4-flash",               price: { inputPer1M: 0,      outputPer1M: 0      } },
  { match: "glm-z1-flash",              price: { inputPer1M: 0,      outputPer1M: 0      } },
  { match: "glm-z1",                    price: { inputPer1M: 0.96,   outputPer1M: 3.20   } },
  { match: "glm-4",                     price: { inputPer1M: 0.69,   outputPer1M: 0.69   } },
  // ── Qwen (source: alibabacloud.com/help/en/model-studio/model-pricing, April 2026) ──
  { match: "qwen3-max",                 price: { inputPer1M: 0.78,   outputPer1M: 3.90   } },
  { match: "qwen3-plus",                price: { inputPer1M: 1.56,   outputPer1M: 4.60   } },
  { match: "qwen3-coder",               price: { inputPer1M: 1.95,   outputPer1M: 9.75   } },
  { match: "qwen3-235b",                price: { inputPer1M: 0.20,   outputPer1M: 1.00   } },
  { match: "qwen3-32b",                 price: { inputPer1M: 0.15,   outputPer1M: 0.75   } },
  { match: "qwen3-30b",                 price: { inputPer1M: 0.10,   outputPer1M: 0.40   } },
  { match: "qwen3-flash",               price: { inputPer1M: 0.065,  outputPer1M: 0.26   } },
  { match: "qwen3",                     price: { inputPer1M: 0.065,  outputPer1M: 0.26   } },
  { match: "qwq-32b",                   price: { inputPer1M: 0.60,   outputPer1M: 0.60   } },
];

// Cache for getPrice results to avoid repeated linear scans
const priceCache = new Map<string, ModelPrice | null>();

function getPrice(model: string): ModelPrice | null {
  const lower = model.toLowerCase();
  if (priceCache.has(lower)) return priceCache.get(lower)!;
  let result: ModelPrice | null = null;
  for (const { match, price } of PRICING_TABLE) {
    if (lower.includes(match)) { result = price; break; }
  }
  priceCache.set(lower, result);
  return result;
}

function estimateCostUsd(inputTokens: number, outputTokens: number, price: ModelPrice | null): number | null {
  if (!price) return null;
  return (inputTokens / 1_000_000) * price.inputPer1M + (outputTokens / 1_000_000) * price.outputPer1M;
}

// ---------------------------------------------------------------------------
// Aggregation data structures
// ---------------------------------------------------------------------------
interface PeriodStats {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalRequestBodyBytes: number;   // total raw JSON request body bytes
  avgRequestBodyBytes: number;
  successCount: number;
  errorCount: number;
  errorRate: number;               // 0–1
  avgInputTokens: number;
  avgOutputTokens: number;
  avgDurationMs: number;
  avgFirstTokenMs: number | null;  // null when no streaming requests
  estimatedCostUsd: number | null;
  avgCostUsdPerRequest: number | null;
  // internal accumulators (stripped before response)
  _totalDurationMs: number;
  _totalFirstTokenMs: number;
  _firstTokenCount: number;
  _costCount: number;
}

function emptyStats(): PeriodStats {
  return {
    requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0,
    totalRequestBodyBytes: 0, avgRequestBodyBytes: 0,
    successCount: 0, errorCount: 0, errorRate: 0,
    avgInputTokens: 0, avgOutputTokens: 0, avgDurationMs: 0, avgFirstTokenMs: null,
    estimatedCostUsd: null, avgCostUsdPerRequest: null,
    _totalDurationMs: 0, _totalFirstTokenMs: 0, _firstTokenCount: 0, _costCount: 0,
  };
}

function addEntry(s: PeriodStats, e: UsageLogEntry): void {
  s.requests++;
  s.inputTokens  += e.inputTokens;
  s.outputTokens += e.outputTokens;
  s.totalTokens  += e.inputTokens + e.outputTokens;
  s.totalRequestBodyBytes += e.requestBodyBytes ?? 0;
  if (e.status === "success") s.successCount++;
  else                        s.errorCount++;
  s._totalDurationMs += e.durationMs ?? 0;
  if (e.firstTokenMs != null) {
    s._totalFirstTokenMs += e.firstTokenMs;
    s._firstTokenCount++;
  }
  const cost = estimateCostUsd(e.inputTokens, e.outputTokens, getPrice(e.model));
  if (cost !== null) {
    s.estimatedCostUsd = (s.estimatedCostUsd ?? 0) + cost;
    s._costCount++;
  }
}

function finalise(s: PeriodStats): void {
  const n = s.requests;
  if (n === 0) return;
  s.errorRate             = s.errorCount / n;
  s.avgInputTokens        = Math.round(s.inputTokens  / n);
  s.avgOutputTokens       = Math.round(s.outputTokens / n);
  s.avgRequestBodyBytes   = Math.round(s.totalRequestBodyBytes / n);
  s.avgDurationMs         = Math.round(s._totalDurationMs / n);
  s.avgFirstTokenMs       = s._firstTokenCount > 0
    ? Math.round(s._totalFirstTokenMs / s._firstTokenCount)
    : null;
  s.avgCostUsdPerRequest  = s.estimatedCostUsd !== null
    ? s.estimatedCostUsd / s._costCount
    : null;
}

// Strip internal accumulator fields before sending
function cleanStats(s: PeriodStats): Omit<PeriodStats, "_totalDurationMs"|"_totalFirstTokenMs"|"_firstTokenCount"|"_costCount"> {
  const { _totalDurationMs: _a, _totalFirstTokenMs: _b, _firstTokenCount: _c, _costCount: _d, ...clean } = s;
  return clean;
}

// ---------------------------------------------------------------------------
// 30-second result cache
// ---------------------------------------------------------------------------
interface CacheEntry {
  ts: number;
  usageVersion: number;
  logs: UsageLogEntry[];
  periodStats: ReturnType<typeof buildPeriodStats>;
  byModel: ReturnType<typeof buildByModel>;
  byProvider: ReturnType<typeof buildByProvider>;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30_000;

function buildPeriodStats(logs: UsageLogEntry[], now: number) {
  const HOUR = 3_600_000, DAY = 86_400_000, WEEK = 604_800_000;
  const s = {
    last_1h:  emptyStats(),
    last_24h: emptyStats(),
    last_7d:  emptyStats(),
    all_time: emptyStats(),
  };
  for (const e of logs) {
    const age = now - new Date(e.timestamp).getTime();
    if (age <= HOUR)  addEntry(s.last_1h,  e);
    if (age <= DAY)   addEntry(s.last_24h, e);
    if (age <= WEEK)  addEntry(s.last_7d,  e);
    addEntry(s.all_time, e);
  }
  finalise(s.last_1h); finalise(s.last_24h); finalise(s.last_7d); finalise(s.all_time);
  return s;
}

type ModelAgg = PeriodStats & {
  model: string; provider: string;
  inputPricePer1M: number | null; outputPricePer1M: number | null;
};
function buildByModel(logs: UsageLogEntry[]): ModelAgg[] {
  const map = new Map<string, ModelAgg>();
  for (const e of logs) {
    const key = `${e.provider}::${e.model}`;
    if (!map.has(key)) {
      const price = getPrice(e.model);
      map.set(key, {
        ...emptyStats(),
        model: e.model, provider: e.provider,
        inputPricePer1M:  price?.inputPer1M  ?? null,
        outputPricePer1M: price?.outputPer1M ?? null,
      });
    }
    addEntry(map.get(key)!, e);
  }
  const arr = [...map.values()];
  arr.forEach(finalise);
  return arr.sort((a, b) => b.totalTokens - a.totalTokens);
}

type ProviderAgg = PeriodStats & { provider: string };
function buildByProvider(logs: UsageLogEntry[]): ProviderAgg[] {
  const map = new Map<string, ProviderAgg>();
  for (const e of logs) {
    if (!map.has(e.provider)) {
      map.set(e.provider, { ...emptyStats(), provider: e.provider });
    }
    addEntry(map.get(e.provider)!, e);
  }
  const arr = [...map.values()];
  arr.forEach(finalise);
  return arr.sort((a, b) => b.totalTokens - a.totalTokens);
}

function getCache(now: number): CacheEntry {
  const usageVersion = getUsageLogVersion();
  if (cache && cache.usageVersion === usageVersion && now - cache.ts < CACHE_TTL_MS) return cache;
  const logs = readAllUsageLogs();
  cache = {
    ts: now,
    usageVersion,
    logs,
    periodStats: buildPeriodStats(logs, now),
    byModel:     buildByModel(logs),
    byProvider:  buildByProvider(logs),
  };
  return cache;
}

// ---------------------------------------------------------------------------
// Currency conversion (fixed reference rates, updated 2026-04)
// ---------------------------------------------------------------------------
const FX: Record<string, number> = {
  usd: 1,
  cny: 7.23,
  eur: 0.90,
  gbp: 0.77,
  jpy: 143.0,
  krw: 1420.0,
  hkd: 7.78,
  sgd: 1.34,
};

function convertCost(usd: number | null, rate: number): number | null {
  return usd === null ? null : Math.round(usd * rate * 1_000_000) / 1_000_000;
}

function applyFx<T extends { estimatedCostUsd: number | null; avgCostUsdPerRequest: number | null }>(
  obj: T, rate: number, currency: string,
): T & { estimatedCost: number | null; avgCostPerRequest: number | null; currency: string } {
  return {
    ...obj,
    estimatedCost:      convertCost(obj.estimatedCostUsd, rate),
    avgCostPerRequest:  convertCost(obj.avgCostUsdPerRequest, rate),
    currency,
  };
}

// ---------------------------------------------------------------------------
// Build since_startup stats from the unbounded session accumulator.
// Token counts are always exact. Cost is estimated from the ring-buffer logs
// (accurate when total requests ≤ 500; marked partial beyond that).
// ---------------------------------------------------------------------------
function buildSinceStartup(logs: UsageLogEntry[]): {
  stats: ReturnType<typeof cleanStats>;
  estimatedCostUsd: number | null;
  costIsPartial: boolean;
} {
  const acc = getSessionStats();
  const ringHasFull = acc.requests > logs.length; // ring has evicted old entries

  // Cost estimate — scan ring buffer regardless; note partial when evicted.
  let costUsd: number | null = null;
  for (const e of logs) {
    const c = estimateCostUsd(e.inputTokens, e.outputTokens, getPrice(e.model));
    if (c !== null) costUsd = (costUsd ?? 0) + c;
  }

  // Compose a PeriodStats directly from the session accumulator.
  const s = emptyStats();
  s.requests              = acc.requests;
  s.inputTokens           = acc.inputTokens;
  s.outputTokens          = acc.outputTokens;
  s.totalTokens           = acc.totalTokens;
  s.totalRequestBodyBytes = acc.totalRequestBodyBytes;
  s.successCount          = acc.successCount;
  s.errorCount            = acc.errorCount;
  // Accumulator totals for averages:
  s._totalDurationMs    = acc.totalDurationMs;
  s._totalFirstTokenMs  = acc.totalFirstTokenMs;
  s._firstTokenCount    = acc.firstTokenCount;
  s.estimatedCostUsd    = costUsd;
  // _costCount is used by finalise() only to compute avgCostUsdPerRequest, but
  // that field is overridden manually below with the accurate accumulator-based
  // value, so the exact value of _costCount here does not affect correctness.
  s._costCount          = costUsd !== null ? 1 : 0;
  finalise(s);
  // Override avgCostUsdPerRequest using accurate request count from accumulator.
  s.avgCostUsdPerRequest = costUsd !== null && acc.requests > 0
    ? costUsd / acc.requests
    : null;
  // Override avgRequestBodyBytes with accurate session-wide average.
  s.avgRequestBodyBytes = acc.requests > 0
    ? Math.round(acc.totalRequestBodyBytes / acc.requests)
    : 0;

  return { stats: cleanStats(s), estimatedCostUsd: costUsd, costIsPartial: ringHasFull };
}

// ---------------------------------------------------------------------------
// GET /api/billing/usage
//
// Query params:
//   period       = last_1h | last_24h | last_7d | since_startup  (default: all)
//   since        = ISO timestamp or Unix ms  (custom window)
//   top          = integer ≥1  (max rows in by_model / by_provider, default 50)
//   currency     = usd | cny | eur | gbp | jpy | krw | hkd | sgd  (default: usd)
//   no_breakdown = 1  (omit by_model / by_provider for lighter response)
// Cache TTL stays 30s, but any usage log write increments usageVersion and
// forces the next billing query to include the completed request immediately.
// ---------------------------------------------------------------------------
const VALID_PERIODS = new Set(["last_1h", "last_24h", "last_7d", "since_startup"]);

router.get("/api/billing/usage", adminAuth, (req: Request, res: Response) => {
  const now = Date.now();
  const cached = getCache(now);

  // ── currency ──────────────────────────────────────────────────────────────
  const currencyParam = (req.query.currency as string | undefined)?.toLowerCase() ?? "usd";
  const currency = currencyParam in FX ? currencyParam : "usd";
  const fxRate   = FX[currency]!;

  // ── top N ─────────────────────────────────────────────────────────────────
  const topRaw = parseInt(req.query.top as string, 10);
  const top     = Number.isFinite(topRaw) && topRaw >= 1 ? topRaw : 50;

  // ── no_breakdown ──────────────────────────────────────────────────────────
  const noBreakdown = req.query.no_breakdown === "1" || req.query.no_breakdown === "true";

  // ── budget ────────────────────────────────────────────────────────────────
  const quotaUsd = getConfig().budgetQuotaUsd ?? 10.0;

  // ── since_startup (unbounded session accumulator) ─────────────────────────
  const { stats: startupStats, estimatedCostUsd: startupCostUsd, costIsPartial } = buildSinceStartup(cached.logs);

  // ── since (custom window, ring-buffer based) ──────────────────────────────
  const sinceRaw = req.query.since as string | undefined;
  let customWindow: { since: string; stats: unknown } | null = null;
  if (sinceRaw) {
    const sinceTs = isNaN(Number(sinceRaw)) ? Date.parse(sinceRaw) : Number(sinceRaw);
    if (!isNaN(sinceTs) && sinceTs > 0) {
      const s = emptyStats();
      for (const e of cached.logs) {
        if (new Date(e.timestamp).getTime() >= sinceTs) addEntry(s, e);
      }
      finalise(s);
      customWindow = {
        since: new Date(sinceTs).toISOString(),
        stats: applyFx(cleanStats(s), fxRate, currency),
      };
    }
  }

  // ── period filter ─────────────────────────────────────────────────────────
  const periodParam = req.query.period as string | undefined;

  type PeriodKey = keyof typeof cached.periodStats;
  const buildPeriodEntry = (key: PeriodKey) =>
    applyFx(cleanStats(cached.periodStats[key]), fxRate, currency);

  let periodOutput: Record<string, unknown>;
  if (periodParam && VALID_PERIODS.has(periodParam)) {
    if (periodParam === "since_startup") {
      periodOutput = { since_startup: applyFx(startupStats, fxRate, currency) };
    } else {
      periodOutput = { [periodParam]: buildPeriodEntry(periodParam as PeriodKey) };
    }
  } else {
    periodOutput = {
      since_startup: applyFx(startupStats, fxRate, currency),
      last_1h:       buildPeriodEntry("last_1h"),
      last_24h:      buildPeriodEntry("last_24h"),
      last_7d:       buildPeriodEntry("last_7d"),
    };
  }

  // ── by_model / by_provider ────────────────────────────────────────────────
  let byModelOut: unknown[] | undefined;
  let byProviderOut: unknown[] | undefined;
  if (!noBreakdown) {
    byModelOut = cached.byModel.slice(0, top).map(m => {
      const { inputPricePer1M, outputPricePer1M, ...rest } = m;
      return {
        ...applyFx(cleanStats(rest as PeriodStats), fxRate, currency),
        model:    m.model,
        provider: m.provider,
        pricing: inputPricePer1M !== null
          ? {
              inputPer1M:  Math.round(inputPricePer1M  * fxRate * 1e6) / 1e6,
              outputPer1M: Math.round(outputPricePer1M! * fxRate * 1e6) / 1e6,
              currency,
            }
          : null,
      };
    });
    byProviderOut = cached.byProvider.slice(0, top).map(p => {
      const { provider, ...rest } = p;
      return { ...applyFx(cleanStats(rest as PeriodStats), fxRate, currency), provider };
    });
  }

  // ── compute budget object ─────────────────────────────────────────────────
  // Use since_startup cost (most accurate for "total spend this session").
  const usedUsd  = startupCostUsd ?? 0;
  const usedFx   = Math.round(usedUsd * fxRate * 1_000_000) / 1_000_000;
  const quotaFx  = Math.round(quotaUsd * fxRate * 1_000_000) / 1_000_000;
  const remainFx = Math.round(Math.max(0, quotaUsd - usedUsd) * fxRate * 1_000_000) / 1_000_000;
  const usageRatio = quotaUsd > 0 ? usedUsd / quotaUsd : 0;

  res.json({
    generated_at:          new Date().toISOString(),
    server_started_at:     new Date(SERVER_START_MS).toISOString(),
    cache_age_ms:          now - cached.ts,
    cache_ttl_ms:          CACHE_TTL_MS,
    total_session_requests: getSessionStats().requests,
    ring_buffer_requests:   cached.logs.length,
    currency,
    budget: {
      quota:              quotaFx,
      quota_usd:          quotaUsd,
      used:               usedFx,
      used_usd:           usedUsd,
      remaining:          remainFx,
      remaining_usd:      Math.max(0, quotaUsd - usedUsd),
      usage_ratio:        Math.round(usageRatio * 10_000) / 10_000,  // 0–1+
      warn:               usageRatio >= 0.8 && usageRatio < 1.0,
      exceeded:           usageRatio >= 1.0,
      cost_is_partial:    costIsPartial,
      currency,
    },
    ...(customWindow ? { custom_window: customWindow } : {}),
    period: periodOutput,
    ...(noBreakdown ? {} : { by_model: byModelOut, by_provider: byProviderOut }),
    meta: {
      since_startup_note:    "since_startup 的 token 计数来自无上限会话累加器，始终精确。费用估算基于最近 500 条记录（ring buffer）。",
      cost_estimate_partial: costIsPartial,
      pricing_note:          "estimatedCost 为参考估算，基于公开定价表按模型名称匹配。未知模型返回 null。requestBodyBytes 可在 token 计费缺失时用于大小参考。",
      pricing_updated:       "2026-04",
      fx_rates_note:         "货币汇率为固定参考汇率，实际以各服务商账单为准。",
      ring_buffer_cap:       500,
      budget_warn_threshold: "80%",
    },
  });
});

export default router;
