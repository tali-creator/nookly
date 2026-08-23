"use client";

/* Owner dashboard — ported 1:1 from nookly-frontend/owner/dashboard.html. */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MarketplaceShell from "@/components/MarketplaceShell";
import { apiGet, apiDelete } from "@/lib/api";
import { getToken, ensureSeedFromQuery } from "@/lib/auth";
import type { MyBusiness } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-primary/15 text-primary",
  REJECTED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-muted text-muted-foreground",
};

function StatusBadge({ status, note }: { status: string; note?: string | null }) {
  return (
    <>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
          STATUS_STYLES[status] || "bg-muted text-muted-foreground"
        }`}
      >
        {status}
      </span>
      {status === "REJECTED" && note ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <strong className="text-red-600">Reason:</strong> {note}
        </p>
      ) : null}
    </>
  );
}

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<MyBusiness[] | null>(null);
  const [error, setError] = useState("");
  const [visitors, setVisitors] = useState<string>("–");

  const load = useCallback(async () => {
    setBusinesses(null);
    setError("");
    try {
      const { data } = await apiGet<{ businesses: MyBusiness[] }>("/businesses/mine");
      setBusinesses(data.businesses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your businesses.");
    }
  }, []);

  useEffect(() => {
    ensureSeedFromQuery();
    if (!getToken()) {
      router.replace("/owner/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() resets to the loading state synchronously
    load();
    apiGet<{ visitors: number }>("/owners/me/visits")
      .then((res) => setVisitors((res.data.visitors || 0).toLocaleString()))
      .catch(() => {});
  }, [router, load]);

  async function handleDelete(b: MyBusiness) {
    if (!window.confirm(`Delete "${b.name}"? This cannot be undone.`)) return;
    try {
      await apiDelete("/businesses/" + b.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const items = businesses || [];
  const pendingCount = items.filter((b) => b.status === "PENDING").length;
  const approvedCount = items.filter((b) => b.status === "APPROVED").length;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketplaceShell active="owner">
        <section>
          <div className="mb-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Your Nookly
            </p>
            <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">Owner dashboard</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Manage your businesses, keep listings fresh, and see how customers are finding you.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
                <svg className="size-5" aria-hidden="true">
                  <use href="#i-store" />
                </svg>
                <p className="mt-8 text-3xl font-bold">{items.length}</p>
                <p className="text-sm opacity-80">Active businesses</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <svg className="size-5 text-primary" aria-hidden="true">
                  <use href="#i-clock-3" />
                </svg>
                <p className="mt-8 text-3xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending review</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <svg className="size-5 text-primary" aria-hidden="true">
                  <use href="#i-circle-check" />
                </svg>
                <p className="mt-8 text-3xl font-bold">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">Approved &amp; live</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <svg className="size-5 text-primary" aria-hidden="true">
                  <use href="#i-eye" />
                </svg>
                <p className="mt-8 text-3xl font-bold">{visitors}</p>
                <p className="text-sm text-muted-foreground">Profile visitors</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="font-mono sm:text-2xl font-bold">Your businesses</h2>
              <Link
                href="/owner/business-form"
                className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
              >
                <svg className="size-4" aria-hidden="true">
                  <use href="#i-plus" />
                </svg>
                Add business
              </Link>
            </div>

            <div className="grid gap-4">
              {businesses === null && !error ? (
                <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
                  Loading your businesses…
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
                  Could not load your businesses. {error}
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
                  You have no businesses yet. Add your first one to get started.
                </div>
              ) : (
                items.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-mono text-xl font-bold">{b.name}</h3>
                          <StatusBadge status={b.status} note={b.moderationNote} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {b.category ? b.category.name : ""}
                          {b.address ? " · " + b.address : ""}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Link
                          href={`/owner/business-form?id=${b.id}`}
                          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                        >
                          Edit listing
                        </Link>
                        <Link
                          href={`/owner/analytics?id=${b.id}`}
                          className="flex items-center gap-1 rounded-xl bg-muted px-4 py-2 text-sm font-semibold"
                        >
                          Analytics{" "}
                          <svg className="size-4" aria-hidden="true">
                            <use href="#i-chevron-right" />
                          </svg>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(b)}
                          className="rounded-xl border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Link
              href="/owner/kyc"
              className="rounded-2xl border border-primary/20 bg-primary/10 p-5 text-sm font-semibold"
            >
              Manage owner KYC verification{" "}
              <svg className="inline size-4" aria-hidden="true">
                <use href="#i-chevron-right" />
              </svg>
            </Link>
          </div>
        </section>
      </MarketplaceShell>
    </main>
  );
}
