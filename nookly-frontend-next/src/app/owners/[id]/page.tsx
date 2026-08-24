"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import BusinessCard from "@/components/BusinessCard";
import { apiGet, apiPost } from "@/lib/api";
import { imageUrl } from "@/lib/helpers";
import { getDeviceId } from "@/lib/device-id";
import { useAuthGate } from "@/components/AuthGate";
import MessageOwnerModal from "@/components/MessageOwnerModal";
import type { NearbyBusiness } from "@/lib/types";

interface PublicOwner {
  id: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  kycStatus: string;
  isVerified: boolean;
  joinedLabel: string;
}

export default function OwnerProfilePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const authGate = useAuthGate();

  const [owner, setOwner] = useState<PublicOwner | null>(null);
  const [businesses, setBusinesses] = useState<NearbyBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await apiGet<{ owner: PublicOwner; businesses: NearbyBusiness[] }>(
          "/owners/" + id
        );
        if (cancelled) return;
        setOwner(r.data.owner);
        setBusinesses(r.data.businesses || []);
        // Record a public-profile visit (fire and forget).
        apiPost("/owners/" + id + "/visits", { deviceId: getDeviceId() }).catch(() => {});
      } catch {
        if (!cancelled) setError("Could not load this profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const avatar = owner?.avatarUrl ? imageUrl(owner.avatarUrl) : null;
  const firstBusiness = businesses[0];

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b border-border/70 px-5 py-10 lg:px-8 lg:py-14">
          <div className="mx-auto max-w-5xl">
            <Link href="/" className="text-sm text-muted-foreground hover:underline">
              ← Back
            </Link>
            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="size-20 rounded-2xl object-cover" />
              ) : (
                <span className="flex size-20 items-center justify-center rounded-2xl bg-primary/10 font-mono text-2xl font-bold text-primary">
                  {(owner?.name || "?").charAt(0)}
                </span>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-mono text-3xl font-bold tracking-[-0.05em]">
                    {owner?.name || "Owner"}
                  </h1>
                  {owner?.isVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      <svg className="size-3">
                        <use href="#i-shield-check" />
                      </svg>
                      Verified
                    </span>
                  ) : null}
                </div>
                {owner?.joinedLabel ? (
                  <p className="mt-1 text-sm text-muted-foreground">{owner.joinedLabel}</p>
                ) : null}
                {owner?.bio ? (
                  <p className="mt-3 max-w-2xl leading-relaxed text-foreground/90">
                    {owner.bio}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {owner?.whatsappNumber ? (
                    <a
                      href={`https://wa.me/${owner.whatsappNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
                    >
                      WhatsApp
                    </a>
                  ) : null}
                  {owner?.phone ? (
                    <a
                      href={`tel:${owner.phone}`}
                      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
                    >
                      {owner.phone}
                    </a>
                  ) : null}
                  {firstBusiness ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!authGate.guard()) return;
                        setMsgOpen(true);
                      }}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90"
                    >
                      Message
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
          <h2 className="font-mono text-xl font-bold">Businesses</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
                Loading…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center text-destructive md:col-span-2 lg:col-span-3">
                {error}
              </div>
            ) : businesses.length ? (
              businesses.map((b) => <BusinessCard key={b.id} business={b} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
                No public businesses yet.
              </div>
            )}
          </div>
        </section>
      </main>
      {firstBusiness ? (
        <MessageOwnerModal
          businessId={firstBusiness.id}
          businessName={firstBusiness.name}
          open={msgOpen}
          onClose={() => setMsgOpen(false)}
        />
      ) : null}
    </>
  );
}
