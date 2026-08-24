import { API_BASE_URL } from "./config";

/* Local-machine GET cache.
   Responses are kept in an in-memory Map (survives SPA navigation / returning
   from another page) and mirrored to sessionStorage (survives a full reload).
   Each entry expires after CACHE_TTL ms (~2 minutes), after which the next
   request refetches. Any non-GET call invalidates the whole cache so writes are
   reflected on the next read. */
const CACHE_TTL = 2 * 60 * 1000;
const SS_KEY = "nookly:apicache";

type CacheEntry = { ts: number; data: unknown; text: string };
const memCache = new Map<string, CacheEntry>();

function loadSSCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(SS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}
function saveSSCache(map: Record<string, CacheEntry>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
function readCache(key: string): CacheEntry | null {
  const m = memCache.get(key);
  if (m && Date.now() - m.ts < CACHE_TTL) return m;
  const ss = loadSSCache();
  const s = ss[key];
  if (s && Date.now() - s.ts < CACHE_TTL) {
    memCache.set(key, s);
    return s;
  }
  return null;
}
function writeCache(key: string, data: unknown, text: string) {
  const entry: CacheEntry = { ts: Date.now(), data, text };
  memCache.set(key, entry);
  const ss = loadSSCache();
  ss[key] = entry;
  saveSSCache(ss);
}

export function invalidateApiCache(prefix?: string) {
  if (prefix) {
    for (const k of [...memCache.keys()]) if (k.startsWith(prefix)) memCache.delete(k);
    const ss = loadSSCache();
    let changed = false;
    for (const k of Object.keys(ss)) {
      if (k.startsWith(prefix)) {
        delete ss[k];
        changed = true;
      }
    }
    if (changed) saveSSCache(ss);
  } else {
    memCache.clear();
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(SS_KEY);
      } catch {
        /* ignore */
      }
    }
  }
}

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  text: string;
}

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string[]>;
  data?: unknown;
  constructor(message: string, status: number, fields?: Record<string, string[]>, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.data = data;
  }
}

function getToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem("nookly_token") || "";
  } catch {
    return "";
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("nookly_token");
    window.localStorage.removeItem("nookly_user");
  } catch {
    /* ignore */
  }
}

async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const options: RequestInit = { method, headers: {} as Record<string, string> };
  const token = getToken();
  if (token) (options.headers as Record<string, string>)["Authorization"] = "Bearer " + token;

  // GET requests are served from cache when fresh (keyed by URL + auth token).
  const cacheKey = method === "GET" ? API_BASE_URL + path + "|" + token : null;
  if (cacheKey) {
    const hit = readCache(cacheKey);
    if (hit) return { status: 200, data: hit.data as T, text: hit.text };
  }

  let isForm = false;
  if (body instanceof FormData) {
    isForm = true;
    options.body = body;
  } else if (body !== undefined && body !== null) {
    (options.headers as Record<string, string>)["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path, options);
  } catch {
    throw new ApiError(
      "Network error — is the backend running at " + API_BASE_URL + "?",
      0
    );
  }

  let data: T | null = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errBody = (data ?? {}) as { error?: string; fields?: Record<string, string[]> };
    if (res.status === 401 && token) {
      clearSession();
      if (typeof window !== "undefined") window.location.href = "/login";
    }
    throw new ApiError(
      errBody.error || `Request failed (${res.status})`,
      res.status,
      errBody.fields,
      data ?? undefined
    );
  }

  // Writes invalidate the GET cache so subsequent reads are fresh.
  if (method !== "GET") invalidateApiCache();

  return { status: res.status, data: (data as T) ?? ({} as T), text };
}

export function apiGet<T = unknown>(path: string) {
  return apiFetch<T>("GET", path);
}
export function apiPost<T = unknown>(path: string, body?: unknown) {
  return apiFetch<T>("POST", path, body);
}
export function apiPatch<T = unknown>(path: string, body?: unknown) {
  return apiFetch<T>("PATCH", path, body);
}
export function apiPut<T = unknown>(path: string, body?: unknown) {
  return apiFetch<T>("PUT", path, body);
}
export function apiDelete<T = unknown>(path: string, body?: unknown) {
  return apiFetch<T>("DELETE", path, body);
}
