import type { Response } from "express";
import {
  ANTHROPIC_MAX_TOKENS,
  ANTHROPIC_THINKING_BUDGET,
  resolveMaxTokens,
} from "../lib/model-limits";
import { parseThinkingSuffix, flushRes } from "../lib/providers";
import {
  toAnthropicMessages,
  toAnthropicTools,
  type ChatCompletionRequestBody,
  type ChatMessage,
} from "./proxy-format";
import { sseChunk } from "./proxy-sse";
import type { LogUsage } from "./proxy-usage";
import {
  getAnthropicCredentials,
  getAnthropicMessagesUrl,
  buildAnthropicHeaders,
  fetchAnthropicRaw,
  parseAnthropicSSE,
  readResponseBufferCapped,
  readResponseTextCapped,
} from "./proxy-raw";

// Models that use the newer adaptive thinking API instead of the classic
// enabled API. These models require { thinking: { type: "adaptive" } } and
// { output_config: { effort: "high" } } instead of budget_tokens.
const ADAPTIVE_THINKING_MODELS = new Set(["claude-opus-4-7"]);

export async function handleAnthropicStream(
  body: ChatCompletionRequestBody,
  model: string,
  messages: ChatMessage[],
  res: Response,
  trackFirstToken: () => void,
  logUsage: LogUsage,
): Promise<void> {
  const { baseModel, thinking, thinkingVisible } = parseThinkingSuffix(model);
  const { baseUrl, apiKey } = getAnthropicCredentials();

  if (!apiKey) {
    throw new Error(
      "Anthropic API key is not configured. Please set the API Key in settings.",
    );
  }

  const systemContent = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content ?? "")
    .join("\n");

  // claude-opus-4-7 uses the new adaptive thinking API:
  //   { thinking: { type: "adaptive" }, output_config: { effort: "high" } }
  // All other models use the original enabled API:
  //   { thinking: { type: "enabled", budget_tokens: N }, temperature: 1 }
  const useAdaptiveThinking = thinking && ADAPTIVE_THINKING_MODELS.has(baseModel);

  const resolvedMaxTokens = resolveMaxTokens(
    ANTHROPIC_MAX_TOKENS,
    baseModel,
    body.max_tokens ?? body.max_completion_tokens,
  );

  let maxTokens: number;
  let thinkingBlock: Record<string, unknown> | undefined;
  let thinkingHeaders: Record<string, string> | undefined;

  if (useAdaptiveThinking) {
    // Adaptive thinking: no budget_tokens constraint, just use resolved max_tokens
    maxTokens = resolvedMaxTokens;
    thinkingBlock = {
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
    };
    thinkingHeaders = undefined;
  } else if (thinking) {
    // Enabled thinking: Anthropic requires budget_tokens >= 1024 and max_tokens > budget_tokens
    const modelMaxTokens = ANTHROPIC_MAX_TOKENS[baseModel] ?? resolvedMaxTokens;
    const defaultBudget =
      ANTHROPIC_THINKING_BUDGET[baseModel] ?? Math.floor(modelMaxTokens * 0.8);
    const MIN_THINKING_BUDGET = 1024;
    let thinkingBudget = Math.min(defaultBudget, Math.floor(resolvedMaxTokens * 0.8));
    thinkingBudget = Math.max(thinkingBudget, MIN_THINKING_BUDGET);
    maxTokens = Math.min(Math.max(resolvedMaxTokens, thinkingBudget + 1024), modelMaxTokens);
    thinkingBlock = {
      thinking: { type: "enabled", budget_tokens: thinkingBudget },
      temperature: 1,
    };
    thinkingHeaders = { "anthropic-beta": "interleaved-thinking-2025-05-14" };
  } else {
    maxTokens = resolvedMaxTokens;
    thinkingBlock = undefined;
    thinkingHeaders = undefined;
  }

  const anthropicMessages = toAnthropicMessages(messages);

  const anthropicBody: Record<string, unknown> = {
    model: baseModel,
    max_tokens: maxTokens,
    messages: anthropicMessages,
    stream: true,
    ...(systemContent ? { system: systemContent } : {}),
    ...(thinkingBlock ?? {}),
    ...(body.tools?.length ? { tools: toAnthropicTools(body.tools) } : {}),
  };

  const upstream = await fetchAnthropicRaw(baseUrl, apiKey, anthropicBody, "anthropic", undefined, thinkingHeaders);

  if (!upstream.ok) {
    const errText = await readResponseTextCapped(upstream);
    const err = new Error(errText) as Error & { status?: number };
    err.status = upstream.status;
    throw err;
  }

  if (!upstream.body) {
    throw new Error("No response body from Anthropic");
  }

  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  let inThinkingBlock = false;
  let thinkingStarted = false;
  let streamCurrentToolUse: { id: string; name: string; index: number } | null =
    null;
  let streamToolUseIndex = 0;
  let hasStreamedToolCall = false;
  let _antStreamInput = 0,
    _antStreamOutput = 0;

  res.write(sseChunk(id, created, model, { role: "assistant", content: "" }));
  flushRes(res);

  for await (const { data: event } of parseAnthropicSSE(upstream.body)) {
    if (event.type === "message_start") {
      const msg = event.message as Record<string, unknown> | undefined;
      const msgUsage = msg
        ? (msg.usage as { input_tokens?: number } | undefined)
        : undefined;
      if (msgUsage?.input_tokens) _antStreamInput = msgUsage.input_tokens;
    } else if (event.type === "message_delta") {
      const u = event.usage as { output_tokens?: number } | undefined;
      if (u?.output_tokens) _antStreamOutput = u.output_tokens;
    }
    if (event.type === "content_block_start") {
      const cb = event.content_block as {
        type: string;
        id?: string;
        name?: string;
      };
      if (cb.type === "tool_use") {
        hasStreamedToolCall = true;
        streamCurrentToolUse = {
          id: cb.id ?? "",
          name: cb.name ?? "",
          index: streamToolUseIndex++,
        };
        res.write(
          sseChunk(id, created, model, {
            tool_calls: [
              {
                index: streamCurrentToolUse.index,
                id: streamCurrentToolUse.id,
                type: "function",
                function: { name: streamCurrentToolUse.name, arguments: "" },
              },
            ],
          }),
        );
        flushRes(res);
      } else {
        streamCurrentToolUse = null;
        inThinkingBlock = cb.type === "thinking";
        if (inThinkingBlock && thinkingVisible && !thinkingStarted) {
          thinkingStarted = true;
          res.write(
            sseChunk(id, created, model, {
              role: "assistant",
              content: "<think>\n",
            }),
          );
          flushRes(res);
        }
      }
    } else if (event.type === "content_block_stop") {
      if (inThinkingBlock && thinkingVisible) {
        res.write(
          sseChunk(id, created, model, {
            role: "assistant",
            content: "\n</think>\n\n",
          }),
        );
        flushRes(res);
      }
      inThinkingBlock = false;
      streamCurrentToolUse = null;
    } else if (event.type === "content_block_delta") {
      const delta = event.delta as {
        type: string;
        text?: string;
        thinking?: string;
        partial_json?: string;
      };
      if (delta.type === "text_delta" && delta.text) {
        trackFirstToken();
        res.write(sseChunk(id, created, model, { content: delta.text }));
        flushRes(res);
      } else if (
        delta.type === "thinking_delta" &&
        thinkingVisible &&
        delta.thinking
      ) {
        res.write(sseChunk(id, created, model, { content: delta.thinking }));
        flushRes(res);
      } else if (
        delta.type === "input_json_delta" &&
        streamCurrentToolUse &&
        delta.partial_json
      ) {
        res.write(
          sseChunk(id, created, model, {
            tool_calls: [
              {
                index: streamCurrentToolUse.index,
                function: { arguments: delta.partial_json },
              },
            ],
          }),
        );
        flushRes(res);
      }
    } else if (event.type === "message_stop") {
      res.write(
        sseChunk(
          id,
          created,
          model,
          {},
          hasStreamedToolCall ? "tool_calls" : "stop",
        ),
      );
      flushRes(res);
    }
  }

  logUsage({
    status: "success",
    statusCode: 200,
    inputTokens: _antStreamInput,
    outputTokens: _antStreamOutput,
  });
}

