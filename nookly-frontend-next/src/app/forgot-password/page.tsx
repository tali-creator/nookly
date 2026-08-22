"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { apiPost, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      await apiPost("/auth/forgot-password", { email: email.trim() });
      setMessage({
        text: "If an account exists for this email, a reset link has been sent. Check your inbox.",
        error: false,
      });
      setEmail("");
    } catch (err) {
      let text = err instanceof ApiError ? err.message : "Request failed. Please try again.";
      if (err instanceof ApiError && err.fields?.email?.[0]) text = err.fields.email[0];
      setMessage({ text, error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9">
        <h1 className="font-mono text-3xl font-bold">Reset your password</h1>
        <p className="mt-2 text-muted-foreground">Enter your email and we&apos;ll send a reset link.</p>
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
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p className="mt-7 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-bold text-primary">
            Back to login
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
