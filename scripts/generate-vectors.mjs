import fs from "fs/promises";
import path from "path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const VECTORS_FILE = path.join(KNOWLEDGE_DIR, "vectors.json");
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

function computeLocalFallbackVector(text, dims = 64) {
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

async function embedText(text) {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.embeddings?.[0]) && data.embeddings[0].length > 0) {
        return data.embeddings[0].map((n) => Number(n.toFixed(4)));
      }
    }
  } catch {
    // Fallback to deterministic local vector
  }
  return computeLocalFallbackVector(text);
}

async function main() {
  await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  const files = await fs.readdir(KNOWLEDGE_DIR);
  const docFiles = files
    .filter((f) => (f.endsWith(".md") || f.endsWith(".txt")) && f !== "vectors.json")
    .sort();

  const entries = [];
  for (const file of docFiles) {
    const fullPath = path.join(KNOWLEDGE_DIR, file);
    const content = await fs.readFile(fullPath, "utf-8");
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
  console.log(`Generated ${VECTORS_FILE} with ${entries.length} chunks from ${docFiles.length} files.`);
}

main().catch((err) => {
  console.error("Failed to generate vectors:", err);
  process.exit(1);
});