export async function handleAnthropicNonStream(
  body: ChatCompletionRequestBody,
  model: string,
  messages: ChatMessage[],
  res: Response,
  logUsage: LogUsage,
): Promise<void> {
  const { baseModel, thinking, thinkingVisible } = parseThinkingSuffix(model);
  const { baseUrl, apiKey } = getAnthropicCredentials();

  if (!apiKey) {
    throw new Error(
      "Anthropic API key is not configured. Please set the API Key in settings.",
    );
  }

  const systemContent = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content ?? "")
    .join("\n");

  const useAdaptiveThinking = thinking && ADAPTIVE_THINKING_MODELS.has(baseModel);

  const resolvedMaxTokens = resolveMaxTokens(
    ANTHROPIC_MAX_TOKENS,
    baseModel,
    body.max_tokens ?? body.max_completion_tokens,
  );

  let maxTokens: number;
  let thinkingBlock: Record<string, unknown> | undefined;
  let thinkingHeaders: Record<string, string> | undefined;

  if (useAdaptiveThinking) {
    maxTokens = resolvedMaxTokens;
    thinkingBlock = {
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
    };
    thinkingHeaders = undefined;
  } else if (thinking) {
    const modelMaxTokens = ANTHROPIC_MAX_TOKENS[baseModel] ?? resolvedMaxTokens;
    const defaultBudget =
      ANTHROPIC_THINKING_BUDGET[baseModel] ?? Math.floor(modelMaxTokens * 0.8);
    const MIN_THINKING_BUDGET = 1024;
    let thinkingBudget = Math.min(defaultBudget, Math.floor(resolvedMaxTokens * 0.8));
    thinkingBudget = Math.max(thinkingBudget, MIN_THINKING_BUDGET);
    maxTokens = Math.min(Math.max(resolvedMaxTokens, thinkingBudget + 1024), modelMaxTokens);
    thinkingBlock = {
      thinking: { type: "enabled", budget_tokens: thinkingBudget },
      temperature: 1,
    };
    thinkingHeaders = { "anthropic-beta": "interleaved-thinking-2025-05-14" };
  } else {
    maxTokens = resolvedMaxTokens;
    thinkingBlock = undefined;
    thinkingHeaders = undefined;
  }

  const anthropicMessages = toAnthropicMessages(messages);

  const anthropicBody: Record<string, unknown> = {
    model: baseModel,
    max_tokens: maxTokens,
    messages: anthropicMessages,
    stream: false,
    ...(systemContent ? { system: systemContent } : {}),
    ...(thinkingBlock ?? {}),
    ...(body.tools?.length ? { tools: toAnthropicTools(body.tools) } : {}),
  };

  const upstream = await fetchAnthropicRaw(baseUrl, apiKey, anthropicBody, "anthropic", undefined, thinkingHeaders);
  const responseText = await readResponseTextCapped(upstream);

  if (!upstream.ok) {
    const err = new Error(responseText) as Error & { status?: number };
    err.status = upstream.status;
    throw err;
  }

  const response = JSON.parse(responseText) as {
    id: string;
    content: Array<{
      type: string;
      text?: string;
      thinking?: string;
      id?: string;
      name?: string;
      input?: unknown;
    }>;
    usage: { input_tokens: number; output_tokens: number };
    stop_reason?: string;
  };

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const stopReason = response.stop_reason;
  let collectedText = "";
  let collectedThinking = "";
  const toolUseBlocks: { id: string; name: string; inputJson: string }[] = [];

  for (const block of response.content) {
    if (block.type === "text" && block.text) {
      collectedText += block.text;
    } else if (block.type === "thinking" && thinkingVisible && block.thinking) {
      collectedThinking += block.thinking;
    } else if (block.type === "tool_use") {
      toolUseBlocks.push({
        id: block.id ?? "",
        name: block.name ?? "",
        inputJson: JSON.stringify(block.input ?? {}),
      });
    }
  }

  if (toolUseBlocks.length > 0) {
    res.json({
      id: `chatcmpl-${response.id}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: collectedText || null,
            tool_calls: toolUseBlocks.map((tu, i) => ({
              id: tu.id || `call_${i}`,
              type: "function",
              function: { name: tu.name, arguments: tu.inputJson },
            })),
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
    });
  } else {
    const finalContent =
      thinkingVisible && collectedThinking
        ? `<think>\n${collectedThinking}\n</think>\n\n${collectedText}`
        : collectedText;

    res.json({
      id: `chatcmpl-${response.id}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: finalContent },
          finish_reason:
            stopReason === "end_turn" ? "stop" : (stopReason ?? "stop"),
        },
      ],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
    });
  }
  logUsage({ status: "success", statusCode: 200, inputTokens, outputTokens });
}

// Exported for use in proxy.ts error handling
export { getAnthropicMessagesUrl, buildAnthropicHeaders };
