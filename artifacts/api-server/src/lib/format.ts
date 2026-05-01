/**
 * Format conversion utilities between OpenAI, Claude, and Gemini message formats.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface TextPart {
  type: "text";
  text: string;
}

export interface ImageUrlPart {
  type: "image_url";
  image_url: { url: string; detail?: string };
}

export type ContentPart = TextPart | ImageUrlPart | string;

export interface ToolCallEntry {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OpenAIMessage {
  role: Role;
  content: ContentPart | ContentPart[] | null;
  tool_calls?: ToolCallEntry[];
  tool_call_id?: string;
}

// ---------------------------------------------------------------------------
// Gemini native format types
// ---------------------------------------------------------------------------

export interface GeminiTextPart {
  text: string;
}

export interface GeminiInlineDataPart {
  inlineData: { mimeType: string; data: string };
}

export type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiGenerationConfig {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  candidateCount?: number;
  stopSequences?: string[];
  thinkingConfig?: { thinkingBudget?: number };
}

export interface GeminiRequestBody {
  model?: string;
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] } | string;
  generationConfig?: GeminiGenerationConfig;
  stream?: boolean;
}

// ---------------------------------------------------------------------------
// Claude native format types
// ---------------------------------------------------------------------------

export interface ClaudeTextContent {
  type: "text";
  text: string;
}

export interface ClaudeImageContent {
  type: "image";
  source: { type: "base64"; media_type: string; data: string } | { type: "url"; url: string };
}

export interface ClaudeToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string | ClaudeContent[];
}

export type ClaudeContent = ClaudeTextContent | ClaudeImageContent | ClaudeToolUseContent | ClaudeToolResultContent;

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContent[];
}

export interface ClaudeTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface ClaudeRequestBody {
  model: string;
  max_tokens?: number;
  messages: ClaudeMessage[];
  system?: string;
  stream?: boolean;
  thinking?: { type: "enabled"; budget_tokens: number };
  temperature?: number;
  tools?: ClaudeTool[];
  tool_choice?: { type: "auto" | "any" | "none" | "tool"; name?: string };
}

// ---------------------------------------------------------------------------
// Conversion: Gemini → OpenAI messages
// ---------------------------------------------------------------------------

/**
 * Extracts plain text from a Gemini parts array.
 */
function geminiPartsToText(parts: GeminiPart[]): string {
  return parts
    .map((p) => ("text" in p ? p.text : ""))
    .filter(Boolean)
    .join("");
}

/**
 * Converts Gemini-format parts to OpenAI content parts (with image support).
 */
function geminiPartsToOpenAIContent(parts: GeminiPart[]): ContentPart[] {
  return parts.map((p) => {
    if ("inlineData" in p) {
      return {
        type: "image_url" as const,
        image_url: {
          url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
        },
      };
    }
    return { type: "text" as const, text: p.text };
  });
}

/**
 * Converts a Gemini request body into a list of OpenAI-format messages.
 */
