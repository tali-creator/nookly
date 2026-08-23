"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { apiPost, ApiError } from "@/lib/api";
import { getUser, getToken, saveSession, clearSession } from "@/lib/auth";
import type { LoginResponse } from "@/lib/types";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in as an admin? Straight to the dashboard.
  useEffect(() => {
    const existing = getUser();
    if (existing && existing.role === "ADMIN" && getToken()) {
      router.replace("/admin/dashboard");
    }
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const { data } = await apiPost<LoginResponse>("/auth/login", {
        email: email.trim(),
        password,
      });
      if (data.user.role !== "ADMIN") {
        clearSession();
        setMessage({ text: "This account is not an administrator.", error: true });
        return;
      }
      saveSession(data.user, data.token);
      router.push("/admin/dashboard");
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : "Login failed. Please try again.",
        error: true,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell variant="admin">
      <div className="rounded-3xl border border-border bg-card p-7 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">admin portal</p>
        <h1 className="mt-3 font-mono text-3xl font-bold">Welcome back</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sign in as an administrator.
        </p>
        {message ? (
          <p
            className={`mt-5 rounded-xl p-3 text-sm ${
              message.error ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"
            }`}
          >
            {message.text}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
          <input
            type="email"
            required
            autoComplete="username"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : (
              <>
                Continue
                <svg className="size-4" aria-hidden="true">
                  <use href="#i-arrow-right" />
                </svg>
              </>
            )}
          </button>
        </form>
        <Link href="/login" className="mt-4 block text-center text-sm font-bold text-primary hover:underline">
          Back to customer login
        </Link>
      </div>
    </AuthShell>
  );
}
