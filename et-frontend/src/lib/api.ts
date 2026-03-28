import { getApiBaseUrl } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export type RequestOptions = {
  headers?: Record<string, string>;
};

async function request<T>(method: string, path: string, body?: unknown, options?: RequestOptions): Promise<{ data: T }> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = { ...(options?.headers || {}) };

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let reqBody: BodyInit | undefined;
  if (body instanceof FormData) {
    reqBody = body;
  } else if (body !== undefined && method !== "GET" && method !== "HEAD") {
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    reqBody = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers, body: reqBody });
  const data = await parseResponse(res);

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_id");
    const path = window.location.pathname || "";
    const onAuthPage = path.startsWith("/login") || path.startsWith("/register");
    if (!onAuthPage) window.location.href = "/login";
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText || "Request failed";
    throw new ApiError(res.status, msg, data);
  }

  return { data: data as T };
}

const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),
};

export default api;
