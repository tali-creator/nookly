"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { apiPost, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import type { LoginResponse } from "@/lib/types";

export default function OwnerSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const { data } = await apiPost<LoginResponse>("/auth/signup", {
        email: email.trim(),
        password,
        confirmPassword,
        dateOfBirth: dateOfBirth || undefined,
        role: "BUSINESS_OWNER",
      });
      saveSession(data.user, data.token);
      router.push("/owner/dashboard");
    } catch (err) {
      let text = err instanceof ApiError ? err.message : "Signup failed. Please try again.";
      if (err instanceof ApiError && err.fields) {
        const fieldMsg =
          err.fields.email?.[0] ||
          err.fields.password?.[0] ||
          err.fields.confirmPassword?.[0] ||
          err.fields.dateOfBirth?.[0];
        if (fieldMsg) text = fieldMsg;
      }
      setMessage({ text, error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="rounded-3xl border border-border bg-card p-7 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">owner portal</p>
        <h1 className="mt-3 font-mono text-3xl font-bold">Create your owner account</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          List your services and reach more local customers.
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
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
          />
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Date of birth
            <input
              type="date"
              max="2010-01-01"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="rounded-xl border border-border bg-background px-4 py-3 font-normal text-foreground outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Creating account…" : (
              <>
                Continue
                <svg className="size-4" aria-hidden="true">
                  <use href="#i-arrow-right" />
                </svg>
              </>
            )}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already an owner?{" "}
          <Link href="/owner/login" className="font-bold text-primary">
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