export function geminiToOpenAIMessages(body: GeminiRequestBody): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];

  // Extract system instruction
  if (body.systemInstruction) {
    let systemText = "";
    if (typeof body.systemInstruction === "string") {
      systemText = body.systemInstruction;
    } else if (body.systemInstruction.parts) {
      systemText = geminiPartsToText(body.systemInstruction.parts);
    }
    if (systemText) {
      messages.push({ role: "system", content: systemText });
    }
  }

  // Convert contents
  for (const c of body.contents) {
    const role: Role = c.role === "model" ? "assistant" : "user";
    const contentParts = geminiPartsToOpenAIContent(c.parts);
    const content: ContentPart | ContentPart[] =
      contentParts.length === 1 && typeof contentParts[0] === "object" && "type" in contentParts[0] && contentParts[0].type === "text"
        ? (contentParts[0] as TextPart).text
        : contentParts;
    messages.push({ role, content });
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Conversion: Claude → OpenAI messages
// ---------------------------------------------------------------------------

/**
 * Converts Claude-format content blocks to OpenAI content parts.
 * Only processes text and image blocks; tool blocks are handled separately.
 */
function claudeContentToOpenAI(content: string | ClaudeContent[]): ContentPart | ContentPart[] {
  if (typeof content === "string") return content;
  const parts: ContentPart[] = content
    .filter((c) => c.type === "text" || c.type === "image")
    .map((c) => {
      if (c.type === "image") {
        const src = (c as ClaudeImageContent).source;
        const url =
          src.type === "base64"
            ? `data:${src.media_type};base64,${src.data}`
            : src.url;
        return { type: "image_url" as const, image_url: { url } };
      }
      return { type: "text" as const, text: (c as ClaudeTextContent).text };
    });
  return parts.length === 1 ? parts[0] : parts;
}

/**
 * Converts a Claude request body into a list of OpenAI-format messages,
 * including proper handling of tool_use blocks in assistant turns and
 * tool_result blocks in user turns.
 */
export function claudeToOpenAIMessages(body: ClaudeRequestBody): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];

  if (body.system) {
    messages.push({ role: "system", content: body.system });
  }

  for (const m of body.messages) {
    // String content — simple pass-through
    if (typeof m.content === "string") {
      messages.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
      continue;
    }

    // Assistant message: check for tool_use blocks
    if (m.role === "assistant") {
      const toolUseBlocks = m.content.filter((c): c is ClaudeToolUseContent => c.type === "tool_use");
      if (toolUseBlocks.length > 0) {
        const textContent = m.content
          .filter((c): c is ClaudeTextContent => c.type === "text")
          .map((c) => c.text)
          .join("") || null;
        messages.push({
          role: "assistant",
          content: textContent,
          tool_calls: toolUseBlocks.map((tu) => ({
            id: tu.id,
            type: "function" as const,
            function: { name: tu.name, arguments: JSON.stringify(tu.input) },
          })),
        });
        continue;
      }
    }

    // User message: check for tool_result blocks
    if (m.role === "user") {
      const toolResultBlocks = m.content.filter((c): c is ClaudeToolResultContent => c.type === "tool_result");
      if (toolResultBlocks.length > 0) {
        // Any non-tool-result content comes first as a regular user turn
        const nonToolContent = m.content.filter((c) => c.type !== "tool_result") as ClaudeContent[];
        if (nonToolContent.length > 0) {
          messages.push({ role: "user", content: claudeContentToOpenAI(nonToolContent) });
        }
        // Each tool_result becomes a separate role:"tool" message
        for (const tr of toolResultBlocks) {
          const toolContent =
            typeof tr.content === "string"
              ? tr.content
              : (tr.content as ClaudeContent[])
                  .filter((c): c is ClaudeTextContent => c.type === "text")
                  .map((c) => c.text)
                  .join("");
          messages.push({ role: "tool", content: toolContent, tool_call_id: tr.tool_use_id });
        }
        continue;
      }
    }

    // Regular message with only text/image content
    messages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: claudeContentToOpenAI(m.content),
    });
  }

  return messages;
}

/**
 * Converts Claude-format tool definitions to OpenAI-format tools.
 */
export function claudeToolsToOpenAI(tools: ClaudeTool[]): object[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters: t.input_schema,
    },
  }));
}

/**
 * Converts a Claude tool_choice value to the equivalent OpenAI tool_choice value.
 *
 * Mapping:
 *  {type:"auto"}        → "auto"
 *  {type:"any"}         → "required"  (force any tool use)
 *  {type:"none"}        → "none"
 *  {type:"tool",name}   → {type:"function", function:{name}}
 */
export function claudeToolChoiceToOpenAI(
  toolChoice: ClaudeRequestBody["tool_choice"],
): string | { type: "function"; function: { name: string } } | undefined {
  if (!toolChoice) return undefined;
  switch (toolChoice.type) {
    case "auto": return "auto";
    case "any":  return "required";
    case "none": return "none";
    case "tool": return { type: "function", function: { name: toolChoice.name ?? "" } };
    default:     return undefined;
  }
}

/**
 * Extracts plain text from an OpenAI content field.
 */
export function extractText(content: ContentPart | ContentPart[] | null): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === "string" ? p : "type" in p && p.type === "text" ? (p as TextPart).text : ""))
      .join("");
  }
  return "";
}
