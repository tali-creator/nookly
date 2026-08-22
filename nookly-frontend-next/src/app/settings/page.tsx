"use client";

/* Settings — port 1:1 from nookly-frontend/settings.html. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountShell from "@/components/AccountShell";
import { apiPatch, ApiError } from "@/lib/api";
import { getToken, ensureSeedFromQuery } from "@/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ensureSeedFromQuery();
    if (!getToken()) {
      router.replace("/owner/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      setMessageIsError(true);
      return;
    }
    setSaving(true);
    try {
      await apiPatch("/account/password", {
        currentPassword,
        newPassword,
      });
      setMessage("Password updated. Use your new password next time you log in.");
      setMessageIsError(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const f = err instanceof ApiError ? err.fields : undefined;
      setMessage(
        (f && f.currentPassword?.[0]) ||
          (err instanceof Error ? err.message : "Could not update password.")
      );
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AccountShell active="settings">
        <section>
          <div className="mb-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Your Nookly
            </p>
            <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">Settings</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Control your communication choices and account security.
            </p>
          </div>

          {message ? (
            <p
              className={`mb-6 rounded-xl p-3 text-sm ${
                messageIsError ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"
              }`}
            >
              {message}
            </p>
          ) : null}

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <svg className="size-5 text-primary" aria-hidden="true">
                  <use href="#i-lock-keyhole" />
                </svg>
                <h2 className="font-mono text-xl font-bold">Change password</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Use a strong, unique password that you do not reuse elsewhere.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
                <label className="flex flex-col gap-2 text-sm font-semibold">
                  Current password
                  <input
                    required
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold">
                  New password
                  <input
                    required
                    minLength={8}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold">
                  Confirm new password
                  <input
                    required
                    minLength={8}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:opacity-90"
                >
                  {saving ? "Updating…" : "Update password"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </AccountShell>
    </main>
  );
}
