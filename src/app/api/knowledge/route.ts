import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { loadVectorStore, rebuildVectorStore } from "@/lib/rag";

export const runtime = "nodejs";

export async function GET() {
  const entries = await loadVectorStore();
  return NextResponse.json({
    count: entries.length,
    vectorsFile: "knowledge/vectors.json",
    entries: entries.map((e) => ({
      id: e.id,
      file: e.file,
      text: e.text,
      vectorPreview: e.vector.slice(0, 6),
      dimensions: e.vector.length,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = (body.title || "notiz.md").replace(/[^a-zA-Z0-9_-]/g, "_");
  const content = (body.content || "").trim();

  if (content) {
    const fileName = title.endsWith(".md") ? title : `${title}.md`;
    const filePath = path.join(process.cwd(), "knowledge", fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `\n\n${content}\n`, "utf-8");
  }

  const entries = await rebuildVectorStore();
  return NextResponse.json({
    count: entries.length,
    entries: entries.map((e) => ({
      id: e.id,
      file: e.file,
      text: e.text,
      vectorPreview: e.vector.slice(0, 6),
      dimensions: e.vector.length,
    })),
  });
}
