import { NextRequest, NextResponse } from "next/server";

/** Only forward to FastAPI paths we expose — avoids open proxy / SSRF. */
const ALLOWED_PREFIXES = ["/ai/", "/calc/"];

function resolveBackendBaseUrl(): string {
  const fromService = process.env.AI_SERVICE_URL?.trim();
  if (fromService) return fromService.replace(/\/$/, "");

  const aiPort = process.env.AI_PORT?.trim();
  if (aiPort?.startsWith("http")) return aiPort.replace(/\/$/, "");
  if (aiPort && /^\d+$/.test(aiPort)) return `http://127.0.0.1:${aiPort}`;

  return "http://127.0.0.1:8000";
}

function isAllowedEndpoint(endpoint: string): boolean {
  if (!endpoint.startsWith("/") || endpoint.includes("..")) return false;
  return ALLOWED_PREFIXES.some((p) => endpoint.startsWith(p));
}

export async function POST(req: NextRequest) {
  let payload: { endpoint?: string; body?: unknown };
  try {
    payload = (await req.json()) as { endpoint?: string; body?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = typeof payload.endpoint === "string" ? payload.endpoint : "";
  if (!isAllowedEndpoint(endpoint)) {
    return NextResponse.json({ error: "Disallowed endpoint" }, { status: 400 });
  }

  const base = resolveBackendBaseUrl();
  const url = `${base}${endpoint}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.body ?? {}),
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: "Backend error", status: res.status, detail: text.slice(0, 500) },
        { status: res.status >= 500 ? 502 : res.status },
      );
    }

    try {
      return NextResponse.json(JSON.parse(text) as unknown);
    } catch {
      return NextResponse.json({ error: "Backend returned non-JSON", detail: text.slice(0, 200) }, { status: 502 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: "Cannot reach AI backend", detail: msg, hint: `Expected server at ${base}. Set AI_SERVICE_URL in et-frontend/.env.local` },
      { status: 503 },
    );
  }
}
