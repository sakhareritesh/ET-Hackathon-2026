/**
 * When true (default), all finance features run in the browser with no backend.
 * Set NEXT_PUBLIC_USE_LOCAL_ENGINE=false to use the API routes instead.
 */
export function isLocalEngineMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_LOCAL_ENGINE !== "false";
}

export function getApiBaseUrl(): string {
  return "/api";
}
