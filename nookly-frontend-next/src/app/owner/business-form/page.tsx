"use client";

/* Owner "add business" screen — ported 1:1 from
   nookly-frontend/owner/business-form.html. Supports both create (no ?id)
   and edit (?id=) modes, mirroring the original behaviour exactly:
   business details, geolocation + Nominatim reverse/forward geocoding with a
   manual address fallback, a 7-day opening-hours editor, up to 6 photos, and
   a services & prices list (each with an optional photo). */

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import MarketplaceShell from "@/components/MarketplaceShell";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "@/lib/api";
import { getToken, ensureSeedFromQuery } from "@/lib/auth";
import { assetUrl } from "@/lib/config";
import type { BusinessHours, Category, Photo } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ServiceRowState {
  clientId: string;
  id: string | null;
  name: string;
  price: string;
  imageUrl: string | null;
  _pendingFile: File | null;
  _pendingPreview: string | null;
}

function defaultHours(): BusinessHours[] {
  return DAYS.map((_, i) => ({ dayOfWeek: i, isClosed: false, openTime: "09:00", closeTime: "17:00" }));
}

/* Nominatim requires a valid HTTP Referer/User-Agent. Browsers block setting
   User-Agent from JS, so we send an explicit Referer header (allowed by fetch)
   plus a custom X-Requested-With. Rate-limited to 1 req/sec. */
let lastNominatimAt = 0;
async function nominatim(url: string): Promise<any> {
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastNominatimAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
  const res = await fetch(url, {
    headers: {
      Referer: window.location.origin + "/",
      "X-Requested-With": "Nookly",
    },
  });
  if (!res.ok) throw new Error("Location service error (" + res.status + ")");
  return res.json();
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const data = await nominatim(
    "https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lng + "&format=json"
  );
  return (data && data.display_name) || "";
}

async function forwardGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const data = await nominatim(
    "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(query) + "&format=json&limit=1"
  );
  const hit = Array.isArray(data) && data.length ? data[0] : null;
  if (!hit) return null;
  return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
}

