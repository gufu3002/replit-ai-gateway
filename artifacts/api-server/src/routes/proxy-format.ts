import type { GeminiRequestBody } from "../lib/format";
import { logger } from "../lib/logger";

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: MessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OAIToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface OAITool {
  type: "function";
  function: OAIToolFunction;
}

export interface ChatCompletionRequestBody {
  model: string;
  // OpenAI format
  messages?: ChatMessage[];
  // Gemini format (auto-detected when present)
  contents?: GeminiRequestBody["contents"];
  systemInstruction?: GeminiRequestBody["systemInstruction"];
  generationConfig?: GeminiRequestBody["generationConfig"];
  // Tool / function calling
  tools?: OAITool[];
  tool_choice?: string | { type: string; function?: { name: string } };
  parallel_tool_calls?: boolean;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
}

// ---------------------------------------------------------------------------
// Tool format conversion helpers
// ---------------------------------------------------------------------------

/**
 * Converts OpenAI-format tool definitions to Anthropic format.
 */
export function toAnthropicTools(tools: OAITool[]): object[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? "",
    input_schema: t.function.parameters ?? { type: "object", properties: {} },
  }));
}

/**
 * Converts OpenAI-format messages to Anthropic-compatible messages,
 * handling tool_calls in assistant messages and tool result messages.
 */
export function toAnthropicMessages(messages: ChatMessage[]): object[] {
  const result: object[] = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];

    if (m.role === "system") continue;

    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      // Convert tool_calls to Anthropic tool_use blocks
      const content: object[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls) {
        let input: unknown = {};
        try {
          input = JSON.parse(tc.function.arguments);
        } catch {
          logger.warn("Failed to parse tool call arguments as JSON");
        }
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input,
        });
      }
      result.push({ role: "assistant", content });
    } else if (m.role === "tool") {
      // Tool results: group consecutive tool messages into one user message
      const toolResults: object[] = [];
      while (i < messages.length && messages[i].role === "tool") {
        const tm = messages[i];
        toolResults.push({
          type: "tool_result",
          tool_use_id: tm.tool_call_id ?? "",
          content: tm.content ?? "",
        });
        i++;
      }
      i--; // back up so the outer loop doesn't skip a message
      result.push({ role: "user", content: toolResults });
    } else {
      result.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content ?? "",
      });
    }
  }

  return result;
}

/**
 * Converts OpenAI-format tool definitions to Gemini functionDeclarations.
 */
export function toGeminiFunctionDeclarations(tools: OAITool[]): object[] {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description ?? "",
        parameters: t.function.parameters ?? { type: "object", properties: {} },
      })),
    },
  ];
}

/**
 * Converts OpenAI messages to Gemini contents, including function call/result parts.
 */
export function toGeminiContents(messages: ChatMessage[]): object[] {
  const result: object[] = [];

  // Pre-build a lookup map from tool_call_id → function_name.
  // In OpenAI's protocol, role:"tool" messages carry only tool_call_id;
  // the function name lives in the preceding assistant's tool_calls[].function.name.
  // Gemini's functionResponse.name must match the corresponding functionCall.name,
  // so we resolve the name here rather than falling back to the empty ChatMessage.name field.
  const toolCallNames = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) {
        toolCallNames.set(tc.id, tc.function.name);
      }
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "system") continue;

    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      const parts: object[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.tool_calls) {
        let args: unknown = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          logger.warn("Failed to parse tool call arguments as JSON for Gemini");
        }
        parts.push({ functionCall: { name: tc.function.name, args } });
      }
      result.push({ role: "model", parts });
    } else if (m.role === "tool") {
      const parts: object[] = [];
      while (i < messages.length && messages[i].role === "tool") {
        const tm = messages[i];
        // Resolve the function name via tool_call_id lookup; fall back to tm.name
        // if somehow not found (e.g. non-standard client omitting tool_calls on the assistant turn).
        const fnName =
          toolCallNames.get(tm.tool_call_id ?? "") ?? tm.name ?? "";
        let response: unknown = tm.content;
        try {
          response = JSON.parse(tm.content ?? "");
        } catch {
          logger.warn("Failed to parse tool result content as JSON");
        }
        parts.push({
          functionResponse: { name: fnName, response: { output: response } },
        });
        i++;
      }
      i--;
      result.push({ role: "user", parts });
    } else {
      result.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content ?? "" }],
      });
    }
  }

  return result;
}
