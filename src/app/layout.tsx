import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIChator – Next.js Multi-LLM & RAG",
  description: "AIChator: Multi-LLM chat frontend for Antigravity, Claude, and local LLMs (Ollama) with file-based RAG",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
