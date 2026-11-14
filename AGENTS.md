# AGENTS.md – AI Agent Guide for `aichator`

This file provides context, architectural rules, and workflow instructions for all AI coding agents working on this repository (**Google Antigravity**, **Claude Code**, **Gemini**, **Cursor**, **Codex**, etc.).

---

## 1. Project Overview (`aichator`)

**`aichator`** is a containerized Full-Stack Multi-LLM Chat & RAG application built with **Next.js 15 (App Router)**, **React 19**, **TypeScript 5.8**, and **Tailwind CSS**, running on **Node 24 (`node:24-alpine`)** and **Ollama** in Docker.

### Core Capabilities
1. **Multi-LLM Provider Switching (`src/lib/providers.ts`):**
   - **Local LLM (`local` / Ollama):** Connects to the `aichator-ollama` container (`http://ollama:11434`) supporting compact models (`llama3.2:1b`, `llama3.2:3b`, `qwen2.5:0.5b`) and the custom `aichator` profile built from `knowledge/Modelfile`.
   - **Anthropic Claude (`claude`):** Uses `@anthropic-ai/sdk` with streaming via `ANTHROPIC_API_KEY`.
   - **Google Antigravity (`antigravity`):** Connects via `ANTIGRAVITY_API_URL` or local `agy` CLI streaming.
2. **Minimal File-Based RAG (`src/lib/rag.ts`):**
   - Reads Markdown/Text documents from `knowledge/` (currently configured with domain knowledge for **xsatz.de** – E-Rechnung, XRechnung, ZUGFeRD, tariffs, and validation).
   - Splits documents into semantic chunks, computes embeddings (via Ollama `/api/embed` or deterministic 64D trigram/word vector fallback), and stores them locally in `knowledge/vectors.json`.
   - Performs Cosine Similarity lookup on every chat request when **📚 RAG** is enabled in the UI (`src/app/api/chat/route.ts`).

---

## 2. Directory & File Structure

- `src/app/page.tsx` – Main React 19 client chat interface with provider switcher, Ollama model selector (`aichator`, `llama3.2:1b`, etc.), RAG toggle, and live vector inspector panel.
- `src/app/api/chat/route.ts` – Streaming Server-Sent Events (`text/event-stream`) endpoint combining RAG retrieval with LLM token streaming.
- `src/app/api/knowledge/route.ts` – REST endpoint (`GET` / `POST`) to inspect `knowledge/vectors.json` and append new knowledge notes from the UI.
- `src/lib/providers.ts` – Streaming adapters for Ollama, Claude, and Antigravity.
- `src/lib/rag.ts` – Chunking, vector embedding, `knowledge/vectors.json` persistence, and Cosine Similarity search.
- `knowledge/` – Domain knowledge files (`xsatz_*.md`), Ollama `Modelfile`, and generated `vectors.json`.
- `Dockerfile` – 3-stage production build using `node:24-alpine` and Next.js `standalone` output.
- `docker-compose.yml` – Orchestrates `aichator-web` (port `3000`) and `aichator-ollama` (port `11434`).

---

## 3. Mandatory Instructions for AI Agents (Antigravity, Claude, Gemini)

### A. Always Use Context7 for Documentation & Library Lookups
- Whenever you write code, upgrade dependencies, or check APIs for **Next.js 15**, **React 19**, **Anthropic SDK**, **Tailwind CSS**, or **Node.js**, **always use Context7** (`context7` plugin / MCP tools `resolve-library-id` and `query-docs`) first to fetch up-to-date, version-specific documentation instead of relying on outdated training data.

### B. Maintain Modern Runtime & Dependencies
- Keep the Docker base image on the current Node version (`node:24-alpine` or newer) and maintain compatibility with **Next.js 15+** and **React 19+**.
- Ensure `npm run build` passes strict TypeScript type-checking inside Docker before finalizing changes.

### C. Docker & Ollama Workflow
- Build and start the stack:
  ```bash
  docker compose up --build -d
  ```
- Create or update the custom `aichator` Ollama profile from `knowledge/Modelfile`:
  ```bash
  docker exec aichator-ollama ollama pull llama3.2:1b
  docker exec aichator-ollama ollama create aichator -f /knowledge/Modelfile
  ```
