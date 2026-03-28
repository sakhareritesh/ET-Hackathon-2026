/**
 * Local engine mode is strictly disabled.
 * Everything hits the MongoDB backend now.
 */
export function isLocalEngineMode(): boolean {
  return false;
}

export function getApiBaseUrl(): string {
  return "/api";
}
