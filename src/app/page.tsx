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
  { id: "local", label: "Lokales LLM (Ollama)", subtitle: "Ollama Container" },
];

export default function ChatPage() {
  const [provider, setProvider] = useState<ProviderId>("local");
  const [localModel, setLocalModel] = useState("aichator");
  const [useRag, setUseRag] = useState<boolean>(true);
  const [showKnowledgePanel, setShowKnowledgePanel] = useState<boolean>(false);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntryPreview[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hallo! Du kannst oben das Modell wählen (Lokales Ollama-Modell, eigenes Ollama-Modelfile `aichat-custom`, Claude oder Antigravity) und per Schalter **📚 RAG (Vektorsuche)** dein eigenes Wissen aus `knowledge/vectors.json` dazuschalten.",
      provider: "local",
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
      // ignore
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
          title: "firmenwissen.md",
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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: provider === "local" ? localModel : undefined,
          useRag,
          messages: updated.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.body) throw new Error("Kein Stream vom Server erhalten.");

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
          content: `Fehler bei der Anfrage: ${String(err)}`,
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
          <h1 className="text-xl font-semibold text-white">aichator</h1>
          <p className="text-xs text-slate-400">
            Next.js + TypeScript · Minimales RAG & Ollama in Docker
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Provider Auswahl */}
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

          {/* Ollama Modell-Auswahl inkl. Modelfile-Variante */}
          {provider === "local" && (
            <select
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="aichator">
                aichator (Ollama Modelfile mit xsatz.de Wissen)
              </option>
              <option value="llama3.2:1b">llama3.2:1b (~1.3 GB Standard)</option>
              <option value="aichat-custom">
                aichat-custom (Ollama Modelfile)
              </option>
              <option value="llama3.2:3b">llama3.2:3b (~2.0 GB)</option>
              <option value="qwen2.5:0.5b">qwen2.5:0.5b (~400 MB)</option>
            </select>
          )}

          {/* RAG Toggle */}
          <button
            type="button"
            onClick={() => setUseRag((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              useRag
                ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            📚 RAG: {useRag ? "AN" : "AUS"}
          </button>

          {/* Wissens-Panel Toggle */}
          <button
            type="button"
            onClick={() => setShowKnowledgePanel((v) => !v)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:border-indigo-500 transition"
          >
            🗂️ Vektoren ({knowledgeEntries.length})
          </button>
        </div>
      </header>

      {/* Aufklappbares Wissens- & Vektor-Panel */}
      {showKnowledgePanel && (
        <section className="my-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-100">
                Lokale Vektordatei: <code>knowledge/vectors.json</code>
              </h2>
              <p className="text-slate-400">
                Jeder Abschnitt aus <code>knowledge/*.md</code> wird mit seinem Zahlen-Vektor lokal als JSON gespeichert.
              </p>
            </div>
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
                    Vektor ({item.dimensions}D): [{item.vectorPreview.join(", ")}, …]
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
              placeholder="Neues Wissen hinzufügen (z.B. 'Unser WLAN-Passwort im Büro heißt Sonne2026')..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={isSavingNote || !newNote.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-xl text-xs transition"
            >
              {isSavingNote ? "Speichert…" : "+ In Vektordatei speichern"}
            </button>
          </form>
        </section>
      )}

      {/* Chat-Verlauf */}
      <main className="flex-1 overflow-y-auto py-4 space-y-4">
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
                      · 📚 {msg.ragSources.length} RAG-Treffer aus vectors.json
                    </span>
                  )}
                </div>
              )}
              {msg.content || (isStreaming ? "…" : "")}

              {msg.ragSources && msg.ragSources.length > 0 && (
                <details className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-200">
                    Gefundene Wissens-Vektoren anzeigen
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
          placeholder="Frage stellen (z.B. 'Wie lautet der Projekt-Codename oder unsere Rückgabefrist?')..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-5 py-3 rounded-xl text-sm transition"
        >
          {isStreaming ? "Sendet…" : "Senden"}
        </button>
      </form>
    </div>
  );
}
