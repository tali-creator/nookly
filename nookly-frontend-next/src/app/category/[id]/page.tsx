"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import BusinessCard from "@/components/BusinessCard";
import LocationPicker, { type PickedLocation } from "@/components/LocationPicker";
import { apiGet } from "@/lib/api";
import { FALLBACK_LOCATION, SEARCH_RADIUS_KM } from "@/lib/config";
import { categoryDescription, categoryImage } from "@/lib/categories";
import { isOpenNow } from "@/lib/helpers";
import { NIGERIAN_CITIES } from "@/lib/locations";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import type { Category, NearbyBusiness } from "@/lib/types";

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

export default function CategoryPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [category, setCategory] = useState<Category | null>(null);

  const loc = useCurrentLocation();
  const [locMode, setLocMode] = useState<string>("current");
  const [manual, setManual] = useState<PickedLocation | null>(null);

  const [radius, setRadius] = useState<number>(SEARCH_RADIUS_KM);
  const [openState, setOpenState] = useState<OpenState>("all");
  const [sort, setSort] = useState<SortMode>("availability");

  const [items, setItems] = useState<NearbyBusiness[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load this category's metadata.
  useEffect(() => {
    let cancelled = false;
    apiGet<{ categories: Category[] }>("/categories")
      .then((res) => {
        if (cancelled) return;
        const found = (res.data.categories || []).find((c) => c.id === id) || null;
        setCategory(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Resolve the coordinates actually used for the query. A manually typed
  // place wins; otherwise current GPS; otherwise a selected city; finally
  // Lagos, so results always resolve to a real coordinate.
  const effective = useMemo(() => {
    if (manual) return { lat: manual.lat, lng: manual.lng, label: manual.label };
    if (locMode !== "current") {
      const city = NIGERIAN_CITIES.find((c) => c.id === locMode);
      if (city) {
        return { lat: city.lat, lng: city.lng, label: city.name };
      }
    }
    const useLat = loc.lat ?? FALLBACK_LOCATION.lat;
    const useLng = loc.lng ?? FALLBACK_LOCATION.lng;
    const label =
      loc.state === "granted" && loc.ready
        ? "your current location"
        : loc.state === "locating"
        ? "your current location…"
        : "Lagos (default)";
    return { lat: useLat, lng: useLng, label };
  }, [manual, locMode, loc.lat, loc.lng, loc.ready, loc.state]);

  const fetchPage = useCallback(
    async (pageToLoad: number): Promise<NearbyResponse> => {
      const qs = new URLSearchParams({
        lat: String(effective.lat),
        lng: String(effective.lng),
        radius: String(radius),
        category: id,
        page: String(pageToLoad),
        limit: String(PAGE_LIMIT),
      });
      const res = await apiGet<NearbyResponse>("/businesses/nearby?" + qs.toString());
      return res.data;
    },
    [effective.lat, effective.lng, radius, id]
  );

  // Reset + load the first page whenever filters/location/category change.
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
          setError("Could not load businesses. Please try again.");
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

  // Infinite scroll: auto-load the next page when the sentinel is visible.
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

  // Apply open/closed filter + sort client-side (using each business's hours).
  const visible = useMemo(() => {
    let list = items;
    if (openState !== "all") {
      list = list.filter((b) => {
        const isOpen = isOpenNow(b.hours, b.timezone) === true;
        return openState === "open" ? isOpen : !isOpen;
      });
    }
    if (sort === "distance") {
      list = [...list].sort(
        (a, b) => Number(a.distanceKm) - Number(b.distanceKm)
      );
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

  const img = category ? categoryImage(category.name) : undefined;
  const awaitingLocation = locMode === "current" && loc.state !== "granted";

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b border-border/70 px-5 py-10 lg:px-8 lg:py-14">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/#services"
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <svg className="size-4">
                <use href="#i-arrow-left" />
              </svg>
              All categories
            </Link>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt=""
                  className="size-16 rounded-2xl object-cover sm:size-20"
                />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 font-mono text-2xl font-bold text-primary sm:size-20">
                  {(category?.name || "?").charAt(0)}
                </span>
              )}
              <div>
                <h1 className="font-mono text-3xl font-bold tracking-[-0.05em] sm:text-4xl">
                  {category?.name || "Category"}
                </h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  {category ? categoryDescription(category.name) : "Verified local pros near you."}
                </p>
              </div>
            </div>
            {loc.state === "granted" && loc.ready ? null : loc.state ===
              "locating" ? (
              <p className="mt-4 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground">
                Finding your location…
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary">
                <span>
                  {loc.error ??
                    (loc.state === "prompt"
                      ? "See businesses near you — tap “Use my location” to allow access and get the most relevant results."
                      : "Location isn’t available right now.")}
                </span>
                {loc.state !== "unsupported" ? (
                  <button
                    type="button"
                    onClick={loc.request}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Use my location
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <LocationPicker
              value={manual}
              onChange={setManual}
              onUseMyLocation={loc.request}
              locating={loc.state === "locating"}
            />

            {manual || locMode !== "current" || (loc.state === "granted" && loc.ready) ? (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary sm:text-sm">
                <svg className="size-4 shrink-0" aria-hidden="true">
                  <use href="#i-map-pin" />
                </svg>
                <span className="break-words">{effective.label}</span>
              </span>
            ) : null}

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
                      openState === s
                        ? "bg-primary text-white"
                        : "text-foreground hover:bg-muted"
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
              {loading ? "Loading…" : `${total} business${total === 1 ? "" : "es"} nearby`}
            </span>
          </div>

          {/* Results */}
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
                Loading businesses…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center text-destructive md:col-span-2 lg:col-span-3">
                {error}
              </div>
            ) : visible.length ? (
              visible.map((b) => <BusinessCard key={b.id} business={b} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
                  {awaitingLocation
                    ? "Enable location or pick a city above to see businesses near you."
                    : "No businesses match these filters yet. Try a wider distance or “all”."}
                </div>
              )}
          </div>

          {/* Load more / infinite-scroll sentinel */}
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
