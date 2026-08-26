"use client";

/* Notifications — port 1:1 from nookly-frontend/notifications.html. */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountShell from "@/components/AccountShell";
import RequireAuth from "@/components/RequireAuth";
import { apiGet, apiPatch } from "@/lib/api";
import { getToken, ensureSeedFromQuery } from "@/lib/auth";
import type { AppNotification } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return min + "m ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h ago";
  const day = Math.floor(hr / 24);
  if (day < 7) return day + "d ago";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function icon(type: string): string {
  const icons: Record<string, string> = {
    BUSINESS_APPROVED: "#i-circle-check",
    BUSINESS_REJECTED: "#i-x-circle",
    BUSINESS_SUSPENDED: "#i-alert-triangle",
    KYC_VERIFIED: "#i-shield-check",
    KYC_REJECTED: "#i-shield-x",
    NEW_MESSAGE: "#i-message-circle",
  };
  return icons[type] || "#i-bell";
}

function hrefFor(n: AppNotification): string {
  const data = n.data || {};
  if (n.type === "KYC_VERIFIED" || n.type === "KYC_REJECTED") return "/owner/kyc";
  if (
    n.type === "BUSINESS_APPROVED" ||
    n.type === "BUSINESS_REJECTED" ||
    n.type === "BUSINESS_SUSPENDED"
  ) {
    return data.businessId
      ? "/owner/business-form?id=" + data.businessId
      : "/owner/dashboard";
  }
  if (n.type === "NEW_MESSAGE") {
    return data.businessId
      ? "/owner/messages?businessId=" + data.businessId
      : "/owner/messages";
  }
  return "/notifications";
}

function setGlobalUnread(n: number) {
  window.dispatchEvent(new CustomEvent("nookly:unread", { detail: n }));
}

/* Relative decrement — mirrors setUnreadCount(getUnreadCount() - 1). */
function decGlobalUnread() {
  window.dispatchEvent(new CustomEvent("nookly:unread-dec"));
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    ensureSeedFromQuery();
    if (!getToken()) {
      router.replace("/owner/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (next: boolean) => {
    const targetPage = next ? page + 1 : 1;
    try {
      const res = await apiGet<{
        notifications: AppNotification[];
        hasMore: boolean;
        unreadCount: number;
      }>("/notifications?page=" + targetPage);
      const list = res.data.notifications || [];
      setItems((prev) => (next ? [...prev, ...list] : list));
      setPage(targetPage);
      setHasMore(!!res.data.hasMore);
      setError("");
      setLoaded(true);
      setGlobalUnread(res.data.unreadCount || 0);
    } catch (err) {
      setLoaded(true);
      setError(err instanceof Error ? err.message : "Please try again.");
    }
  }, [page]);

  useEffect(() => {
    if (!getToken()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markRead(id: string) {
    apiPatch("/notifications/" + id + "/read").catch(() => {});
    decGlobalUnread();
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
  }

  function handleRowClick(n: AppNotification) {
    if (!n.read) markRead(n.id);
  }

  async function markAllRead() {
    try {
      await apiPatch("/notifications/read-all");
      setGlobalUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to mark all read");
    }
  }

  const allRead = items.length > 0 && items.every((n) => n.read);

  return (
    <RequireAuth>
    <main className="min-h-screen bg-background text-foreground">
      <AccountShell active="notifications">
        <section>
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Inbox
              </p>
              <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">
                Notifications
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Updates about your businesses, verification, and customer messages.
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={allRead}
              className="self-start rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50 sm:self-auto"
            >
              <span className="hidden items-center gap-2">
                <svg className="size-4" aria-hidden="true">
                  <use href="#i-circle-check" />
                </svg>
                Mark all read
              </span>
            </button>
          </div>

          {!loaded && !error ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
              Loading notifications…
            </div>
          ) : null}

          {loaded && items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center">
              <svg className="mx-auto size-8 text-muted-foreground" aria-hidden="true">
                <use href="#i-bell" />
              </svg>
              {error ? null : (
                <>
                  <h2 className="mt-4 font-mono text-xl font-bold">You&rsquo;re all caught up</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    New notifications will show up here.
                  </p>
                </>
              )}
              {error ? (
                <>
                  <h2 className="mt-4 font-mono text-xl font-bold">
                    Could not load notifications
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                </>
              ) : null}
            </div>
          ) : null}

          {items.length > 0 ? (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={hrefFor(n)}
                  onClick={() => handleRowClick(n)}
                  className="flex gap-3 px-5 py-4 transition hover:bg-muted"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <svg className="size-4" aria-hidden="true">
                      <use href={icon(n.type)} />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{n.title}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                      {n.body}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground/70">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {!n.read ? (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </Link>
              ))}
            </div>
          ) : null}

          {hasMore ? (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => load(true)}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition hover:bg-muted"
              >
                Load more
              </button>
            </div>
          ) : null}
        </section>
      </AccountShell>
    </main>
    </RequireAuth>
  );
}
