"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { apiPost, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ text: "New password and confirmation do not match.", error: true });
      return;
    }
    setLoading(true);
    try {
      await apiPost("/auth/reset-password", { token, newPassword });
      setMessage({
        text: "Password updated. You can now log in with your new password.",
        error: false,
      });
      setDone(true);
    } catch (err) {
      let text = err instanceof ApiError ? err.message : "Could not reset your password.";
      if (err instanceof ApiError && err.fields?.newPassword?.[0]) text = err.fields.newPassword[0];
      setMessage({ text, error: true });
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9">
        <h1 className="font-mono text-3xl font-bold">Choose a new password</h1>
        <p className="mt-2 text-muted-foreground">Set a new password for your account.</p>
        <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          This reset link is invalid or has expired, please request a new one.
        </p>
        <p className="mt-7 text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-bold text-primary">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9">
      <h1 className="font-mono text-3xl font-bold">Choose a new password</h1>
      <p className="mt-2 text-muted-foreground">Set a new password for your account.</p>
      {message ? (
        <p
          className={`mt-5 rounded-xl p-3 text-sm ${
            message.error ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"
          }`}
        >
          {message.text}
        </p>
      ) : null}
      {!done ? (
        <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            New password
            <input
              required
              minLength={8}
              type="password"
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Confirm new password
            <input
              required
              minLength={8}
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      ) : (
        <p className="mt-7 text-center text-sm">
          <Link href="/login" className="font-bold text-primary">
            Go to login
          </Link>
        </p>
      )}
      {!done ? (
        <p className="mt-7 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-bold text-primary">
            Back to login
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
