/**
 * Resolves FastAPI base URL on the server only (Next.js route handlers, RSC).
 * Client code must use /api/ai/call — browser cannot read AI_SERVICE_URL.
 */
export function resolveAiBackendBaseUrl(): string {
  const fromService = process.env.AI_SERVICE_URL?.trim();
  if (fromService) return fromService.replace(/\/$/, "");

  const aiPort = process.env.AI_PORT?.trim();
  if (aiPort?.startsWith("http")) return aiPort.replace(/\/$/, "");
  if (aiPort && /^\d+$/.test(aiPort)) return `http://127.0.0.1:${aiPort}`;

  return "http://127.0.0.1:8000";
}

export async function callAI<T = unknown>(endpoint: string, body: unknown): Promise<T> {
  if (typeof window !== "undefined") {
    const res = await fetch("/api/ai/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, body }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const j = (await res.json()) as { detail?: string; hint?: string; error?: string };
        detail = j.detail || j.hint || j.error || "";
      } catch {
        detail = await res.text();
      }
      throw new Error(`AI service error: ${res.status}${detail ? ` — ${detail}` : ""}`);
    }
    return res.json() as Promise<T>;
  }

  const base = resolveAiBackendBaseUrl();
  const res = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`AI service error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
