"use client";

/* Customer dashboard — port 1:1 from nookly-frontend/dashboard.html. */

import { useEffect, useState } from "react";
import Link from "next/link";
import MarketplaceShell from "@/components/MarketplaceShell";
import BusinessCard from "@/components/BusinessCard";
import { apiGet } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import { ensureSeedFromQuery, getUser } from "@/lib/auth";
import type { NearbyBusiness, User } from "@/lib/types";

export default function DashboardPage() {
  const [savedCount, setSavedCount] = useState(0);
  const [featuredCount, setFeaturedCount] = useState(0);
  const [items, setItems] = useState<NearbyBusiness[] | null>(null);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    ensureSeedFromQuery();
    setUser(getUser());
    apiGet<{ favorites: unknown[] }>("/favorites?deviceId=" + getDeviceId())
      .then((res) => setSavedCount((res.data.favorites || []).length))
      .catch(() => {});

    apiGet<{ data: NearbyBusiness[] }>("/businesses/featured?limit=3")
      .then((res) => {
        const list = res.data.data || [];
        setFeaturedCount(list.length);
        setItems(list);
      })
      .catch(() => {
        setError("Could not load recommendations.");
      });
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketplaceShell active="dashboard">
        {user?.role === "ADMIN" && (
          <div className="mb-4 flex justify-end sm:hidden">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              <svg className="size-4" aria-hidden="true">
                <use href="#i-layout-dashboard" />
              </svg>
              Admin dashboard
            </Link>
          </div>
        )}
        <section>
          <div className="mb-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Your Nookly
            </p>
            <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">Your dashboard</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Keep track of your saved pros, upcoming help, and your next task.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
                <svg className="size-5" aria-hidden="true">
                  <use href="#i-calendar-check" />
                </svg>
                <p className="mt-8 text-3xl font-bold">0</p>
                <p className="mt-1 text-sm opacity-80">Upcoming bookings</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <svg className="size-5 text-primary" aria-hidden="true">
                  <use href="#i-heart" />
                </svg>
                <p className="mt-8 text-3xl font-bold">{savedCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Saved businesses</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <svg className="size-5 text-primary" aria-hidden="true">
                  <use href="#i-sparkles" />
                </svg>
                <p className="mt-8 text-3xl font-bold">{featuredCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Featured nearby</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-mono text-xl font-bold">Find your next pro</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Trusted help is a few clicks away.
                  </p>
                </div>
                <Link
                  href="/#services"
                  className="flex items-center gap-2 text-sm font-semibold text-primary"
                >
                  Browse{" "}
                  <svg className="size-4" aria-hidden="true">
                    <use href="#i-arrow-right" />
                  </svg>
                </Link>
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                <svg className="size-4" aria-hidden="true">
                  <use href="#i-search" />
                </svg>
                Search cleaning, moving, repairs...
              </div>
            </div>

            <div>
              <h2 className="font-mono text-xl font-bold">Recommended for you</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {error ? (
                  <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2">
                    {error}
                  </div>
                ) : items === null ? (
                  <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2">
                    Loading…
                  </div>
                ) : items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2">
                    Nothing featured yet — check back soon.
                  </div>
                ) : (
                  items.map((b) => <BusinessCard key={b.id} business={b} />)
                )}
              </div>
            </div>
          </div>
        </section>
      </MarketplaceShell>
    </main>
  );
}
