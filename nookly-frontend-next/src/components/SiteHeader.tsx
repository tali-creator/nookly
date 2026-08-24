"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, signOut } from "@/lib/auth";
import type { User } from "@/lib/types";

function dashboardHref(role?: string): string {
  if (role === "ADMIN") return "/admin";
  if (role === "BUSINESS_OWNER") return "/owner";
  return "/dashboard";
}

export default function SiteHeader() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function handleSignOut() {
    signOut();
    setUser(null);
    setMenuOpen(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Nookly home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <svg className="size-5">
              <use href="#i-sparkles" />
            </svg>
          </span>
          <span className="font-mono text-xl font-bold tracking-tight">nookly</span>
        </Link>

        <nav className="hidden items-center md:flex" aria-label="Main navigation">
          <div className="flex items-center gap-8">
            <a href="/#services" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              Browse services
            </a>
            <a href="/#how-it-works" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              How it works
            </a>
            <Link href="/owner" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              Become a pro
            </Link>
          </div>
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          {user ? (
            <>
              <button
                type="button"
                aria-label="Notifications"
                className="rounded-full p-2.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <svg className="size-5">
                  <use href="#i-bell" />
                </svg>
              </button>
              <Link
                href={dashboardHref(user.role)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <svg className="size-4">
                  <use href="#i-layout-dashboard" />
                </svg>
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="rounded-full p-2.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <svg className="size-5">
                  <use href="#i-log-out" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg p-2 md:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg className="size-5">
            <use href={menuOpen ? "#i-x" : "#i-menu"} />
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-border bg-background px-5 py-5 md:hidden">
          <nav className="flex flex-col gap-5 text-sm font-medium">
            <a href="/#services" onClick={() => setMenuOpen(false)} className="text-muted-foreground transition hover:text-foreground">
              Browse services
            </a>
            <a href="/#how-it-works" onClick={() => setMenuOpen(false)} className="text-muted-foreground transition hover:text-foreground">
              How it works
            </a>
            <Link href="/owner" onClick={() => setMenuOpen(false)} className="text-muted-foreground transition hover:text-foreground">
              Become a pro
            </Link>
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              {user ? (
                <>
                  <Link href={dashboardHref(user.role)} onClick={() => setMenuOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-center text-white">
                    <svg className="size-4">
                      <use href="#i-layout-dashboard" />
                    </svg>
                    Dashboard
                  </Link>
                  <button type="button" onClick={handleSignOut} className="rounded-full bg-primary px-5 py-3 text-center text-white">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-full border border-border px-4 py-3 text-center text-sm font-semibold transition hover:bg-muted"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-full bg-primary px-5 py-3 text-center text-white"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
