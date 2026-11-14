import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "child_process";

export type ProviderId = "antigravity" | "claude" | "local";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-4-hydrogen";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://ollama:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";

export async function* streamClaude(
  messages: ChatMessage[],
  model?: string
): AsyncGenerator<string, void, unknown> {
  if (!ANTHROPIC_API_KEY) {
    yield "⚠️ Please set `ANTHROPIC_API_KEY` in your `.env` file or `docker-compose.yml` to use Claude.";
    return;
  }

  const systemMessages = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const conversationMessages = messages
    .filter((m): m is { role: "user" | "assistant"; content: string } =>
      m.role === "user" || m.role === "assistant"
    );

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const stream = await client.messages.stream({
    model: model || CLAUDE_MODEL,
    max_tokens: 2048,
    system: systemMessages || undefined,
    messages: conversationMessages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

export async function* streamAntigravity(
  messages: ChatMessage[],
  model?: string
): AsyncGenerator<string, void, unknown> {
  // Option C: Direct Google Gemini Cloud API streaming when GEMINI_API_KEY is configured
  if (GEMINI_API_KEY) {
    const targetModel = model || GEMINI_MODEL;
    const systemText = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const contents = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      targetModel
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY)}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(systemText
            ? {
                system_instruction: { parts: [{ text: systemText }] },
              }
            : {}),
          contents,
        }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        yield `⚠️ Google Gemini API responded with status ${res.status}${
          errBody ? `: ${errBody.slice(0, 240)}` : ""
        }`;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const parts = parsed?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (typeof part?.text === "string" && part.text.length > 0) {
                  yield part.text;
                }
              }
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
      return;
    } catch (err) {
      yield `⚠️ Failed to connect to Google Gemini API: ${String(err)}`;
      return;
    }
  }

  const prompt = messages[messages.length - 1]?.content || "";
  const agyEndpoint = process.env.ANTIGRAVITY_API_URL;

  if (agyEndpoint) {
    try {
      const res = await fetch(`${agyEndpoint.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model }),
      });
      if (!res.ok || !res.body) {
        yield `⚠️ Antigravity endpoint responded with status ${res.status}.`;
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
      return;
    } catch (err) {
      yield `⚠️ Failed to reach ANTIGRAVITY_API_URL: ${String(err)}`;
      return;
    }
  }

  // Fallback: invoke local `agy` CLI if installed in the container or host
  try {
    const child = spawn("agy", ["chat", "--prompt", prompt]);
    let hasOutput = false;

    for await (const chunk of child.stdout) {
      hasOutput = true;
      yield chunk.toString();
    }

    if (!hasOutput) {
      yield "⚠️ Please set `GEMINI_API_KEY` in your `.env` file (get a free key at https://aistudio.google.com/apikey) or configure `ANTIGRAVITY_API_URL`.";
    }
  } catch {
    yield "⚠️ Please set `GEMINI_API_KEY` in your `.env` file (get a free key at https://aistudio.google.com/apikey) and restart Docker Compose to use Google Gemini.";
  }
}

export async function* streamLocalOllama(
  messages: ChatMessage[],
  model?: string
): AsyncGenerator<string, void, unknown> {
  const targetModel = model || OLLAMA_MODEL;
  const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/chat`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: targetModel,
        messages,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      yield `⚠️ Ollama responded with status ${response.status}. Ensure the model \`${targetModel}\` is pulled (\`docker exec -it aichator-ollama ollama run ${targetModel}\`).`;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const data = JSON.parse(line);
        const token = data?.message?.content;
        if (token) yield token;
      }
    }
  } catch (err) {
    yield `⚠️ Could not connect to Ollama at \`${OLLAMA_BASE_URL}\` (${String(
      err
    )}).`;
  }
}
