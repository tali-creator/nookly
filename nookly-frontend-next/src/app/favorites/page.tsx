"use client";

/* Favorites — port 1:1 from nookly-frontend/favorites.html. */

import { useCallback, useEffect, useState } from "react";
import MarketplaceShell from "@/components/MarketplaceShell";
import BusinessCard from "@/components/BusinessCard";
import { apiGet } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import type { NearbyBusiness } from "@/lib/types";

export default function FavoritesPage() {
  const [items, setItems] = useState<NearbyBusiness[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await apiGet<{ favorites: NearbyBusiness[] }>(
        "/favorites?deviceId=" + getDeviceId()
      );
      setItems(res.data.favorites || []);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError("Could not load favorites. " + ((err as any).message || ""));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketplaceShell active="favorites">
        <section>
          <div className="mb-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Your Nookly
            </p>
            <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">Your favorites</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Keep your favorite local businesses close for the next time you need a hand.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            <div className="grid gap-5 md:grid-cols-2">
              {error ? (
                <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2">
                  {error}
                </div>
              ) : items === null ? (
                <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2">
                  Loading favorites…
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2">
                  No favorites yet. Save a business from the marketplace to see it here.
                </div>
              ) : (
                items.map((b) => (
                  <BusinessCard key={b.id} business={b} onFavChange={(id, isFav) => { if (!isFav) load(); }} />
                ))
              )}
            </div>
          </div>
        </section>
      </MarketplaceShell>
    </main>
  );
}
