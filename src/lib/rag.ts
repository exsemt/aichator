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
 * Computes a compact local fallback vector (64 dimensions) using word and character trigrams
 * when no dedicated embedding model is loaded in Ollama yet.
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

    // Character trigrams for sub-word similarity
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
 * Generates an embedding vector via Ollama (/api/embed) or falls back to the local vector computation.
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
    // Fallback to local deterministic vector if Ollama or nomic-embed-text is unavailable
  }
  return computeLocalFallbackVector(text);
}

/**
 * Computes Cosine Similarity between two numeric vectors.
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
 * Reads all .md and .txt files from `knowledge/`, splits them into chunks,
 * and persists the resulting vectors to `knowledge/vectors.json`.
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
    // Split by level-2 markdown headings (## ) and filter out standalone title lines
    const rawChunks = content
      .split(/\n(?=##\s)/)
      .map((c) => c.trim())
      .filter((c) => c.length > 90);

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
 * Loads `knowledge/vectors.json` from disk (or builds it on first access).
 */
export async function loadVectorStore(): Promise<VectorEntry[]> {
  try {
    const raw = await fs.readFile(VECTORS_FILE, "utf-8");
    return JSON.parse(raw) as VectorEntry[];
  } catch {
    return rebuildVectorStore();
  }
}

const SYNONYM_EXPANSIONS: Record<string, string[]> = {
  kosten: ["preise", "tarife", "gebühren", "euro", "monat", "kostenlos", "free", "pro", "business"],
  kostet: ["preise", "tarife", "gebühren", "euro", "monat", "kostenlos", "free", "pro", "business"],
  preis: ["preise", "tarife", "kosten", "euro", "monat", "free", "pro", "business"],
  preise: ["tarife", "kosten", "euro", "monat", "free", "pro", "business"],
  tarif: ["tarife", "preise", "kosten", "free", "pro", "business"],
  was: ["übersicht", "allgemeine", "beschreibung", "kernfunktionen", "plattform"],
  wer: ["übersicht", "allgemeine", "beschreibung", "anbieter"],
  funktion: ["kernfunktionen", "übersicht", "features", "validierung"],
  funktionen: ["kernfunktionen", "übersicht", "features", "validierung"],
};

/**
 * Retrieves the top-K most relevant text chunks for a given user query
 * using hybrid scoring (Cosine Similarity + keyword/synonym matching).
 */
export async function retrieveRelevantChunks(
  query: string,
  topK = 4
): Promise<{ entry: VectorEntry; score: number }[]> {
  const store = await loadVectorStore();
  if (store.length === 0) return [];

  const queryVec = await embedText(query);
  const queryWords = query
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const expandedKeywords = new Set<string>(queryWords);
  for (const w of queryWords) {
    const syns = SYNONYM_EXPANSIONS[w];
    if (syns) {
      for (const s of syns) expandedKeywords.add(s);
    }
  }

  const scored = store.map((entry) => {
    const cosine = cosineSimilarity(queryVec, entry.vector);
    const hay = `${entry.file} ${entry.text}`.toLowerCase();

    let keywordBoost = 0;
    for (const kw of expandedKeywords) {
      if (hay.includes(kw)) {
        keywordBoost += queryWords.includes(kw) ? 0.12 : 0.08;
      }
    }

    // Prefer substantive paragraphs over short headers
    const lengthBonus = entry.text.length > 120 ? 0.05 : -0.15;

    return {
      entry,
      score: cosine + keywordBoost + lengthBonus,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
