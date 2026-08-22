"use client";

/* Admin moderation dashboard — ported 1:1 from nookly-frontend/admin/dashboard.html. */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MarketplaceShell from "@/components/MarketplaceShell";
import { apiGet, apiPatch } from "@/lib/api";
import { clearSession, ensureSeedFromQuery, getUser, getToken } from "@/lib/auth";
import type { AdminBusinessListResponse } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-primary/15 text-primary",
  REJECTED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-muted text-muted-foreground",
};

const TABS = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;

const QUEUE_MESSAGE =
  "rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof TABS)[number]>("PENDING");
  const [queue, setQueue] = useState<{ items?: AdminBusinessListResponse["data"]; error?: boolean } | null>(null);
  const [stats, setStats] = useState<{ PENDING: number | null; APPROVED: number | null; SUSPENDED: number | null }>({
    PENDING: null,
    APPROVED: null,
    SUSPENDED: null,
  });

  const loadQueue = useCallback(async (s: string) => {
    setQueue(null);
    try {
      const { data } = await apiGet<AdminBusinessListResponse>(
        "/admin/businesses?status=" + s + "&limit=100"
      );
      setQueue({ items: data.data || [] });
    } catch {
      setQueue({ error: true });
    }
  }, []);

  const countAll = useCallback(async () => {
    const statuses = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
    const counts = await Promise.all(
      statuses.map(async (s) => {
        try {
          const { data } = await apiGet<AdminBusinessListResponse>(
            "/admin/businesses?status=" + s + "&limit=1"
          );
          return data.total;
        } catch {
          return 0;
        }
      })
    );
    setStats({
      PENDING: counts[0],
      APPROVED: counts[1],
      SUSPENDED: counts[3],
    });
  }, []);

  useEffect(() => {
    ensureSeedFromQuery();
    // requireAdmin(): no token -> admin login; wrong role -> kick out.
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    const user = getUser();
    if (!user || user.role !== "ADMIN") {
      clearSession();
      router.replace("/admin/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadQueue() resets to the loading state synchronously
    loadQueue("PENDING");
    countAll();
  }, [router, loadQueue, countAll]);

  function switchTab(s: (typeof TABS)[number]) {
    setStatus(s);
    loadQueue(s);
  }

  async function act(b: { id: string }, path: string, body?: unknown, done = true) {
    try {
      await apiPatch("/admin/businesses/" + b.id + "/" + path, body);
      loadQueue(status);
      if (done) countAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : path.charAt(0).toUpperCase() + path.slice(1) + " failed");
    }
  }

  function approve(b: { id: string }) {
    act(b, "approve");
  }

  function reject(b: { id: string }) {
    const reason = window.prompt("Rejection reason (10+ characters):");
    if (reason === null) return;
    act(b, "reject", { reason });
  }

  function suspend(b: { id: string }) {
    const reason = window.prompt("Suspension reason (10+ characters):");
    if (reason === null) return;
    act(b, "suspend", { reason });
  }

  function feature(b: { id: string }) {
    const days = window.prompt("Feature duration in days (blank for indefinite):");
    act(
      b,
      "feature",
      days && days.trim() !== "" ? { durationDays: parseInt(days, 10) } : {},
      false
    );
  }

  function unfeature(b: { id: string }) {
    act(b, "unfeature", undefined, false);
  }

  return (
    <MarketplaceShell active="moderation" sidebar="admin">
      <section>
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Admin console
          </p>
          <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">
            Moderation dashboard
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Review businesses, KYC gates, and marketplace quality signals before listings go
            live.
          </p>
        </div>
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
              <p className="text-3xl font-bold">{stats.PENDING === null ? "0" : stats.PENDING.toLocaleString()}</p>
              <p className="mt-1 text-sm opacity-80">Pending listings</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-3xl font-bold">{stats.APPROVED === null ? "0" : stats.APPROVED.toLocaleString()}</p>
              <p className="mt-1 text-sm text-muted-foreground">Approved &amp; live</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-3xl font-bold">{stats.SUSPENDED === null ? "0" : stats.SUSPENDED.toLocaleString()}</p>
              <p className="mt-1 text-sm text-muted-foreground">Suspended</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xl font-bold">Business moderation queue</h2>
              <div className="flex overflow-hidden rounded-xl border border-border">
                {TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => switchTab(t)}
                    className={`px-3 py-2 text-xs font-bold ${
                      status === t ? "bg-primary/15 text-primary" : ""
                    }`}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {queue === null ? (
                <div className={QUEUE_MESSAGE}>Loading…</div>
              ) : queue.error ? (
                <div className={QUEUE_MESSAGE}>Could not load the queue.</div>
              ) : !queue.items?.length ? (
                <div className={QUEUE_MESSAGE}>No {status.toLowerCase()} businesses.</div>
              ) : (
                queue.items.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{b.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            STATUS_STYLES[b.status]
                          }`}
                        >
                          {b.status}
                        </span>
                        {b.isFeatured ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                            Featured
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {b.category ? b.category.name : ""} ·{" "}
                        {b.owner ? b.owner.email : ""}
                      </p>
                      {b.moderationNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <strong className="text-red-600">Note:</strong> {b.moderationNote}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={"/business/" + b.id}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:border-primary"
                      >
                        View
                      </Link>
                      {b.status !== "APPROVED" ? (
                        <button
                          type="button"
                          onClick={() => approve(b)}
                          className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                        >
                          Approve
                        </button>
                      ) : null}
                      {b.status === "APPROVED" ? (
                        <button
                          type="button"
                          onClick={() => suspend(b)}
                          className="rounded-lg border border-border px-3 py-2 text-xs font-bold"
                        >
                          Suspend
                        </button>
                      ) : null}
                      {b.status !== "APPROVED" && b.status !== "REJECTED" ? (
                        <button
                          type="button"
                          onClick={() => reject(b)}
                          className="rounded-lg border border-border px-3 py-2 text-xs font-bold"
                        >
                          Reject
                        </button>
                      ) : null}
                      {b.status === "APPROVED" && !b.isFeatured ? (
                        <button
                          type="button"
                          onClick={() => feature(b)}
                          className="rounded-lg border border-border px-3 py-2 text-xs font-bold"
                        >
                          Feature
                        </button>
                      ) : null}
                      {b.isFeatured ? (
                        <button
                          type="button"
                          onClick={() => unfeature(b)}
                          className="rounded-lg border border-border px-3 py-2 text-xs font-bold"
                        >
                          Unfeature
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </MarketplaceShell>
  );
}
