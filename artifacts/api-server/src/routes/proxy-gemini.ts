import type { Response } from "express";
import {
  GEMINI_MAX_TOKENS,
  GEMINI_THINKING_BUDGET,
  resolveMaxTokens,
} from "../lib/model-limits";
import { parseThinkingSuffix, flushRes } from "../lib/providers";
import { GEMINI_THINKING_CAPABLE } from "./proxy-models";
import {
  toGeminiContents,
  toGeminiFunctionDeclarations,
  type ChatCompletionRequestBody,
  type ChatMessage,
} from "./proxy-format";
import { sseChunk } from "./proxy-sse";
import type { LogUsage } from "./proxy-usage";
import {
  getGeminiCredentials,
  fetchGeminiRaw,
  parseGeminiSSE,
} from "./proxy-raw";

/**
 * Maps a Gemini finishReason string to the equivalent OpenAI finish_reason.
 * Gemini reasons: STOP, MAX_TOKENS, SAFETY, RECITATION, BLOCKLIST,
 *   PROHIBITED_CONTENT, SPII, MALFORMED_FUNCTION_CALL, OTHER, UNSPECIFIED.
 */
function mapGeminiFinishReason(reason: string | undefined): string {
  switch (reason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "RECITATION":
    case "BLOCKLIST":
    case "PROHIBITED_CONTENT":
    case "SPII":
      return "content_filter";
    // MALFORMED_FUNCTION_CALL means Gemini attempted but failed to produce a
    // valid function call. Mapping to "tool_calls" would be wrong: clients
    // receiving "tool_calls" expect valid tool_calls[] entries to process and
    // would loop indefinitely. "stop" is the correct safe fallback here.
    case "MALFORMED_FUNCTION_CALL":
      return "stop";
    default:
      return "stop";
  }
}

export async function handleGeminiStream(
  body: ChatCompletionRequestBody,
  model: string,
  messages: ChatMessage[],
  res: Response,
  trackFirstToken: () => void,
  logUsage: LogUsage,
): Promise<void> {
  const { baseModel, thinking, thinkingVisible } = parseThinkingSuffix(model);
  const { baseUrl, apiKey } = getGeminiCredentials();

  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Please set the API Key in settings.",
    );
  }

  const systemContent = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content ?? "")
    .join("\n");
  const maxTokens = resolveMaxTokens(
    GEMINI_MAX_TOKENS,
    baseModel,
    body.max_tokens ?? body.max_completion_tokens,
  );
  const thinkingBudget =
    GEMINI_THINKING_BUDGET[baseModel] ?? Math.floor(maxTokens * 0.4);
  const geminiContents = toGeminiContents(messages);

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: maxTokens,
  };
  if (thinking && GEMINI_THINKING_CAPABLE.has(baseModel)) {
    generationConfig.thinkingConfig = { thinkingBudget };
  }

  const geminiBody: Record<string, unknown> = {
    contents: geminiContents,
    generationConfig,
    ...(systemContent
      ? { systemInstruction: { parts: [{ text: systemContent }] } }
      : {}),
    ...(body.tools?.length
      ? { tools: toGeminiFunctionDeclarations(body.tools) }
      : {}),
  };

  const upstream = await fetchGeminiRaw(
    baseUrl,
    apiKey,
    baseModel,
    "streamGenerateContent",
    geminiBody,
  );

  if (!upstream.ok) {
    const errText = await upstream.text();
    const err = new Error(errText) as Error & { status?: number };
    err.status = upstream.status;
    throw err;
  }

  if (!upstream.body) {
    throw new Error("No response body from Gemini");
  }

  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  let thinkingStarted = false;
  let thinkingEnded = false;
  let geminiStreamInputTokens = 0;
  let geminiStreamOutputTokens = 0;
  let lastGeminiFinishReason: string | undefined;

  for await (const chunk of parseGeminiSSE(upstream.body)) {
    const meta = chunk.usageMetadata as
      | { promptTokenCount?: number; candidatesTokenCount?: number }
      | undefined;
    if (meta) {
      geminiStreamInputTokens =
        meta.promptTokenCount ?? geminiStreamInputTokens;
      geminiStreamOutputTokens =
        meta.candidatesTokenCount ?? geminiStreamOutputTokens;
    }
    const candidates = chunk.candidates as
      | Array<{
          content?: { parts?: Array<{ text?: string; thought?: boolean }> };
          finishReason?: string;
        }>
      | undefined;
    if (!candidates) continue;

    for (const candidate of candidates) {
      if (candidate.finishReason)
        lastGeminiFinishReason = candidate.finishReason;
      const parts = candidate.content?.parts ?? [];
      for (const part of parts) {
        const isThought = part.thought === true;
        const text = part.text ?? "";
        if (!text) continue;

        if (isThought && thinkingVisible) {
          if (!thinkingStarted) {
            thinkingStarted = true;
            res.write(
              sseChunk(id, created, model, {
                role: "assistant",
                content: "<think>\n",
              }),
            );
            flushRes(res);
          }
          res.write(
            sseChunk(id, created, model, { role: "assistant", content: text }),
          );
          flushRes(res);
        } else if (!isThought) {
          trackFirstToken();
          if (thinkingStarted && !thinkingEnded) {
            thinkingEnded = true;
            res.write(
              sseChunk(id, created, model, {
                role: "assistant",
                content: "\n</think>\n\n",
              }),
            );
            flushRes(res);
          }
          res.write(
            sseChunk(id, created, model, { role: "assistant", content: text }),
          );
          flushRes(res);
        }
      }
    }
  }

  res.write(
    sseChunk(
      id,
      created,
      model,
      {},
      mapGeminiFinishReason(lastGeminiFinishReason),
    ),
  );
  logUsage({
    status: "success",
    statusCode: 200,
    inputTokens: geminiStreamInputTokens,
    outputTokens: geminiStreamOutputTokens,
  });
}

