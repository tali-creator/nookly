"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api";

export interface PickedLocation {
  lat: number;
  lng: number;
  label: string;
}

interface GeoResult {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
}

/* Searchable location entry backed by the backend geocoder (Nominatim +
   local gazetteer). Lets the user type a place name — even small, known
   localities — and resolve it to coordinates for the nearby search. */
export default function LocationPicker({
  value,
  onChange,
  onUseMyLocation,
  locating,
}: {
  value: PickedLocation | null;
  onChange: (v: PickedLocation | null) => void;
  onUseMyLocation: () => void;
  locating?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function search(q: string) {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const data = await apiGet<{ results: GeoResult[] }>(
          "/locations/search?q=" + encodeURIComponent(q)
        );
        setResults(data.data.results || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  function pick(r: GeoResult) {
    onChange({ lat: r.lat, lng: r.lng, label: r.label });
    setQuery(r.name);
    setOpen(false);
    setResults([]);
  }

  return (
    <div className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
      <span>Location</span>
      <div ref={boxRef} className="relative flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onUseMyLocation();
            }}
            disabled={locating}
            className="shrink-0 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
          >
            {locating ? "Locating…" : "Use my location"}
          </button>
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder="Search a place, e.g. Karji Junction"
            aria-label="Search location by name"
            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground outline-none"
          />
        </div>
        {open && results.length ? (
          <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card shadow-lg">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-muted"
                >
                  <span className="font-semibold text-foreground">{r.name}</span>
                  <span className="w-full truncate text-xs text-muted-foreground">{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {open && query.trim().length >= 2 && !loading && !results.length ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground shadow-lg">
            No places found — try a nearby town or city.
          </div>
        ) : null}
      </div>
      {value ? (
        <p className="mt-1 truncate text-[11px] font-medium text-primary">Selected: {value.label}</p>
      ) : null}
    </div>
  );
}
