"use client";

/* Shared business card — faithful port of js/cards.js renderBusinessCard.
   Data shape: nearby/featured/favorites list items from the API. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { imageUrl, initials, isOpenNow } from "@/lib/helpers";
import { formatNaira } from "@/lib/format";
import { getDeviceId } from "@/lib/device-id";
import { useAuthGate } from "@/components/AuthGate";
import MessageOwnerModal from "@/components/MessageOwnerModal";
import type { NearbyBusiness } from "@/lib/types";

const CARD_TONES = [
  "bg-[#d7ebbd]",
  "bg-[#f5d2bb]",
  "bg-[#cbdcf2]",
  "bg-[#f3d8e5]",
  "bg-[#f0e6c8]",
  "bg-[#dcebc9]",
];

function toneFor(id: string): string {
  let hash = 0;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return CARD_TONES[hash % CARD_TONES.length];
}

async function favoriteState(businessId: string): Promise<boolean> {
  try {
    const { data } = await apiGet<{ favorited: boolean }>(
      "/favorites/check?deviceId=" + getDeviceId() + "&businessId=" + businessId
    );
    return !!data.favorited;
  } catch {
    return false;
  }
}

async function toggleFavorite(businessId: string): Promise<boolean | null> {
  const body = { deviceId: getDeviceId(), businessId };
  try {
    await apiPost("/favorites", body);
    return true;
  } catch {
    try {
      await apiDelete("/favorites", body);
      return false;
    } catch {
      return null;
    }
  }
}

/* onFavChange(businessId, isFav) fires after a toggle. */
export default function BusinessCard({
  business,
  onFavChange,
}: {
  business: NearbyBusiness;
  onFavChange?: (businessId: string, isFav: boolean) => void;
}) {
  const authGate = useAuthGate();
  const [isFav, setIsFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  useEffect(() => {
    favoriteState(business.id).then(setIsFav);
  }, [business.id]);

  const cover = imageUrl(business.coverUrl);
  const price =
    business.price != null && business.price !== "" ? formatNaira(business.price) : null;
  const distance =
    business.distanceKm != null
      ? Number(business.distanceKm).toFixed(1) + " km away"
      : null;
  const open = isOpenNow(business.hours, business.timezone);

  async function handleToggle() {
    if (busy) return;
    if (!authGate.guard()) return;
    setBusy(true);
    const next = await toggleFavorite(business.id);
    setBusy(false);
    if (next === null) return;
    setIsFav(next);
    if (onFavChange) onFavChange(business.id, next);
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:shadow-lg">
      <div
        className={`relative flex h-48 items-end p-5 ${cover ? "" : toneFor(business.id)}`}
        style={
          cover
            ? {
                backgroundImage: `url(${cover})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-foreground/10 to-transparent" />
        {business.isFeatured ? (
          <span className="absolute left-4 top-4 rounded-full bg-background/85 px-3 py-1.5 text-[11px] font-bold backdrop-blur">
            Featured
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (!authGate.guard()) return;
            setMsgOpen(true);
          }}
          aria-label="Message this business"
          className="absolute right-16 top-4 flex size-9 items-center justify-center rounded-full bg-background/85 transition hover:scale-105"
        >
          <svg className="size-4 text-foreground" aria-hidden="true">
            <use href="#i-message-circle" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleToggle}
          disabled={busy}
          aria-label={isFav ? "Remove from favorites" : "Save to favorites"}
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-background/85 transition hover:scale-105"
        >
          <svg
            className={`size-4 ${isFav ? "fill-primary text-primary" : ""}`}
            aria-hidden="true"
          >
            <use href="#i-heart" />
          </svg>
        </button>
        {cover ? null : (
          <div className="flex size-24 items-center justify-center rounded-full border-4 border-background/80 bg-background/40 text-2xl font-bold backdrop-blur">
            {initials(business.name)}
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-mono text-lg font-bold">{business.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {business.category ? business.category.name : ""}
        </p>
        {open !== null ? (
          <span
            className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
              open ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {open ? "Open now" : "Closed now"}
          </span>
        ) : null}
        {business.owner?.isVerified ? (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 align-middle text-[11px] font-bold text-primary">
            <svg className="size-3" aria-hidden="true">
              <use href="#i-shield-check" />
            </svg>
            Verified
          </span>
        ) : null}
        <div className="mt-3 flex items-center justify-between text-sm">
          {distance ? (
            <span className="text-muted-foreground">{distance}</span>
          ) : (
            <span />
          )}
          {price ? (
            <span className="text-muted-foreground">
              From <strong className="text-foreground">{price}</strong>
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <Link
            href={business.owner?.id ? `/owners/${business.owner.id}` : "/"}
            className="text-sm font-bold text-primary"
          >
            Visit owner{" "}
            <svg className="inline size-4" aria-hidden="true">
              <use href="#i-arrow-right" />
            </svg>
          </Link>
          <Link
            href={`/business/${business.id}`}
            className="text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            View profile
          </Link>
        </div>
      </div>
      <MessageOwnerModal
        businessId={business.id}
        businessName={business.name}
        open={msgOpen}
        onClose={() => setMsgOpen(false)}
      />
    </article>
  );
}
