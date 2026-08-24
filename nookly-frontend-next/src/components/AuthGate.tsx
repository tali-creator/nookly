"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { getUser } from "@/lib/auth";

interface AuthGateContextValue {
  // Returns true if the visitor is logged in; otherwise opens the login
  // prompt and returns false. Call before performing a gated action.
  guard: () => boolean;
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used within AuthGateProvider");
  return ctx;
}

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const guard = (): boolean => {
    if (getUser()) return true;
    setOpen(true);
    return false;
  };

  return (
    <AuthGateContext.Provider value={{ guard }}>
      {children}
      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setOpen(false)}
              />
              <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
                <h3 className="font-mono text-lg font-bold">Sign in to continue</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Create an account or log in to save favorites and message business
                  owners.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  <Link
                    href="/login"
                    className="rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground transition hover:opacity-90"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-xl border border-border px-4 py-3 text-center text-sm font-bold text-foreground transition hover:bg-muted"
                  >
                    Sign up
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="mt-1 text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </AuthGateContext.Provider>
  );
}
