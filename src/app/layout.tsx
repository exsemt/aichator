import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "aichator – Next.js Multi-LLM & RAG",
  description: "aichator Chat-Frontend für Antigravity, Claude und lokale LLMs (Ollama)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
