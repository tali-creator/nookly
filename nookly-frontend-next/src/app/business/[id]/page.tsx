import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import Header from "@/components/Header";
import BusinessActions from "@/components/BusinessActions";
import TrackBusinessView from "@/components/TrackBusinessView";
import { apiGet } from "@/lib/api";
import { assetUrl } from "@/lib/config";
import { formatNaira } from "@/lib/format";
import type { BusinessDetail, BusinessHours } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hoursByDay(hours: BusinessHours[]) {
  const map = new Map<number, BusinessHours>();
  for (const h of hours) map.set(h.dayOfWeek, h);
  return Array.from({ length: 7 }, (_, i) => map.get(i));
}

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let business: BusinessDetail | null = null;
  try {
    const { data } = await apiGet<{ business: BusinessDetail }>(
      "/businesses/" + id
    );
    business = data.business;
  } catch {
    notFound();
  }
  if (!business) notFound();

  const week = hoursByDay(business.hours);

  return (
    <main className="min-h-screen">
      <TrackBusinessView businessId={id} />
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Back to results
        </Link>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative h-56 w-full bg-muted">
            {business.photos[0] ? (
              <Image
                src={assetUrl(business.photos[0].url) as string}
                alt={business.name}
                fill
                sizes="100vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                No photo
              </div>
            )}
            {business.isFeatured && (
              <span className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                Featured
              </span>
            )}
          </div>

          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{business.name}</h1>
                {business.category && (
                  <p className="text-sm font-medium text-muted-foreground">
                    {business.category.name}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
                {business.status === "APPROVED" ? "Open for business" : business.status}
              </span>
            </div>

            {business.address && (
              <p className="mt-2 text-sm text-muted-foreground">{business.address}</p>
            )}
            {business.description && (
              <p className="mt-4 leading-relaxed text-foreground/90">
                {business.description}
              </p>
            )}

            <BusinessActions
              businessId={business.id}
              ownerId={business.owner?.id}
              businessName={business.name}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-lg font-semibold">Services &amp; pricing</h2>
            {business.serviceItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services listed yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {business.serviceItems.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      {s.description && (
                        <p className="text-sm text-muted-foreground">{s.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold text-primary">
                      {formatNaira(s.price)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-lg font-semibold">Opening hours</h2>
            <ul className="divide-y divide-border">
              {week.map((h, i) =>
                h && h.openTime && h.closeTime ? (
                  <li key={i} className="flex justify-between py-2 text-sm">
                    <span className="font-medium">{DAYS[i]}</span>
                    <span className="text-muted-foreground">
                      {h.openTime} – {h.closeTime}
                    </span>
                  </li>
                ) : (
                  <li key={i} className="flex justify-between py-2 text-sm">
                    <span className="font-medium">{DAYS[i]}</span>
                    <span className="text-muted-foreground">Closed</span>
                  </li>
                )
              )}
            </ul>
          </section>
        </div>

        {business.photos.length > 1 && (
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-semibold">Gallery</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {business.photos.map((p) => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card">
                  <Image
                    src={assetUrl(p.url) as string}
                    alt={business.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
