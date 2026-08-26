"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import type { Category } from "@/lib/types";

/* Nominatim requires a valid HTTP Referer/User-Agent. Browsers block setting
   User-Agent from JS, so we send an explicit Referer header (allowed by fetch)
   plus a custom X-Requested-With. Rate-limited to 1 req/sec. */
let lastNominatimAt = 0;
async function forwardGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const wait = Math.max(0, 1000 - (Date.now() - lastNominatimAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
  const res = await fetch(
    "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(query) + "&format=json&limit=1",
    { headers: { Referer: window.location.origin + "/", "X-Requested-With": "Nookly" } }
  );
  if (!res.ok) throw new Error("Location service error (" + res.status + ")");
  const data = await res.json();
  const hit = Array.isArray(data) && data.length ? data[0] : null;
  if (!hit) return null;
  return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
}

interface AddBusinessModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddBusinessModal({ open, onClose, onCreated }: AddBusinessModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [keywords, setKeywords] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locStatus, setLocStatus] = useState<{ text: string; tone: "ok" | "error" | "warn" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    // Reset the form each time the modal opens.
    setName("");
    setCategoryId("");
    setDescription("");
    setAddress("");
    setKeywords("");
    setPhone("");
    setWhatsapp("");
    setLat("");
    setLng("");
    setLocStatus(null);
    setError("");
    setSaving(false);
    apiGet<{ categories: Category[] }>("/categories")
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => {});
  }, [open]);

  async function resolveAddress(): Promise<boolean> {
    const query = address.trim();
    if (!query) {
      setLocStatus({ text: "Type an address to look up your location.", tone: "error" });
      return false;
    }
    setLocStatus({ text: 'Looking up "' + query + '"…', tone: "warn" });
    try {
      const result = await forwardGeocode(query);
      if (!result) {
        setLat("");
        setLng("");
        setLocStatus({
          text: "We couldn't determine your location — please try a more specific address.",
          tone: "error",
        });
        return false;
      }
      setLat(String(result.lat));
      setLng(String(result.lng));
      setLocStatus({ text: '📍 Location found for "' + query + '".', tone: "ok" });
      return true;
    } catch (err) {
      setLat("");
      setLng("");
      setLocStatus({
        text: "Location lookup failed (" + ((err as Error).message || "network error") + "). Please try again.",
        tone: "error",
      });
      return false;
    }
  }

  async function submit() {
    setError("");
    if (!name.trim() || !categoryId || !description.trim() || !address.trim()) {
      setError("Please fill in the business name, category, description, and address.");
      return;
    }
    let la = parseFloat(lat);
    let ln = parseFloat(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) {
      const ok = await resolveAddress();
      if (!ok) return;
      la = parseFloat(lat);
      ln = parseFloat(lng);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) {
        setError("We couldn't determine your location. Please check the address.");
        return;
      }
    }

    setSaving(true);
    try {
      await apiPost("/businesses", {
        name: name.trim(),
        categoryId,
        description: description.trim(),
        address: address.trim(),
        keywords: keywords.trim() || null,
        lat: la,
        lng: ln,
        phone: phone.trim(),
        whatsappNumber: whatsapp.trim() || null,
      });
      onCreated();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not add the business.");
    }
  }

  if (!open) return null;

  const locStatusClass =
    locStatus?.tone === "ok"
      ? "border-primary/20 bg-primary/10 text-primary"
      : locStatus?.tone === "error"
      ? "border-destructive/30 bg-red-50 text-red-600"
      : "border-border bg-muted/60 text-muted-foreground";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add business"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-2xl font-bold">Add business</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="flex flex-col gap-4">
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
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Description
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Search keywords{" "}
            <span className="font-normal text-muted-foreground">
              (optional — comma or space separated; helps customers find you)
            </span>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="babban saura, generator repair"
              className="rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Address
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => address.trim() && resolveAddress()}
              placeholder="Street, area, city"
              autoComplete="street-address"
              className="rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          {locStatus ? (
            <p className={`rounded-xl border px-4 py-3 text-sm ${locStatusClass}`}>{locStatus.text}</p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-5 py-3 font-bold hover:border-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-70"
          >
            {saving ? (
              <>
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
                Adding…
              </>
            ) : (
              "Add business"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
