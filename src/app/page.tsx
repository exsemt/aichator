"use client";

import React, { useState, useRef, useEffect } from "react";

type ProviderId = "antigravity" | "claude" | "local";

interface RagSource {
  id: string;
  text: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  provider?: ProviderId;
  ragSources?: RagSource[];
  isWelcome?: boolean;
}

interface KnowledgeEntryPreview {
  id: string;
  file: string;
  text: string;
  vectorPreview: number[];
  dimensions: number;
}

const PROVIDERS: { id: ProviderId; label: string; subtitle: string }[] = [
  { id: "antigravity", label: "Antigravity", subtitle: "Google AGY" },
  { id: "claude", label: "Claude", subtitle: "Anthropic Cloud" },
  { id: "local", label: "Local LLM (Ollama)", subtitle: "Ollama Container" },
];

/**
 * Lightweight inline Markdown formatter for bold (**text**) and inline code (`code`).
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function ChatPage() {
  const [provider, setProvider] = useState<ProviderId>("local");
  const [localModel, setLocalModel] = useState("aichator");
  const [claudeModel, setClaudeModel] = useState("claude-sonnet-5-5");
  const [useRag, setUseRag] = useState<boolean>(true);
  const [showKnowledgePanel, setShowKnowledgePanel] = useState<boolean>(false);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntryPreview[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! Select your preferred model above (`aichator`, standard Ollama models, Claude, or Antigravity) and toggle **📚 RAG** to include your custom knowledge from `knowledge/vectors.json`.",
      provider: "local",
      isWelcome: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchKnowledge() {
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) {
        const data = await res.json();
        setKnowledgeEntries(data.entries || []);
      }
    } catch {
      // Ignore initial fetch errors
    }
  }

  async function handleRebuildVectors() {
    setIsSavingNote(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });
      if (res.ok) {
        const data = await res.json();
        setKnowledgeEntries(data.entries || []);
      }
    } finally {
      setIsSavingNote(false);
    }
  }

  useEffect(() => {
    fetchKnowledge();
  }, []);

  async function handleAddKnowledge(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim() || isSavingNote) return;
    setIsSavingNote(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "custom_notes.md",
          content: newNote.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setKnowledgeEntries(data.entries || []);
        setNewNote("");
      }
    } finally {
      setIsSavingNote(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    setMessages([...updated, { role: "assistant", content: "", provider }]);
    setInput("");
    setIsStreaming(true);

    // Exclude the static UI welcome message so it does not pollute the LLM context
    const apiMessages = updated
      .filter((m) => !m.isWelcome && m.content.trim().length > 0)
      .map(({ role, content }) => ({ role, content }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model:
            provider === "local"
              ? localModel
              : provider === "claude"
              ? claudeModel
              : undefined,
          useRag,
          messages: apiMessages,
        }),
      });

      if (!response.body) throw new Error("No response stream received from server.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const payload = part.slice(6).trim();
          if (payload === "[DONE]") break;
          const parsed = JSON.parse(payload);
          if (parsed.ragSources) {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = {
                ...last,
                ragSources: parsed.ragSources,
              };
              return copy;
            });
          }
          if (parsed.token) {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = {
                ...last,
                content: last.content + parsed.token,
              };
              return copy;
            });
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Request error: ${String(err)}`,
          provider,
        };
        return copy;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-semibold text-white">AIChator</h1>
          <p className="text-xs text-slate-400">
            Next.js 15 + TypeScript · Minimal RAG & Ollama in Docker
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Provider selector */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  provider === p.id
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Claude model selector */}
          {provider === "claude" && (
            <select
              value={claudeModel}
              onChange={(e) => setClaudeModel(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (Default)</option>
              <option value="claude-opus-5-5">Claude Opus 5.5 (Agentic & Coding)</option>
              <option value="claude-haiku-5-5">Claude Haiku 5.5 (Fast)</option>
              <option value="claude-fable-5-2">Claude Fable 5.2 (Reasoning)</option>
            </select>
          )}

          {/* Ollama model selector including custom Modelfile profile */}
          {provider === "local" && (
            <select
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="aichator">
                aichator (Ollama Modelfile with xsatz.de knowledge)
              </option>
              <option value="llama3.2:1b">llama3.2:1b (~1.3 GB default)</option>
              <option value="aichat-custom">
                aichat-custom (Ollama Modelfile)
              </option>
              <option value="llama3.2:3b">llama3.2:3b (~2.0 GB)</option>
              <option value="qwen2.5:0.5b">qwen2.5:0.5b (~400 MB)</option>
            </select>
          )}

          {/* RAG toggle */}
          <button
            type="button"
            onClick={() => setUseRag((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              useRag
                ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            📚 RAG: {useRag ? "ON" : "OFF"}
          </button>

          {/* Knowledge base panel toggle */}
          <button
            type="button"
            onClick={() => setShowKnowledgePanel((v) => !v)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:border-indigo-500 transition"
          >
            🗂️ Vectors ({knowledgeEntries.length})
          </button>
        </div>
      </header>

      {/* Collapsible knowledge base and vector store inspector panel */}
      {showKnowledgePanel && (
        <section className="my-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-100">
                Local Vector Store: <code>knowledge/vectors.json</code>
              </h2>
              <p className="text-slate-400">
                Every chunk from <code>knowledge/*.md</code> is stored locally as JSON alongside its numeric embedding vector.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRebuildVectors}
              disabled={isSavingNote}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 transition"
            >
              🔄 Rebuild Vectors
            </button>
          </div>

          <div className="grid gap-2 max-h-44 overflow-y-auto pr-1">
            {knowledgeEntries.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between text-[11px] text-indigo-400 font-mono">
                  <span>{item.id}</span>
                  <span>
                    Vector ({item.dimensions}D): [{item.vectorPreview.join(", ")}, …]
                  </span>
                </div>
                <p className="text-slate-300 line-clamp-2">{item.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddKnowledge} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add new knowledge chunk to vector store..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={isSavingNote || !newNote.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-xl text-xs transition"
            >
              {isSavingNote ? "Saving…" : "+ Save to Vector Store"}
            </button>
          </form>
        </section>
      )}

      {/* Chat message history */}
      <main className="flex-1 overflow-y-auto py-4 pr-1 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-900 border border-slate-800 text-slate-100"
              }`}
            >
              {msg.role === "assistant" && msg.provider && (
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-indigo-400 mb-1 font-semibold">
                  <span>{msg.provider}</span>
                  {msg.ragSources && msg.ragSources.length > 0 && (
                    <span className="text-emerald-400">
                      · 📚 {msg.ragSources.length} RAG matches
                    </span>
                  )}
                </div>
              )}
              <div>
                {msg.content
                  ? renderInlineMarkdown(msg.content)
                  : isStreaming
                  ? "…"
                  : ""}
              </div>

              {msg.ragSources && msg.ragSources.length > 0 && (
                <details className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-200">
                    Show matched knowledge vectors
                  </summary>
                  <div className="mt-1.5 space-y-1">
                    {msg.ragSources.map((s) => (
                      <div
                        key={s.id}
                        className="p-2 rounded bg-slate-950/70 border border-slate-800/80"
                      >
                        <span className="text-emerald-400 font-mono">
                          {s.id} (Score: {s.score})
                        </span>
                        <p className="text-slate-300 mt-0.5">{s.text}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      <form
        onSubmit={sendMessage}
        className="pt-3 border-t border-slate-800 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question (e.g., 'What are the pricing tiers of xsatz.de?')..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-5 py-3 rounded-xl text-sm transition"
        >
          {isStreaming ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
