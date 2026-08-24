"use client";

import { useCallback, useEffect, useState } from "react";

export type LocState =
  | "unsupported"
  | "prompt"
  | "granted"
  | "denied"
  | "locating"
  | "error";

/* Robust mobile geolocation.
   Mobile browsers (iOS Safari, Android Chrome) refuse to show the location
   permission prompt unless the request originates from a user gesture. A
   getCurrentPosition() fired on page load is therefore silently denied.
   Strategy:
     - Probe navigator.permissions: if already "granted", fetch automatically
       (no gesture needed) -> exact, fresh coordinates.
     - If "prompt" or "denied", expose request() to be wired to a visible
       button; tapping it is the gesture that lets the OS prompt + grant.
   High accuracy is used, with a low-accuracy fallback on timeout. */
export function useCurrentLocation() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<LocState>("prompt");
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      setError("Location isn’t available on this device.");
      return;
    }
    setState("locating");
    setError(null);

    const onSuccess = (pos: GeolocationPosition) => {
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      setReady(true);
      setState("granted");
      setError(null);
    };
    const onFail = (err: GeolocationPositionError, triedHigh: boolean) => {
      if (err.code === err.TIMEOUT && triedHigh) {
        // Retry once without high accuracy before giving up.
        navigator.geolocation.getCurrentPosition(onSuccess, (e) => finishFail(e, false), {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 0,
        });
        return;
      }
      finishFail(err, triedHigh);
    };
    const finishFail = (err: GeolocationPositionError, _triedHigh: boolean) => {
      if (err.code === err.PERMISSION_DENIED) {
        setState("denied");
        setError(
          "Location permission was denied. Enable it in your browser’s site settings, then tap “Use my location”."
        );
      } else {
        setState("error");
        setError("We couldn’t determine your location. Tap “Use my location” to try again.");
      }
    };

    navigator.geolocation.getCurrentPosition(onSuccess, (e) => onFail(e, true), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  }, []);

  // On mount: probe permission so an already-granted state auto-loads.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
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
  }, [request]);

  return { lat, lng, ready, state, error, request };
}
