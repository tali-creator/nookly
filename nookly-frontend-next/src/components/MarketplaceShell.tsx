"use client";

/* Marketplace shell: header + sidebar, ported 1:1 from
   partials/header-marketplace.html and partials/sidebar-marketplace.html.
   `active` mirrors <body data-page="..."> for nav highlighting. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, getUser, saveSession, getToken } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import type { User } from "@/lib/types";

const NAV_ITEMS = [
  { key: "dashboard", href: "/dashboard", icon: "i-layout-dashboard", label: "Dashboard" },
  { key: "favorites", href: "/favorites", icon: "i-heart", label: "Favorites" },
  { key: "owner", href: "/owner/dashboard", icon: "i-store", label: "My businesses" },
  { key: "messages", href: "/owner/messages", icon: "i-message-circle", label: "Messages" },
  { key: "notifications", href: "/notifications", icon: "i-bell", label: "Notifications" },
  { key: "profile", href: "/profile", icon: "i-user-round", label: "Profile" },
];

/* sidebar-admin.html */
const ADMIN_NAV_ITEMS = [
  { key: "moderation", href: "/admin/dashboard", icon: "i-layout-dashboard", label: "Moderation" },
  { key: "kyc", href: "/admin/kyc-review", icon: "i-user-round", label: "KYC review" },
  { key: "users", href: "/admin/users", icon: "i-users", label: "Users" },
];

function roleLabel(user: User | null): string {
  if (!user || !user.email) return "Not signed in";
  if (user.role === "ADMIN") return "Administrator";
  if (user.role === "BUSINESS_OWNER") return "Business owner";
  return user.role;
}

export default function MarketplaceShell({
  active,
  children,
  sidebar = "customer",
}: {
  active: string;
  children: React.ReactNode;
  sidebar?: "customer" | "admin";
}) {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = sidebar === "admin" ? ADMIN_NAV_ITEMS : NAV_ITEMS;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only available after mount (avoids hydration mismatch)
    setUser(getUser());
  }, []);

  /* Refresh the cached user so the workspace card shows the current
     display name (falls back to email only when no name is set). */
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<{ user: User }>("/auth/me")
      .then((res) => {
        saveSession(res.data.user, token);
        setUser(res.data.user);
      })
      .catch(() => {});
  }, []);

  function handleSignOut() {
    signOut("/");
  }

  const name = user && user.email ? user.name || user.email : "Guest";
  const avatarLetter =
    user && user.email ? (user.name || user.email).slice(0, 1).toUpperCase() : "G";

  return (
    <>
      {/* header-marketplace.html */}
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Nookly home">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg className="size-5" aria-hidden="true">
                <use href="#i-sparkles" />
              </svg>
            </span>
            <span className="font-mono text-xl font-bold">nookly</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
            >
              Browse marketplace
            </Link>
            <NotificationBell />
            <Link
              href="/profile"
              className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground lg:flex"
            >
              <svg className="size-4" aria-hidden="true">
                <use href="#i-user-round" />
              </svg>
              Profile
            </Link>
            <Link
              href="/owner/dashboard"
              aria-label="Your workspace"
              className="hidden size-9 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary lg:flex"
            >
              {avatarLetter}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="flex size-9 items-center justify-center rounded-xl border border-border text-foreground lg:hidden"
            >
              <svg className="size-5" aria-hidden="true">
                <use href={menuOpen ? "#i-x" : "#i-menu"} />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav dropdown — overlays content (no layout shift) */}
      {menuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-20 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 top-0 max-h-full overflow-y-auto border-b border-border bg-background shadow-xl">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
              <div className="mb-2 rounded-2xl bg-primary/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-deep">
                  Nookly workspace
                </p>
                <p className="mt-2 font-bold text-primary-deep">{name}</p>
                <p className="text-sm text-primary-deep/80">{roleLabel(user)}</p>
              </div>
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${
                    active === item.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <svg className="size-4" aria-hidden="true">
                    <use href={`#${item.icon}`} />
                  </svg>
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleSignOut();
                }}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <svg className="size-4" aria-hidden="true">
                  <use href="#i-log-out" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* sidebar-marketplace.html + content grid */}
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[220px_1fr] lg:px-8 lg:py-12">
        <aside className="hidden lg:flex lg:flex-col">
          <div className="mb-3 hidden rounded-2xl bg-primary/10 p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-deep">
              Nookly workspace
            </p>
            <p className="mt-2 font-bold text-primary-deep">{name}</p>
            <p className="text-sm text-primary-deep/80">{roleLabel(user)}</p>
          </div>
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${
                active === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <svg className="size-4" aria-hidden="true">
                <use href={`#${item.icon}`} />
              </svg>
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <svg className="size-4" aria-hidden="true">
              <use href="#i-log-out" />
            </svg>
            Sign out
          </button>
        </aside>
        {children}
      </div>
    </>
  );
}
