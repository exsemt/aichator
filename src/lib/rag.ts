import fs from "fs/promises";
import path from "path";

export interface VectorEntry {
  id: string;
  file: string;
  text: string;
  vector: number[];
}

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const VECTORS_FILE = path.join(KNOWLEDGE_DIR, "vectors.json");
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://ollama:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

/**
 * Berechnet einen kompakten lokalen Fallback-Vektor (64 Dimensionen) über Wort-/Zeichen-Trigramme,
 * falls in Ollama noch kein Embedding-Modell geladen wurde.
 */
function computeLocalFallbackVector(text: string, dims = 64): number[] {
  const vec = new Array(dims).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9äöüß\s]/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);

  for (const word of words) {
    let hash = 2166136261;
    for (let i = 0; i < word.length; i++) {
      hash ^= word.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const idx = Math.abs(hash) % dims;
    vec[idx] += 1;

    // Zeichen-Trigramme für Teilwort-Ähnlichkeit
    for (let i = 0; i <= word.length - 3; i++) {
      const tri = word.slice(i, i + 3);
      let thash = 0;
      for (let j = 0; j < tri.length; j++) {
        thash = (thash * 31 + tri.charCodeAt(j)) >>> 0;
      }
      vec[thash % dims] += 0.5;
    }
  }

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => Number((v / norm).toFixed(4)));
}

/**
 * Erzeugt einen Vektor über Ollama (/api/embed) oder nutzt den lokalen Fallback-Vektor.
 */
export async function embedText(text: string): Promise<number[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.embeddings?.[0]) && data.embeddings[0].length > 0) {
        return data.embeddings[0].map((n: number) => Number(n.toFixed(4)));
      }
    }
  } catch {
    // Fallback auf lokalen Vektor, falls Ollama oder nomic-embed-text nicht aktiv ist
  }
  return computeLocalFallbackVector(text);
}

/**
 * Cosine Similarity zwischen zwei Vektoren.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Liest alle .md und .txt Dateien aus `knowledge/`, teilt sie in Abschnitte
 * und speichert die Vektoren in `knowledge/vectors.json`.
 */
export async function rebuildVectorStore(): Promise<VectorEntry[]> {
  await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  const files = await fs.readdir(KNOWLEDGE_DIR);
  const docFiles = files.filter(
    (f) => (f.endsWith(".md") || f.endsWith(".txt")) && f !== "vectors.json"
  );

  const entries: VectorEntry[] = [];

  for (const file of docFiles) {
    const fullPath = path.join(KNOWLEDGE_DIR, file);
    const content = await fs.readFile(fullPath, "utf-8");
    // Teile nach Überschriften oder doppelten Zeilenumbrüchen
    const rawChunks = content
      .split(/\n(?=#{1,3}\s)|\n\s*\n/)
      .map((c) => c.trim())
      .filter((c) => c.length > 15);

    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i];
      const vector = await embedText(chunk);
      entries.push({
        id: `${file}#${i + 1}`,
        file,
        text: chunk,
        vector,
      });
    }
  }

  await fs.writeFile(VECTORS_FILE, JSON.stringify(entries, null, 2), "utf-8");
  return entries;
}

/**
 * Lädt `knowledge/vectors.json` (oder erstellt sie beim ersten Aufruf).
 */
export async function loadVectorStore(): Promise<VectorEntry[]> {
  try {
    const raw = await fs.readFile(VECTORS_FILE, "utf-8");
    return JSON.parse(raw) as VectorEntry[];
  } catch {
    return rebuildVectorStore();
  }
}

/**
 * Sucht die Top-K ähnlichsten Textabschnitte zur Nutzerfrage.
 */
export async function retrieveRelevantChunks(
  query: string,
  topK = 3
): Promise<{ entry: VectorEntry; score: number }[]> {
  const store = await loadVectorStore();
  if (store.length === 0) return [];

  const queryVec = await embedText(query);
  const scored = store.map((entry) => ({
    entry,
    score: cosineSimilarity(queryVec, entry.vector),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
