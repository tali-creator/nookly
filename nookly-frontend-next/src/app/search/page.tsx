"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import BusinessCard from "@/components/BusinessCard";
import { apiGet } from "@/lib/api";
import { FALLBACK_LOCATION, SEARCH_RADIUS_KM } from "@/lib/config";
import { isOpenNow } from "@/lib/helpers";
import { NIGERIAN_CITIES } from "@/lib/locations";
import type { NearbyBusiness } from "@/lib/types";

type OpenState = "all" | "open" | "closed";
type SortMode = "recommended" | "distance" | "availability";

const PAGE_LIMIT = 20;
const RADIUS_OPTIONS = [5, 10, 25, 50];

interface NearbyResponse {
  data: NearbyBusiness[];
  total: number;
  page: number;
  limit: number;
  radius: number;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() || "";
  const locParam = searchParams.get("loc")?.trim() || "";

  const [keywordInput, setKeywordInput] = useState(q);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationReady, setLocationReady] = useState(false);

  const matchedCity = NIGERIAN_CITIES.find((c) =>
    locParam.toLowerCase().includes(c.name.toLowerCase())
  );
  const [locMode, setLocMode] = useState<string>(matchedCity ? matchedCity.id : "current");

  const [radius, setRadius] = useState<number>(SEARCH_RADIUS_KM);
  const [openState, setOpenState] = useState<OpenState>("all");
  const [sort, setSort] = useState<SortMode>("availability");

  const [items, setItems] = useState<NearbyBusiness[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locMsg, setLocMsg] = useState<{ text: string; error: boolean } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Live geolocation (used when "My current location" is selected). On mobile,
  // auto-requests often fail with PERMISSION_DENIED even when granted, so we
  // also expose a "Use my location" button (a real user gesture) to retry.
  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationReady(false);
      setLocMsg({
        text: "Location isn’t available on this device — pick a city above to narrow your search.",
        error: false,
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocationReady(true);
        setLocMsg(null);
      },
      () => {
        setLocationReady(false);
        setLocMsg({
          text: "We couldn’t get your location. Tap “Use my location” or pick a city above to narrow your search.",
          error: false,
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Resolve the coordinates actually used for the query.
  const effective = useMemo(() => {
    if (locMode !== "current") {
      const city = NIGERIAN_CITIES.find((c) => c.id === locMode);
      if (city) return { lat: city.lat, lng: city.lng, label: city.name };
    }
    const useLat = lat ?? FALLBACK_LOCATION.lat;
    const useLng = lng ?? FALLBACK_LOCATION.lng;
    return {
      lat: useLat,
      lng: useLng,
      label: locationReady ? "your current location" : "Lagos (default)",
    };
  }, [locMode, lat, lng, locationReady]);

  const fetchPage = useCallback(
    async (pageToLoad: number): Promise<NearbyResponse> => {
      const qs = new URLSearchParams({
        lat: String(effective.lat),
        lng: String(effective.lng),
        radius: String(radius),
        page: String(pageToLoad),
        limit: String(PAGE_LIMIT),
      });
      if (q) qs.set("q", q);
      const res = await apiGet<NearbyResponse>("/businesses/nearby?" + qs.toString());
      return res.data;
    },
    [effective.lat, effective.lng, radius, q]
  );

  // Reset + load first page when filters/location/query change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);
    fetchPage(1)
      .then((body) => {
        if (cancelled) return;
        setItems(body.data || []);
        setTotal(body.total || 0);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load results. Please try again.");
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const serverHasMore = items.length < total;

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !serverHasMore) return;
    const next = page + 1;
    setLoadingMore(true);
    fetchPage(next)
      .then((body) => {
        setItems((prev) => [...prev, ...(body.data || [])]);
        setPage(next);
        setTotal(body.total || total);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, loading, serverHasMore, page, fetchPage, total]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !serverHasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverHasMore, loadMore, items, loading, loadingMore]);

  const visible = useMemo(() => {
    let list = items;
    if (openState !== "all") {
      list = list.filter((b) => {
        const isOpen = isOpenNow(b.hours, b.timezone) === true;
        return openState === "open" ? isOpen : !isOpen;
      });
    }
    if (sort === "distance") {
      list = [...list].sort((a, b) => Number(a.distanceKm) - Number(b.distanceKm));
    } else if (sort === "availability") {
      list = [...list].sort((a, b) => {
        const ao = isOpenNow(a.hours, a.timezone) === true ? 0 : 1;
        const bo = isOpenNow(b.hours, b.timezone) === true ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return Number(a.distanceKm) - Number(b.distanceKm);
      });
    }
    return list;
  }, [items, openState, sort]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keywordInput.trim()) params.set("q", keywordInput.trim());
    if (locMode !== "current") {
      const city = NIGERIAN_CITIES.find((c) => c.id === locMode);
      if (city) params.set("loc", city.name);
    }
    router.push("/search?" + params.toString());
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b border-border/70 px-5 py-10 lg:px-8 lg:py-14">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/"
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <svg className="size-4">
                <use href="#i-arrow-left" />
              </svg>
              Home
            </Link>
            <h1 className="font-mono text-3xl font-bold tracking-[-0.05em] sm:text-4xl">
              Search businesses
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Find local pros near you. Search by keyword, then narrow by location, distance,
              or availability.
            </p>

            {/* Search form */}
            <form
              onSubmit={submitSearch}
              className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center"
            >
              <label className="flex flex-1 items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
                <svg className="size-5 text-muted-foreground">
                  <use href="#i-search" />
                </svg>
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="What do you need help with?"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  aria-label="Search keyword"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
                <svg className="size-5 shrink-0 text-primary">
                  <use href="#i-map-pin" />
                </svg>
                <select
                  value={locMode}
                  onChange={(e) => setLocMode(e.target.value)}
                  className="min-w-0 bg-transparent font-medium text-foreground outline-none"
                  aria-label="Location"
                >
                  <option value="current">My current location</option>
                  {NIGERIAN_CITIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
              >
                Search
              </button>
            </form>

            {locMsg ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary">
                <span>{locMsg.text}</span>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white"
                >
                  Use my location
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Showing results near <strong className="text-foreground">{effective.label}</strong>
                {q ? (
                  <>
                    {" "}
                    for “<strong className="text-foreground">{q}</strong>”
                  </>
                ) : null}
              </p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              Distance
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground outline-none sm:w-auto"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    Within {r} km
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              Availability
              <div className="flex rounded-xl border border-border bg-card p-1 text-sm font-medium">
                {(["all", "open", "closed"] as OpenState[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setOpenState(s)}
                    className={`rounded-lg px-3 py-1.5 capitalize transition ${
                      openState === s ? "bg-primary text-white" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground outline-none sm:w-auto"
              >
                <option value="recommended">Recommended</option>
                <option value="distance">Closest first</option>
                <option value="availability">Availability</option>
              </select>
            </label>

            <span className="text-sm text-muted-foreground sm:ml-auto">
              {loading ? "Loading…" : `${total} result${total === 1 ? "" : "s"}`}
            </span>
          </div>

          {/* Results */}
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
                Loading results…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center text-destructive md:col-span-2 lg:col-span-3">
                {error}
              </div>
            ) : visible.length ? (
              visible.map((b) => <BusinessCard key={b.id} business={b} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
                No businesses match yet. Try a different keyword, a wider distance, or “all”.
              </div>
            )}
          </div>

          {!loading && !error && serverHasMore ? (
            <div className="mt-8 flex flex-col items-center gap-3">
              <div ref={sentinelRef} className="h-1 w-full" />
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-bold transition hover:bg-muted disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
