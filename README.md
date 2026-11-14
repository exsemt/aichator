# aichator – Next.js 15 + TypeScript + Docker (Multi-LLM & Minimal RAG)

Full-stack AI chat application built with **Next.js 15 (App Router & TypeScript)** and **React 19** running on **Node 24 Alpine** in **Docker**. Supports seamless switching between **Google Antigravity**, **Anthropic Claude**, and **local LLMs via Ollama**, plus a lightweight file-based **RAG (Retrieval-Augmented Generation)** engine.

## Project Structure
- `src/app/page.tsx` – Reactive chat UI with model switcher, real-time token streaming, RAG toggle, and live vector store inspector
- `src/app/api/chat/route.ts` – Next.js streaming API route (`text/event-stream`) with optional RAG context injection
- `src/app/api/knowledge/route.ts` – API endpoint (`GET` / `POST`) to inspect `knowledge/vectors.json` and append new knowledge documents
- `src/lib/providers.ts` – Streaming provider integrations for Antigravity, Claude, and Ollama
- `src/lib/rag.ts` – Minimal file-based RAG module (chunking, Ollama/fallback embeddings, Cosine Similarity search)
- `knowledge/` – Markdown knowledge base (`xsatz_*.md`), local vector store (`vectors.json`), and custom Ollama `Modelfile`
- `Dockerfile` – Multi-stage production build using `node:24-alpine` and Next.js standalone output
- `docker-compose.yml` – Runs both the Next.js web container (`aichator-web`) and the local `ollama` container (`aichator-ollama`)

## Quick Start with Docker Compose

1. Optionally create a `.env` file:
   ```bash
   cp .env.example .env
   ```
2. Build and start the containers:
   ```bash
   docker compose up --build -d
   ```
3. Pull the compact base model and create the custom `aichator` Ollama profile (one-time setup):
   ```bash
   docker exec -it aichator-ollama ollama pull llama3.2:1b
   docker exec -it aichator-ollama ollama create aichator -f /knowledge/Modelfile
   ```
4. Open in browser: `http://localhost:3000`

## License
MIT License – see [LICENSE](./LICENSE).
