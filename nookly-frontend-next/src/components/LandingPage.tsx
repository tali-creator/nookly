"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ServiceShowcase from "@/components/ServiceShowcase";
import CategoryGrid from "@/components/CategoryGrid";
import BusinessCard from "@/components/BusinessCard";
import { apiGet } from "@/lib/api";
import { FALLBACK_LOCATION, SEARCH_RADIUS_KM } from "@/lib/config";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { Category, NearbyBusiness } from "@/lib/types";

// How many "Popular in your area" cards to show per breakpoint.
const POPULAR_LIMIT_DESKTOP = 6;
const POPULAR_LIMIT_MOBILE = 3;

export default function LandingPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [locInput, setLocInput] = useState("Lekki, Lagos");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationReady, setLocationReady] = useState(false);

  const [providers, setProviders] = useState<NearbyBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [nearLabel, setNearLabel] = useState("Verified businesses");
  const [locMsg, setLocMsg] = useState<{ text: string; error: boolean } | null>(null);
  const findHelpRef = useRef<HTMLButtonElement>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const router = useRouter();

  // Debounce the search query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Load categories.
  useEffect(() => {
    let cancelled = false;
    apiGet<{ categories: Category[] }>("/categories")
      .then((res) => {
        if (!cancelled) setCategories(res.data.categories || []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load providers whenever location / filters change.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const params = new URLSearchParams({
        page: "1",
        limit: String(POPULAR_LIMIT_DESKTOP),
      });
      if (locationReady && lat != null && lng != null) {
        params.set("lat", String(lat));
        params.set("lng", String(lng));
      } else {
        params.set("lat", String(FALLBACK_LOCATION.lat));
        params.set("lng", String(FALLBACK_LOCATION.lng));
      }
      params.set("radius", String(SEARCH_RADIUS_KM));
      if (debouncedQ) params.set("q", debouncedQ);

      setLoading(true);
      try {
        const res = await apiGet<{ data: NearbyBusiness[] }>(
          "/businesses/nearby?" + params.toString()
        );
        if (cancelled) return;
        const items = res.data.data || [];
        setProviders(items);
        setNearLabel(locationReady ? "Near you" : "Verified businesses");
      } catch (err) {
        if (!cancelled) setProviders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [locationReady, lat, lng, debouncedQ]);

  function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationReady(false);
      setLocMsg({
        text: "Location is unavailable. Enable location access to browse nearby businesses.",
        error: true,
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocationReady(true);
        setLocMsg({ text: "Showing businesses near your current location.", error: false });
      },
      () => {
        setLocationReady(false);
        setLocMsg({
          text: "We need your location to show nearby businesses. Enter a city and it will be supported soon.",
          error: true,
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  // Kick off location as soon as the page mounts (matches original behavior).
  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onFindHelp() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (locInput.trim()) params.set("loc", locInput.trim());
    router.push("/search?" + params.toString());
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section
          id="top"
          className="relative mx-auto max-w-7xl px-5 pb-16 pt-14 lg:px-8 lg:pb-24 lg:pt-24"
        >
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-10">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                Your neighborhood, sorted
              </div>
              <h1 className="text-balance font-mono text-5xl font-bold leading-[1.03] tracking-[-0.07em] sm:text-6xl lg:text-7xl">
                Get more done.
                <br />
                <span className="text-primary">Live a little.</span>
              </h1>
              <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
                Find trusted local pros for the things on your to-do list — from a
                quick fix to a full day of help.
              </p>
              <div className="mt-9 flex max-w-xl flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_18px_50px_-28px_rgba(20,35,10,.35)]">
                <label className="flex flex-1 items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
                  <svg className="size-5 text-muted-foreground">
                    <use href="#i-search" />
                  </svg>
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="What do you need help with?"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    aria-label="Search for a service"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-muted-foreground sm:max-w-44">
                  <svg className="size-5 shrink-0 text-primary">
                    <use href="#i-map-pin" />
                  </svg>
                  <input
                    type="text"
                    value={locInput}
                    onChange={(e) => setLocInput(e.target.value)}
                    placeholder="Lekki, Lagos"
                    className="min-w-0 bg-transparent font-medium text-foreground outline-none"
                    aria-label="Location"
                  />
                </label>
                <button
                  ref={findHelpRef}
                  type="button"
                  onClick={onFindHelp}
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
                >
                  Find help
                </button>
              </div>
              {locMsg ? (
                <p
                  className={`mt-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                    locMsg.error
                      ? "border-destructive/30 text-destructive"
                      : "border-primary/20 bg-primary/10 text-primary"
                  }`}
                >
                  {locMsg.text}
                </p>
              ) : null}
              <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex -space-x-2">
                  <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-[#e3b8a0] text-[10px] font-bold">
                    OA
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-[#cad9b2] text-[10px] font-bold">
                    KM
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-[#b9cbe0] text-[10px] font-bold">
                    TD
                  </span>
                </div>
                <span>
                  <strong className="text-foreground">2,000+</strong> people found
                  help this month
                </span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[520px] lg:ml-auto">
              <ServiceShowcase categories={categories} />
            </div>
          </div>
        </section>

        {/* Services */}
        <section
          id="services"
          className="border-y border-border/70 px-5 py-14 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Start here
                </p>
                <h2 className="font-mono font-bold tracking-[-0.05em] sm:text-4xl">
                  What can we help with?
                </h2>
              </div>
              <Link
                href="/categories"
                className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                See all categories
                <svg className="size-4">
                  <use href="#i-arrow-right" />
                </svg>
              </Link>
            </div>
            {categories.length ? (
              <CategoryGrid categories={categories} />
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                Could not load categories.
              </div>
            )}
          </div>
        </section>

        {/* Providers */}
        <section
          id="providers"
          className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary" id="near-label">
                {nearLabel}
              </p>
              <h2 className="font-mono text-3xl font-bold tracking-[-0.05em] sm:text-4xl">
                Popular in your area
              </h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Sort by</span>
              <button type="button" className="flex items-center gap-1 font-semibold text-foreground">
                Recommended
                <svg className="size-4">
                  <use href="#i-chevron-down" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
                {locationReady ? "Loading nearby businesses…" : "Loading verified businesses…"}
              </div>
            ) : providers.length ? (
              providers
                .slice(0, isDesktop ? POPULAR_LIMIT_DESKTOP : POPULAR_LIMIT_MOBILE)
                .map((b) => <BusinessCard key={b.id} business={b} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
                No businesses match that search yet. Try another service.
              </div>
            )}
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="bg-primary px-5 py-16 text-primary-foreground lg:px-8 lg:py-20"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white opacity-70">
                Simple by design
              </p>
              <h2 className="max-w-md font-mono text-4xl font-bold leading-tight tracking-[-0.06em] text-white sm:text-5xl">
                Good help should feel easy.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-white opacity-80">
                From your first search to the final high-five, Nookly keeps the
                whole experience clear, human, and on your terms.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              <div className="border-t border-primary-foreground/25 pt-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15">
                  <svg className="size-5">
                    <use href="#i-search" />
                  </svg>
                </span>
                <p className="mt-5 font-bold text-white">Tell us what you need</p>
                <p className="mt-2 text-sm leading-relaxed text-white opacity-70">
                  Describe the job and your preferred time.
                </p>
                <span className="mt-5 block font-mono text-sm text-white opacity-50">01</span>
              </div>
              <div className="border-t border-primary-foreground/25 pt-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15">
                  <svg className="size-5">
                    <use href="#i-users" />
                  </svg>
                </span>
                <p className="mt-5 font-bold text-white">Choose your pro</p>
                <p className="mt-2 text-sm leading-relaxed text-white opacity-70">
                  Compare real profiles, reviews, and prices.
                </p>
                <span className="mt-5 block font-mono text-sm text-white opacity-50">02</span>
              </div>
              <div className="border-t border-primary-foreground/25 pt-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15">
                  <svg className="size-5">
                    <use href="#i-check" />
                  </svg>
                </span>
                <p className="mt-5 font-bold text-white">Get it done</p>
                <p className="mt-2 text-sm leading-relaxed text-white opacity-70">
                  Book confidently and enjoy your free time.
                </p>
                <span className="mt-5 block font-mono text-sm text-white opacity-50">03</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer id="become-a-pro" className="border-t border-border px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 font-mono font-bold text-foreground">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg className="size-4">
                <use href="#i-sparkles" />
              </svg>
            </span>
            nookly
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#how-it-works" className="hover:text-foreground">
              About Nookly
            </a>
            <Link href="/owner" className="hover:text-foreground">
              Become a pro
            </Link>
            <a href="#top" className="hover:text-foreground">
              Help center
            </a>
          </div>
          <p>© 2026 Nookly</p>
        </div>
      </footer>
    </>
  );
}
