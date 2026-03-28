const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5000";

export async function callAI<T = unknown>(
  endpoint: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`AI service error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
