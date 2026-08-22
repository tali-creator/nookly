import type { User } from "./types";

const TOKEN_KEY = "nookly_token";
const USER_KEY = "nookly_user";

export function saveSession(user: User, token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function signOut(redirectTo = "/"): void {
  clearSession();
  if (typeof window !== "undefined") window.location.href = redirectTo;
}

/* Dev-only test affordance: seed a session from query params so guarded pages
   can be driven by headless-browser checks without a login round-trip.
   Compiled out in production builds (NODE_ENV is inlined at build time). */
export function ensureSeedFromQuery(): void {
  if (process.env.NODE_ENV === "production") return;
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("_seed_token");
  if (!token) return;
  let user: User | null = null;
  try {
    user = JSON.parse(params.get("_seed_user") || "null") as User | null;
  } catch {
    user = null;
  }
  saveSession(
    user || { id: "", email: "", role: "BUSINESS_OWNER" },
    token
  );
  params.delete("_seed_token");
  params.delete("_seed_user");
  const qs = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
}
