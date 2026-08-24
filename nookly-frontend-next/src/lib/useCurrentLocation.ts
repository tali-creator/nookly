"use client";

import { useCallback, useEffect, useState } from "react";

export type LocState =
  | "unsupported"
  | "prompt"
  | "granted"
  | "denied"
  | "locating"
  | "error";

/* Robust mobile geolocation with local-machine caching.
   - Mobile browsers refuse the location prompt unless it comes from a user
     gesture, so getCurrentPosition() on page load is silently denied. We probe
     navigator.permissions and only auto-fetch when already "granted".
   - The last successful fix is cached in localStorage (with a 2-minute TTL) so a
     reload or returning from another page reuses the coordinates instantly
     instead of re-requesting the OS prompt.
   - Concurrent request() calls are coalesced behind a single in-flight promise. */
export function useCurrentLocation() {
  const CACHE_KEY = "nookly:location";
  const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  const readCache = useCallback((): { lat: number; lng: number; ts: number; state: LocState } | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw) as { lat: number; lng: number; ts: number; state: LocState };
      if (typeof c.lat !== "number" || typeof c.lng !== "number") return null;
      if (Date.now() - c.ts > CACHE_TTL) return null;
      return c;
    } catch {
      return null;
    }
  }, [CACHE_KEY]);

  const writeCache = useCallback(
    (lat: number, lng: number, state: LocState) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ lat, lng, ts: Date.now(), state }));
      } catch {
        /* ignore */
      }
    },
    [CACHE_KEY]
  );

  const cached = readCache();
  const [lat, setLat] = useState<number | null>(cached ? cached.lat : null);
  const [lng, setLng] = useState<number | null>(cached ? cached.lng : null);
  const [ready, setReady] = useState<boolean>(cached ? cached.state === "granted" : false);
  const [state, setState] = useState<LocState>(cached ? cached.state : "prompt");
  const [error, setError] = useState<string | null>(null);
  // Increments on every successful resolve so consumers can re-run their
  // apply logic even when the coordinates themselves are unchanged (e.g. the
  // owner re-detects after manually editing the address). Not bumped on cache
  // restore, so a reload doesn't silently overwrite a manually entered address.
  const [detectId, setDetectId] = useState(0);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      setError("Location isn’t available on this device.");
      return;
    }
    setState("locating");
    setError(null);
    getPosition()
      .then(({ lat, lng }) => {
        setLat(lat);
        setLng(lng);
        setReady(true);
        setState("granted");
        setError(null);
        setDetectId((n) => n + 1);
        writeCache(lat, lng, "granted");
      })
      .catch((err: GeolocationPositionError) => {
        if (err && err.code === err.PERMISSION_DENIED) {
          setState("denied");
          setError(
            "Location permission was denied. Enable it in your browser’s site settings, then tap “Use my location”."
          );
        } else {
          setState("error");
          setError("We couldn’t determine your location. Tap “Use my location” to try again.");
        }
      });
  }, [writeCache]);

  // On mount: reuse a fresh cached fix without re-prompting; otherwise probe
  // permission so an already-granted state auto-loads.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      return;
    }
    const fresh = readCache();
    if (fresh && fresh.state === "granted" && Date.now() - fresh.ts < CACHE_TTL) {
      setLat(fresh.lat);
      setLng(fresh.lng);
      setReady(true);
      setState("granted");
      setError(null);
      return;
    }
    let cancelled = false;
    const perms = navigator.permissions as
      | { query?: (d: { name: string }) => Promise<{ state: PermissionState }> }
      | undefined;
    if (perms && perms.query) {
      perms
        .query({ name: "geolocation" })
        .then((res) => {
          if (cancelled) return;
          if (res.state === "granted") request();
          else if (res.state === "denied") setState("denied");
          else setState("prompt");
        })
        .catch(() => {
          if (!cancelled) setState("prompt");
        });
    } else {
      setState("prompt");
    }
    return () => {
      cancelled = true;
    };
  }, [request, readCache, CACHE_TTL]);

  return { lat, lng, ready, state, error, request, detectId };
}

/* Coalesced, single in-flight geolocation attempt shared across all hook
   instances/calls. High accuracy first, low accuracy fallback on timeout. */
let inflight: Promise<{ lat: number; lng: number }> | null = null;

function getPosition(): Promise<{ lat: number; lng: number }> {
  if (inflight) return inflight;
  inflight = new Promise((resolve, reject) => {
    const clear = () => {
      inflight = null;
    };
    const onSuccess = (pos: GeolocationPosition) => {
      clear();
      resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };
    const finishFail = (err: GeolocationPositionError) => {
      clear();
      reject(err);
    };
    const onFail = (err: GeolocationPositionError, triedHigh: boolean) => {
      if (err.code === err.TIMEOUT && triedHigh) {
        navigator.geolocation.getCurrentPosition(onSuccess, (e) => finishFail(e), {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 0,
        });
        return;
      }
      finishFail(err);
    };
    navigator.geolocation.getCurrentPosition(onSuccess, (e) => onFail(e, true), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
  return inflight;
}
