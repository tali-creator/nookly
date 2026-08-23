"use client";

/* Admin KYC review — ported 1:1 from nookly-frontend/admin/kyc-review.html. */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import MarketplaceShell from "@/components/MarketplaceShell";
import { API_BASE_URL } from "@/lib/config";
import { apiGet, apiPatch } from "@/lib/api";
import { clearSession, ensureSeedFromQuery, getToken, getUser } from "@/lib/auth";
import type { AdminKycListResponse, AdminKycQueueItem, AdminKycSubmissionDetail } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-primary/15 text-primary",
  REJECTED: "bg-red-100 text-red-700",
};

const TABS = ["PENDING", "VERIFIED", "REJECTED"] as const;

const QUEUE_MESSAGE =
  "rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground";

/* Cache-buster for document fetches (module scope: impure Date.now is fine here). */
function cacheBust(): string {
  return String(Date.now());
}

type Tab = (typeof TABS)[number];

export default function AdminKycReviewPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Tab>("PENDING");
  const [page, setPage] = useState(1);
  const pageLimit = 10;
  const [queue, setQueue] = useState<{
    items?: AdminKycQueueItem[];
    total?: number;
    error?: string;
  } | null>(null);
  const [detail, setDetail] = useState<AdminKycSubmissionDetail | null>(null);
  const [detailNin, setDetailNin] = useState("");
  const [docState, setDocState] = useState<{
    field: string;
    url: string | null;
    failed?: boolean;
  } | null>(null);
  const [message, setMessage] = useState("");

  const loadQueue = useCallback(
    async (s: Tab, p: number) => {
      setQueue(null);
      try {
        const { data } = await apiGet<AdminKycListResponse>(
          "/admin/kyc?status=" + s + "&page=" + p + "&limit=" + pageLimit
        );
        setQueue({ items: data.data || [], total: data.total || 0 });
      } catch (err) {
        setQueue({ error: err instanceof Error ? err.message : "" });
      }
    },
    []
  );

  useEffect(() => {
    ensureSeedFromQuery();
    // requireAdmin(): no token -> admin login; wrong role -> kick out.
    if (!getToken()) {
      router.replace("/admin");
      return;
    }
    const user = getUser();
    if (!user || user.role !== "ADMIN") {
      clearSession();
      router.replace("/admin");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadQueue() resets to the loading state synchronously
    loadQueue("PENDING", 1);
  }, [router, loadQueue]);

  function switchTab(s: Tab) {
    setStatus(s);
    setPage(1);
    loadQueue(s, 1);
  }

  function closeDetail() {
    setDetail(null);
    setDocState(null);
    loadQueue(status, page);
  }

  async function openDetail(userId: string, ninMasked: string) {
    setDocState(null);
    try {
      const { data } = await apiGet<{ submission: AdminKycSubmissionDetail }>(
        "/admin/kyc/" + userId
      );
      setDetailNin(ninMasked);
      setDetail(data.submission);
    } catch (err) {
      setQueue({ error: err instanceof Error ? err.message : "" });
    }
  }

  async function viewDocument(userId: string, field: string) {
    setDocState({ field, url: null });
    try {
      const res = await fetch(
        API_BASE_URL + "/admin/kyc/" + userId + "/documents/" + field + "?t=" + cacheBust(),
        { headers: { Authorization: "Bearer " + getToken() } }
      );
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      setDocState({ field, url: URL.createObjectURL(blob) });
    } catch {
      setDocState({ field, url: null, failed: true });
    }
  }

  async function verifySubmission(userId: string) {
    if (!window.confirm("Verify this owner? Their businesses will be eligible for approval."))
      return;
    try {
      await apiPatch("/admin/kyc/" + userId + "/verify");
      setMessage("Owner verified.");
      closeDetail();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Verification failed");
    }
  }

  async function rejectSubmission(userId: string) {
    const reason = window.prompt("Rejection reason (10+ characters):");
    if (reason === null) return;
    try {
      await apiPatch("/admin/kyc/" + userId + "/reject", { reason });
      setMessage("Submission rejected. The owner has been notified.");
      closeDetail();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Rejection failed");
    }
  }

  const pages =
    queue?.total !== undefined ? Math.max(1, Math.ceil(queue.total / pageLimit)) : 1;

  const docFields = [
    { label: "Selfie", field: "selfie" },
    { label: "Certificate of registration", field: "certificate" },
    { label: "Home proof of address", field: "proofOfAddressHome" },
    { label: "Workshop proof of address", field: "proofOfAddressWorkshop" },
  ];

  return (
    <MarketplaceShell active="kyc" sidebar="admin">
      <section>
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Admin console
          </p>
          <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">KYC review</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Review owner identity submissions. Verify owners whose documents check out so their
            businesses can be approved.
          </p>
        </div>
        {message ? (
          <p className="mb-6 rounded-xl bg-red-50 p-3 text-sm text-red-600">{message}</p>
        ) : null}

        {detail ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-mono text-xl font-bold">
                    {(detail.user && (detail.user.displayName || detail.user.email)) ||
                      "Unknown owner"}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      STATUS_STYLES[detail.status] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {detail.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.user ? detail.user.email : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
              >
                &larr; Back to queue
              </button>
            </div>
            <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">NIN</dt>
                <dd className="font-mono font-semibold">{detailNin || detail.ninMasked || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Proof of address</dt>
                <dd className="font-semibold">{detail.proofOfAddressType || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="font-semibold">
                  {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Reviewed</dt>
                <dd className="font-semibold">
                  {detail.reviewedAt
                    ? new Date(detail.reviewedAt).toLocaleString()
                    : "Not yet reviewed"}
                </dd>
              </div>
              {detail.rejectionReason ? (
                <div className="flex justify-between gap-4 border-b border-border pb-2 sm:col-span-2">
                  <dt className="text-muted-foreground">Rejection reason</dt>
                  <dd className="font-semibold text-red-600">{detail.rejectionReason}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              {docFields.map((d) => (
                <button
                  key={d.field}
                  type="button"
                  onClick={() => detail.user && viewDocument(detail.user.id, d.field)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                >
                  {d.label}
                </button>
              ))}
            </div>
            {docState ? (
              <div className="mt-4">
                {docState.url ? (
                  <Image
                    src={docState.url}
                    alt={docState.field}
                    width={600}
                    height={800}
                    className="mx-auto max-h-96 rounded-xl border border-border object-contain"
                    unoptimized
                  />
                ) : docState.failed ? (
                  <div className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
                    Could not load document. It may not have been uploaded.
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
                    Loading document…
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 hidden"></div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              {detail.status === "PENDING" || detail.status === "REJECTED" ? (
                <button
                  type="button"
                  onClick={() => detail.user && verifySubmission(detail.user.id)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  Verify &amp; approve
                </button>
              ) : null}
              {detail.status === "PENDING" ? (
                <button
                  type="button"
                  onClick={() => detail.user && rejectSubmission(detail.user.id)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
                >
                  Reject
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTab(t)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    status === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {queue === null ? (
                <div className={QUEUE_MESSAGE}>Loading…</div>
              ) : queue.error !== undefined ? (
                <div className={QUEUE_MESSAGE}>
                  Could not load the KYC queue. {queue.error}
                </div>
              ) : !queue.items?.length ? (
                <div className={QUEUE_MESSAGE}>No {status.toLowerCase()} submissions.</div>
              ) : (
                queue.items.map((s) => {
                  const ownerName =
                    (s.owner && (s.owner.displayName || s.owner.email)) || "Unknown owner";
                  return (
                    <div key={s.id} className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-mono text-xl font-bold">{ownerName}</h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                STATUS_STYLES[s.status] || "bg-muted text-muted-foreground"
                              }`}
                            >
                              {s.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {s.owner ? s.owner.email : ""} · NIN{" "}
                            <span className="font-mono">{s.ninMasked}</span> · submitted{" "}
                            {new Date(s.submittedAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openDetail(s.owner.id, s.ninMasked)}
                          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {queue?.items?.length && !queue.error ? (
              <div className="mt-6 flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {queue.total} submission{queue.total === 1 ? "" : "s"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (page <= 1) return;
                      const p = page - 1;
                      setPage(p);
                      loadQueue(status, p);
                    }}
                    disabled={page <= 1}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (page >= pages) return;
                      const p = page + 1;
                      setPage(p);
                      loadQueue(status, p);
                    }}
                    disabled={page >= pages}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </MarketplaceShell>
  );
}
