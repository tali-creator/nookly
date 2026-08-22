// Nookly frontend config.
// Set NEXT_PUBLIC_API_BASE_URL to your deployed backend (e.g. https://nookly-backend.fly.dev).
// Falls back to the local dev backend. A page can also override it at runtime
// by setting window.NOOKLY_API_BASE_URL before the app mounts.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== "undefined" &&
    (window as unknown as { NOOKLY_API_BASE_URL?: string }).NOOKLY_API_BASE_URL) ||
  "http://localhost:4000";

export const FALLBACK_LOCATION = { lat: 6.5244, lng: 3.3792 };
export const SEARCH_RADIUS_KM = 10;

// Backend-served asset paths (e.g. /uploads/xxx.png) are relative; prefix the
// API base so they resolve on any host.
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return API_BASE_URL + path;
}
