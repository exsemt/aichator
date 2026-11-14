import { NextRequest } from "next/server";
import {
  ChatMessage,
  ProviderId,
  streamAntigravity,
  streamClaude,
  streamLocalOllama,
} from "@/lib/providers";
import { retrieveRelevantChunks } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const provider: ProviderId = body.provider || "antigravity";
  const model: string | undefined = body.model;
  const useRag: boolean = Boolean(body.useRag);
  const messages: ChatMessage[] = body.messages || [];

  const enrichedMessages: ChatMessage[] = [...messages];
  let ragSources: { id: string; text: string; score: number }[] = [];

  if (useRag && enrichedMessages.length > 0) {
    const lastIdx = enrichedMessages.length - 1;
    const userQuestion = enrichedMessages[lastIdx].content;
    const hits = await retrieveRelevantChunks(userQuestion, 2);
    ragSources = hits.map((h) => ({
      id: h.entry.id,
      text: h.entry.text,
      score: Number(h.score.toFixed(3)),
    }));

    if (hits.length > 0) {
      const contextBlock = hits.map((h) => h.entry.text).join("\n\n");

      // Insert RAG context as a system message so the model answers naturally
      // without echoing internal filenames or dumping unrelated sections.
      enrichedMessages.splice(lastIdx, 0, {
        role: "system",
        content: `Answer ONLY the user's question concisely and naturally in the same language as the user, using only the relevant facts from the reference notes below. Do NOT mention internal filenames, sources, or vector stores, and do NOT list pricing or privacy details unless the user specifically asks for them.\n\nReference notes:\n${contextBlock}`,
      });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (useRag && ragSources.length > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ ragSources })}\n\n`
            )
          );
        }

        let generator: AsyncGenerator<string, void, unknown>;
        if (provider === "claude") {
          generator = streamClaude(enrichedMessages, model);
        } else if (provider === "local") {
          generator = streamLocalOllama(enrichedMessages, model);
        } else {
          generator = streamAntigravity(enrichedMessages, model);
        }

        for await (const token of generator) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              token: `\n⚠️ Server error: ${String(err)}`,
            })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
