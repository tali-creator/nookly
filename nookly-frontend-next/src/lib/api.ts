import { API_BASE_URL } from "./config";

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
