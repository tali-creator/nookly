"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MarketplaceShell from "@/components/MarketplaceShell";
import { apiGet } from "@/lib/api";
import { ensureSeedFromQuery, getToken } from "@/lib/auth";

interface Biz {
  id: string;
  name: string;
  status: string;
  isFeatured: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-primary/15 text-primary",
  REJECTED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-muted text-muted-foreground",
};

export default function OwnerAnalyticsPage() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<string>("–");
  const [businesses, setBusinesses] = useState<Biz[] | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    ensureSeedFromQuery();
    if (!getToken()) {
      router.replace("/owner/login");
      return;
    }
    const focus = new URLSearchParams(window.location.search).get("id");
    setFocusId(focus);

    apiGet<{ visitors: number }>("/owners/me/visits")
      .then((r) => setVisitors((r.data.visitors || 0).toLocaleString()))
      .catch(() => {});
    apiGet<{ businesses: Biz[] }>("/businesses/mine")
      .then((r) => setBusinesses(r.data.businesses || []))
      .catch(() => setBusinesses([]));
  }, [router]);

  const total = businesses?.length || 0;
  const approved = businesses?.filter((b) => b.status === "APPROVED").length || 0;
  const featured = businesses?.filter((b) => b.isFeatured).length || 0;

  return (
    <MarketplaceShell active="owner">
      <section>
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Analytics
          </p>
          <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">
            Visitor analytics
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Track how many people view your public profile. Share your profile link to grow
            your reach — every visitor is counted automatically.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-3xl font-bold">{visitors}</p>
            <p className="mt-1 text-sm text-muted-foreground">Profile visitors</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-3xl font-bold">{total}</p>
            <p className="mt-1 text-sm text-muted-foreground">Businesses</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-3xl font-bold">{approved}</p>
            <p className="mt-1 text-sm text-muted-foreground">Live (approved)</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-mono text-xl font-bold">Your businesses</h2>
          <div className="mt-4 flex flex-col gap-3">
            {businesses === null ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : businesses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                No businesses yet.
              </div>
            ) : (
              businesses.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border border-border p-4 ${
                    focusId === b.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          STATUS_STYLES[b.status] || "bg-muted text-muted-foreground"
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
                  </div>
                  <Link
                    href={`/business/${b.id}`}
                    className="shrink-0 text-sm font-bold text-primary hover:underline"
                  >
                    View
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {featured} of your businesses are currently featured.
        </p>
      </section>
    </MarketplaceShell>
  );
}
