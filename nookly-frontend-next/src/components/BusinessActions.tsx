"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import { useAuthGate } from "@/components/AuthGate";
import MessageOwnerModal from "@/components/MessageOwnerModal";

export default function BusinessActions({
  businessId,
  ownerId,
  businessName,
}: {
  businessId: string;
  ownerId?: string;
  businessName: string;
}) {
  const authGate = useAuthGate();
  const [isFav, setIsFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  useEffect(() => {
    apiGet<{ favorited: boolean }>(
      `/favorites/check?deviceId=${getDeviceId()}&businessId=${businessId}`
    )
      .then((r) => setIsFav(!!r.data.favorited))
      .catch(() => {});
  }, [businessId]);

  async function toggleFav() {
    if (!authGate.guard()) return;
    setBusy(true);
    const body = { deviceId: getDeviceId(), businessId };
    try {
      await apiPost("/favorites", body);
      setIsFav(true);
    } catch {
      try {
        await apiDelete("/favorites", body);
        setIsFav(false);
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  function openMessage() {
    if (!authGate.guard()) return;
    setMsgOpen(true);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={toggleFav}
        disabled={busy}
        className={`rounded-xl border px-5 py-3 text-sm font-bold transition ${
          isFav
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-foreground hover:bg-muted"
        }`}
      >
        {isFav ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        onClick={openMessage}
        className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
      >
        Message this business
      </button>
      {ownerId ? (
        <Link
          href={`/owners/${ownerId}`}
          className="rounded-xl border border-border px-5 py-3 text-sm font-bold text-foreground transition hover:bg-muted"
        >
          View owner
        </Link>
      ) : null}
      <MessageOwnerModal
        businessId={businessId}
        businessName={businessName}
        open={msgOpen}
        onClose={() => setMsgOpen(false)}
      />
    </div>
  );
}
