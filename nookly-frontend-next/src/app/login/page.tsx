"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { apiPost, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import type { LoginResponse, User } from "@/lib/types";

function dashboardPath(user: User): string {
  if (user.role === "ADMIN") return "/admin/dashboard";
  if (user.role === "BUSINESS_OWNER") return "/owner/dashboard";
  return "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const { data } = await apiPost<LoginResponse>("/auth/login", {
        email: email.trim(),
        password,
      });
      saveSession(data.user, data.token);
      router.push(dashboardPath(data.user));
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
    <AuthShell>
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9">
        <h1 className="font-mono text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-muted-foreground">
          Log in to manage your bookings and profile.
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
        <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Email
            <input
              required
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Password
            <input
              required
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-7 text-center text-sm text-muted-foreground">
          New to Nookly?{" "}
          <Link href="/signup" className="font-bold text-primary">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
