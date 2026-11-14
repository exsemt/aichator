# aichator – Next.js + TypeScript + Docker

Full-Stack AI-Chat-Applikation auf Basis von **Next.js (App Router & TypeScript)**, die komplett in **Docker** läuft und zwischen **Antigravity**, **Claude (Anthropic)** und **lokalen LLMs (Ollama)** umschalten kann.

## Projektstruktur
- `src/app/page.tsx` – Reaktive Chat-Oberfläche mit Modell-Umschalter und Echtzeit-Streaming
- `src/app/api/chat/route.ts` – Next.js Streaming-API-Route (`text/event-stream`)
- `src/lib/providers.ts` – Provider-Integrationen für Antigravity, Claude und Ollama
- `Dockerfile` – Multi-Stage-Build mit Next.js Standalone-Output (`node:20-alpine`)
- `docker-compose.yml` – Startet sowohl den Next.js-Webcontainer (`aichat-web`) als auch einen lokalen `ollama`-Container (`aichat-ollama`)

## Starten mit Docker Compose

1. Optional `.env` anlegen:
   ```bash
   cp .env.example .env
   ```
2. Container bauen und starten:
   ```bash
   docker compose up --build -d
   ```
3. Lokales Modell im Ollama-Container herunterladen (einmalig):
   ```bash
   docker exec -it aichat-ollama ollama pull llama3.2
   ```
4. Im Browser öffnen: `http://localhost:3000`