export async function handleGeminiNonStream(
  body: ChatCompletionRequestBody,
  model: string,
  messages: ChatMessage[],
  res: Response,
  logUsage: LogUsage,
): Promise<void> {
  const { baseModel, thinking, thinkingVisible } = parseThinkingSuffix(model);
  const { baseUrl, apiKey } = getGeminiCredentials();

  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Please set the API Key in settings.",
    );
  }

  const systemContent = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content ?? "")
    .join("\n");
  const maxTokens = resolveMaxTokens(
    GEMINI_MAX_TOKENS,
    baseModel,
    body.max_tokens ?? body.max_completion_tokens,
  );
  const thinkingBudget =
    GEMINI_THINKING_BUDGET[baseModel] ?? Math.floor(maxTokens * 0.4);
  const geminiContents = toGeminiContents(messages);

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: maxTokens,
  };
  if (thinking && GEMINI_THINKING_CAPABLE.has(baseModel)) {
    generationConfig.thinkingConfig = { thinkingBudget };
  }

  const geminiBody: Record<string, unknown> = {
    contents: geminiContents,
    generationConfig,
    ...(systemContent
      ? { systemInstruction: { parts: [{ text: systemContent }] } }
      : {}),
    ...(body.tools?.length
      ? { tools: toGeminiFunctionDeclarations(body.tools) }
      : {}),
  };

  const upstream = await fetchGeminiRaw(
    baseUrl,
    apiKey,
    baseModel,
    "generateContent",
    geminiBody,
  );
  const responseBuffer = await upstream.arrayBuffer();
  const responseText = new TextDecoder().decode(responseBuffer);

  if (!upstream.ok) {
    const err = new Error(responseText) as Error & { status?: number };
    err.status = upstream.status;
    throw err;
  }

  const geminiResponse = JSON.parse(responseText) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
      finishReason?: string;
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };

  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  let collectedText = "";
  let collectedThinking = "";
  let geminiFinishReason: string | undefined;

  for (const candidate of geminiResponse.candidates ?? []) {
    if (candidate.finishReason) geminiFinishReason = candidate.finishReason;
    for (const part of candidate.content?.parts ?? []) {
      const text = part.text ?? "";
      if (!text) continue;
      if (part.thought === true) {
        collectedThinking += text;
      } else {
        collectedText += text;
      }
    }
  }

  const geminiInputTokens = geminiResponse.usageMetadata?.promptTokenCount ?? 0;
  const geminiOutputTokens =
    geminiResponse.usageMetadata?.candidatesTokenCount ?? 0;

  const finalContent =
    thinkingVisible && collectedThinking
      ? `<think>\n${collectedThinking}\n</think>\n\n${collectedText}`
      : collectedText;

  res.json({
    id,
    object: "chat.completion",
    created,
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: finalContent },
        finish_reason: mapGeminiFinishReason(geminiFinishReason),
      },
    ],
    usage: {
      prompt_tokens: geminiInputTokens,
      completion_tokens: geminiOutputTokens,
      total_tokens: geminiInputTokens + geminiOutputTokens,
    },
  });
  logUsage({
    status: "success",
    statusCode: 200,
    inputTokens: geminiInputTokens,
    outputTokens: geminiOutputTokens,
  });
}
