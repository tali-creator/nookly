"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { apiPost, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import type { LoginResponse } from "@/lib/types";

export default function SignupPage() {
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
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9">
        <h1 className="font-mono text-3xl font-bold">Create your account</h1>
        <p className="mt-2 text-muted-foreground">Join a friendlier way to get things done.</p>
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
              minLength={8}
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Confirm password
            <input
              required
              minLength={8}
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Date of birth
            <input
              type="date"
              name="dateOfBirth"
              max="2010-01-01"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-7 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-primary">
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