function Icon({ name, className = "size-4" }: { name: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${name}`} />
    </svg>
  );
}

function BusinessFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const businessId = params.get("id");

  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");
  const [formTitle, setFormTitle] = useState("Business listing");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [locationMode, setLocationMode] = useState<"idle" | "detecting" | "auto" | "manual">("idle");
  const [locStatus, setLocStatus] = useState<{ text: string; tone: "ok" | "error" | "warn" } | null>(null);

  // Shared, mobile-safe location hook (probes permission, only auto-fetches
  // when already granted, exposes request() for a real user-gesture tap).
  const loc = useCurrentLocation();
  const [detectAsked, setDetectAsked] = useState(false);

  const [hours, setHours] = useState<BusinessHours[]>(defaultHours());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [services, setServices] = useState<ServiceRowState[]>([]);
  const [reapproval, setReapproval] = useState(false);

  const addressRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const serviceListRef = useRef<HTMLDivElement>(null);

  function showMessage(text: string) {
    setMessage(text);
  }

  function setCoords(la: number | null, ln: number | null) {
    setLat(la == null ? "" : String(la));
    setLng(ln == null ? "" : String(ln));
  }

  function hasValidCoords(): boolean {
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    return (
      Number.isFinite(la) &&
      Number.isFinite(ln) &&
      la >= -90 &&
      la <= 90 &&
      ln >= -180 &&
      ln <= 180 &&
      !(la === 0 && ln === 0)
    );
  }

  function setLocStatusSafe(text: string, tone: "ok" | "error" | "warn") {
    setLocStatus({ text, tone });
  }

  function enterManualMode(message: string) {
    setLocationMode("manual");
    setLocStatusSafe(message, "warn");
    addressRef.current?.focus();
  }

  async function resolveAddressFromField(): Promise<boolean> {
    const query = address.trim();
    if (!query) {
      setLocStatusSafe("Type an address to look up your location.", "error");
      return false;
    }
    setLocStatusSafe('Looking up "' + query + '"…', "warn");
    try {
      const result = await forwardGeocode(query);
      if (!result) {
        setCoords(null, null);
        setLocStatusSafe("We couldn't determine your location — please try a more specific address.", "error");
        return false;
      }
      setCoords(result.lat, result.lng);
      setLocStatusSafe('📍 Location found for "' + query + '".', "ok");
      return true;
    } catch (err) {
      setCoords(null, null);
      setLocStatusSafe("Location lookup failed (" + ((err as Error).message || "network error") + "). Please try again.", "error");
      return false;
    }
  }

  async function loadCategories() {
    const { data } = await apiGet<{ categories: Category[] }>("/categories");
    setCategories(data.categories || []);
  }

  async function loadBusiness() {
    const { data } = await apiGet<{ businesses: any[] }>("/businesses/mine");
    const found = (data.businesses || []).find((b) => b.id === businessId);
    if (!found) {
      showMessage("Business not found.");
      return;
    }
    setFormTitle("Edit: " + found.name);
    setName(found.name);
    setCategoryId(found.categoryId || (found.category ? found.category.id : ""));
    setDescription(found.description || "");
    setAddress(found.address || "");
    setCoords(found.lat, found.lng);
    setPhone(found.phone || "");
    setWhatsapp(found.whatsappNumber || found.whatsapp || "");
    setPhotos(found.photos || []);
    setServices(
      (found.serviceItems || []).map((s: any) => ({
        clientId: s.id,
        id: s.id,
        name: s.name,
        price: s.price,
        imageUrl: s.imageUrl || null,
        _pendingFile: null,
        _pendingPreview: null,
      }))
    );
    if (found.status === "APPROVED") setReapproval(true);
    setLocationMode("auto");
    setLocStatusSafe("📍 Location saved: " + (found.address || "no address on file") + ' — use "Update location" to change it.', "ok");
    try {
      const hrs = await apiGet<{ hours: BusinessHours[] }>("/businesses/" + businessId + "/hours");
      setHours(hrs.data.hours || defaultHours());
    } catch {
      setHours(defaultHours());
    }
  }

  function updateHour(i: number, patch: Partial<BusinessHours>) {
    setHours((prev) => prev.map((h) => (h.dayOfWeek === i ? { ...h, ...patch } : h)));
  }

  async function uploadPhoto(file: File) {
    if (photos.length + pendingPhotos.length >= 6) {
      setLocStatusSafe("Photo limit reached (max 6).", "error");
      return;
    }
    if (!businessId) {
      setPendingPhotos((prev) => [...prev, { file, preview: URL.createObjectURL(file) }]);
      return;
    }
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const { data } = await apiPost<{ photo: Photo }>("/businesses/" + businessId + "/photos", fd);
      setPhotos((prev) => [...prev, data.photo]);
    } catch (err) {
      showMessage((err as Error).message || "Upload failed");
    }
  }

  async function deletePhoto(p: Photo) {
    try {
      await apiDelete("/photos/" + p.id);
      setPhotos((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      window.alert((err as Error).message || "Delete failed");
    }
  }

  function addService() {
    const clientId = crypto.randomUUID();
    setServices((prev) => [
      ...prev,
      { clientId, id: null, name: "", price: "", imageUrl: null, _pendingFile: null, _pendingPreview: null },
    ]);
    requestAnimationFrame(() => {
      const rows = serviceListRef.current?.querySelectorAll(".svc-name");
      const last = rows && rows[rows.length - 1];
      if (last instanceof HTMLInputElement) last.focus();
    });
  }

  function updateService(clientId: string, patch: Partial<ServiceRowState>) {
    setServices((prev) => prev.map((s) => (s.clientId === clientId ? { ...s, ...patch } : s)));
  }

  async function removeService(svc: ServiceRowState) {
    if (svc.id) {
      try {
        await apiDelete("/services/" + svc.id);
        setServices((prev) => prev.filter((x) => x.clientId !== svc.clientId));
      } catch (err) {
        window.alert((err as Error).message || "Delete failed");
      }
    } else {
      setServices((prev) => prev.filter((x) => x.clientId !== svc.clientId));
    }
  }

  async function onServicePhoto(svc: ServiceRowState, file: File) {
    if (svc.id) {
      const fd = new FormData();
      fd.append("photo", file);
      try {
        const { data } = await apiPost<{ serviceItem: any }>("/services/" + svc.id + "/photo", fd);
        updateService(svc.clientId, { imageUrl: data.serviceItem.imageUrl });
      } catch (err) {
        window.alert((err as Error).message || "Upload failed");
      }
      return;
    }
    const preview = URL.createObjectURL(file);
    updateService(svc.clientId, { _pendingFile: file, _pendingPreview: preview });
  }

  async function onServiceRemovePhoto(svc: ServiceRowState) {
    if (svc._pendingFile) {
      updateService(svc.clientId, { _pendingFile: null, _pendingPreview: null });
      return;
    }
    if (svc.id) {
      try {
        await apiDelete("/services/" + svc.id + "/photo");
        updateService(svc.clientId, { imageUrl: null });
      } catch (err) {
        window.alert((err as Error).message || "Remove failed");
      }
    }
  }

  async function submit() {
    if (!hasValidCoords()) {
      if (locationMode === "manual" && address.trim()) {
        const ok = await resolveAddressFromField();
        if (!ok) {
          showMessage("We couldn't determine your location — please try a more specific address.");
          addressRef.current?.focus();
          return;
        }
      } else {
        showMessage("Set your business location before saving.");
        return;
      }
    }

    const payload = {
      name: name.trim(),
      categoryId,
      description: description.trim(),
      address: address.trim(),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      phone: phone.trim(),
      whatsappNumber: whatsapp.trim() || null,
    };

    setSaving(true);
    setMessage("");
    try {
      let id = businessId;
      if (!id) {
        const { data } = await apiPost<{ business: { id: string } }>("/businesses", payload);
        id = data.business.id;
      } else {
        await apiPatch("/businesses/" + id, payload);
      }

      await apiPut("/businesses/" + id + "/hours", hours);

      for (const svc of services) {
        if (!svc.name.trim() || svc.price.trim() === "") continue;
        let serviceId = svc.id;
        if (svc.id) {
          await apiPatch("/services/" + svc.id, { name: svc.name.trim(), price: parseFloat(svc.price) });
        } else {
          const { data } = await apiPost<{ serviceItem: { id: string } }>("/businesses/" + id + "/services", {
            name: svc.name.trim(),
            price: parseFloat(svc.price),
          });
          serviceId = data.serviceItem.id;
        }
        if (svc._pendingFile && serviceId) {
          const fd = new FormData();
          fd.append("photo", svc._pendingFile);
          await apiPost("/services/" + serviceId + "/photo", fd);
        }
      }

      for (const p of pendingPhotos) {
        const fd = new FormData();
        fd.append("photo", p.file);
        const { data } = await apiPost<{ photo: Photo }>("/businesses/" + id + "/photos", fd);
        setPhotos((prev) => [...prev, data.photo]);
      }
      setPendingPhotos([]);

      router.push("/owner/dashboard");
    } catch (err) {
      showMessage((err as Error).message || "Save failed");
      setSaving(false);
    }
  }

  useEffect(() => {
    ensureSeedFromQuery();
    if (!getToken()) {
      router.replace("/owner/login");
      return;
    }
    let active = true;
    (async () => {
      await loadCategories();
      if (!active) return;
      if (businessId) {
        await loadBusiness();
      }
      // Create mode no longer auto-fires geolocation on mount (that fails on
      // mobile because the permission prompt eats the timeout). The shared
      // useCurrentLocation hook probes permission and only auto-detects when
      // already granted; otherwise the "Detect my location" button below is
      // the user gesture that lets the OS prompt + grant.
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the shared hook resolves coordinates (auto, if permission was already
  // granted, or after the owner taps "Detect my location"), fill the form and
  // reverse-geocode the address. In edit mode we only apply once the owner
  // explicitly asks, so we never silently overwrite saved coordinates.
  useEffect(() => {
    if (!loc.ready || loc.lat == null || loc.lng == null) return;
    if (businessId && !detectAsked) return;
    setCoords(loc.lat, loc.lng);
    setLocationMode("auto");
    setLocStatusSafe("📍 Location detected", "ok");
    reverseGeocode(loc.lat, loc.lng)
      .then((addr) => {
        if (addr) {
          setAddress(addr);
          setLocStatusSafe("📍 Location detected — we filled in the address. Edit it if needed.", "ok");
        } else {
          setLocStatusSafe("📍 Location detected — but the address lookup came up empty. Type your address.", "warn");
        }
      })
      .catch((err) =>
        setLocStatusSafe("📍 Location detected — but the address lookup failed (" + ((err as Error).message || "network error") + "). Type your address.", "warn")
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.ready, loc.lat, loc.lng]);

  // Surface a helpful hint based on the current permission state (create mode).
  useEffect(() => {
    if (businessId) return;
    if (loc.ready || locStatus) return;
    if (loc.state === "prompt")
      setLocStatusSafe("Tap “Detect my location” to allow access — we’ll auto-fill your address.", "warn");
    else if (loc.state === "locating")
      setLocStatusSafe("Detecting your location…", "warn");
    else if (loc.state === "denied")
      setLocStatusSafe("Location permission was denied. Type your address below and it will be looked up automatically — or allow location in your browser settings and tap “Detect my location”.", "warn");
    else if (loc.state === "unsupported")
      setLocStatusSafe("Location isn’t available on this device. Type your address below and it will be looked up automatically.", "warn");
    else if (loc.state === "error")
      setLocStatusSafe("We couldn’t detect your location. Type your address below and it will be looked up automatically.", "warn");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.state, loc.ready]);

  const locStatusClass =
    locStatus?.tone === "ok"
      ? "border-primary/20 bg-primary/10 text-primary"
      : locStatus?.tone === "error"
      ? "border-destructive/30 bg-red-50 text-red-600"
      : "border-border bg-muted/60 text-muted-foreground";

  return (
    <MarketplaceShell active="owner">
      <section>
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Your Nookly</p>
          <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">{formTitle}</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Create or update the public details customers use to choose your business.
          </p>
        </div>

        {message ? (
          <p className="mb-6 rounded-xl bg-red-50 p-3 text-sm text-red-600">{message}</p>
        ) : null}

        <div className="flex flex-col gap-6">
          {/* Business details */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-mono text-xl font-bold">Business details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Business name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Category
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none"
                >
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">
                Description
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">
                Address
                <input
                  ref={addressRef}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, area, city"
                  autoComplete="street-address"
                  onBlur={() => {
                    if (locationMode === "manual" && address.trim()) resolveAddressFromField();
                  }}
                  className="rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                {!businessId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDetectAsked(true);
                      loc.request();
                    }}
                    disabled={loc.state === "locating"}
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:border-primary disabled:opacity-60"
                  >
                    <Icon name="i-map-pin" />
                    {loc.state === "locating"
                      ? "Detecting…"
                      : locationMode === "manual"
                      ? "Detect my location again"
                      : "Detect my location"}
                  </button>
                ) : null}
                {!businessId && locationMode === "auto" ? (
                  <button
                    type="button"
                    onClick={() => enterManualMode("Type your address below, then tap away from the field to confirm your location.")}
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold text-primary hover:border-primary"
                  >
                    Not right? Set manually
                  </button>
                ) : null}
                {businessId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDetectAsked(true);
                      loc.request();
                    }}
                    disabled={loc.state === "locating"}
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:border-primary disabled:opacity-60"
                  >
                    <Icon name="i-map-pin" />
                    {loc.state === "locating" ? "Detecting…" : "Update location"}
                  </button>
                ) : null}
              </div>
              {locStatus ? (
                <p className={`rounded-xl border px-4 py-3 text-sm sm:col-span-2 ${locStatusClass}`}>{locStatus.text}</p>
              ) : null}
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Phone
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 801 234 5678"
                  className="rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold">
                WhatsApp number (optional)
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+234 801 234 5678"
                  className="rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>
          </div>

          {/* Opening hours */}
          <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-mono text-xl font-bold">Opening hours</h2>
              <span className="text-xs text-muted-foreground">Submit all 7 days at once</span>
            </div>
            <div className="mt-4 flex flex-col divide-y divide-border">
              {hours.map((h) => (
                <div key={h.dayOfWeek} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <span className="w-32 text-sm font-bold">{DAYS[h.dayOfWeek]}</span>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={h.isClosed}
                      onChange={(e) => updateHour(h.dayOfWeek, { isClosed: e.target.checked })}
                    />
                    Closed
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="time"
                      disabled={h.isClosed}
                      value={h.openTime ?? ""}
                      onChange={(e) => updateHour(h.dayOfWeek, { openTime: e.target.value })}
                      className="w-full flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 outline-none disabled:opacity-50"
                      />
                      <span>to</span>
                    <input
                      type="time"
                      disabled={h.isClosed}
                      value={h.closeTime ?? ""}
                      onChange={(e) => updateHour(h.dayOfWeek, { closeTime: e.target.value })}
                      className="w-full flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 outline-none disabled:opacity-50"
                      />
                    </div>
                </div>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-mono text-xl font-bold">Photos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Up to 6 photos (JPEG, PNG, or WebP, max 5MB each).</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl">
                  <Image src={assetUrl(p.url) as string} alt="Business photo" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => deletePhoto(p)}
                    aria-label="Delete photo"
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/85 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {pendingPhotos.map((p, idx) => (
                <div key={idx} className="relative aspect-square overflow-hidden rounded-xl">
                  <Image src={p.preview} alt="Business photo" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => setPendingPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove photo"
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/85 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {photos.length + pendingPhotos.length < 6 ? (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary"
                >
                  <Icon name="i-image-plus" className="size-5" />
                  Add photo
                </button>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground">
                  6 photo limit
                </div>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPhoto(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Services & prices */}
          <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-mono text-xl font-bold">Services &amp; prices</h2>
              <button
                type="button"
                onClick={addService}
                className="flex items-center gap-1 text-sm font-bold text-primary"
              >
                <Icon name="i-plus" className="size-4" />
                Add
              </button>
            </div>
            <div ref={serviceListRef} className="mt-4 flex flex-col gap-3">
              {services.map((svc) => {
                const img = svc._pendingPreview || (svc.imageUrl ? assetUrl(svc.imageUrl) : null);
                return (
                  <div key={svc.clientId} className="flex items-center gap-3">
                    <div className="relative size-14 shrink-0">
                      {img ? (
                        <>
                          <Image src={img} alt="Service photo" width={56} height={56} className="size-14 rounded-lg object-cover" unoptimized />
                          <button
                            type="button"
                            onClick={() => onServiceRemovePhoto(svc)}
                            aria-label="Remove service photo"
                            className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-background/90 text-xs"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="flex size-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon name="i-image-plus" className="size-5" />
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="svc-name min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm"
                          value={svc.name}
                          placeholder="Service name"
                          onChange={(e) => updateService(svc.clientId, { name: e.target.value })}
                        />
                        <input
                          className="w-32 rounded-xl border border-border bg-background px-4 py-3 text-sm"
                          value={svc.price}
                          placeholder="0.00"
                          onChange={(e) => updateService(svc.clientId, { price: e.target.value })}
                        />
                        <ServicePhotoButton svc={svc} onPick={(file) => onServicePhoto(svc, file)} />
                        <button
                          type="button"
                          onClick={() => removeService(svc)}
                          aria-label="Remove service"
                          className="shrink-0 text-muted-foreground"
                        >
                          <Icon name="i-trash-2" className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {reapproval ? (
            <p className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              Saving changes to this listing will go live right away.
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-70"
          >
            <Icon name="i-save" className="size-4" />
            {saving ? "Saving…" : "Save business"}
          </button>
        </div>
      </section>
    </MarketplaceShell>
  );
}

function ServicePhotoButton({ svc, onPick }: { svc: ServiceRowState; onPick: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary"
        title={svc.imageUrl || svc._pendingPreview ? "Replace service photo" : "Add service photo"}
      >
        <Icon name="i-upload" className="size-4" />
        {svc.imageUrl || svc._pendingPreview ? "Photo" : "Add photo"}
      </button>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        ref={ref}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

export default function BusinessFormPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<div className="p-10 text-muted-foreground">Loading…</div>}>
        <BusinessFormInner />
      </Suspense>
    </main>
  );
}
