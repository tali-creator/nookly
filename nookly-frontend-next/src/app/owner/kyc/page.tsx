"use client";

/* Owner verification (KYC) — port 1:1 from nookly-frontend/owner/kyc.html. */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MarketplaceShell from "@/components/MarketplaceShell";
import { apiGet, apiPost } from "@/lib/api";
import { getToken, ensureSeedFromQuery } from "@/lib/auth";
import type { KycSubmission } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-primary/15 text-primary",
  REJECTED: "bg-red-100 text-red-700",
};

type ProofType = "HOME" | "WORKSHOP" | "BOTH";

export default function KycPage() {
  const router = useRouter();
  const [proofType, setProofType] = useState<ProofType>("HOME");
  const [submission, setSubmission] = useState<KycSubmission | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    ensureSeedFromQuery();
    if (!getToken()) {
      router.replace("/owner/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiGet<{ submission: KycSubmission | null }>("/kyc");
      setSubmission(res.data.submission ?? null);
      setStatusLoaded(true);
    } catch {
      setSubmission(null);
      setStatusLoaded(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus();
  }, [loadStatus]);

  /* Toggle which proof-of-address file inputs are required based on type. */
  function syncProofFields(type: ProofType) {
    setProofType(type);
  }

  const homeActive = proofType === "HOME" || proofType === "BOTH";
  const workshopActive = proofType === "WORKSHOP" || proofType === "BOTH";
  /* Exact class strings from kyc.html syncProofFields() for each mode. */
  const homeWrapClass =
    proofType === "WORKSHOP"
      ? "flex-col gap-2 text-sm font-semibold"
      : "flex gap-2 text-sm font-semibold";
  const workshopWrapClass =
    proofType === "HOME"
      ? "flex-col gap-2 text-sm font-semibold sm:flex"
      : "flex gap-2 text-sm font-semibold sm:flex";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);
    const form = e.currentTarget;
    try {
      const fd = new FormData(form);
      await apiPost("/kyc", fd);
      setMessage("Verification submitted for review. You can check its status here.");
      setMessageIsError(false);
      form.reset();
      syncProofFields("HOME");
      await loadStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setMessageIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  let statusCard: React.ReactNode = null;
  if (statusLoaded) {
    if (!submission) {
      statusCard = (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <svg className="mt-0.5 size-5 text-muted-foreground" aria-hidden="true">
            <use href="#i-lock-keyhole" />
          </svg>
          <div>
            <p className="font-bold">Not verified yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You have not submitted identity documents yet. Complete the form below to get
              started.
            </p>
          </div>
        </div>
      );
    } else {
      const style = STATUS_STYLES[submission.status] || "bg-muted text-muted-foreground";
      statusCard = (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <svg className="mt-0.5 size-5 text-primary" aria-hidden="true">
            <use href="#i-shield-check" />
          </svg>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold">
                Status:{" "}
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>
                  {submission.status}
                </span>
              </p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              NIN <span className="font-mono">{submission.ninMasked}</span> ·{" "}
              {submission.proofOfAddressType} proof · submitted{" "}
              {new Date(submission.submittedAt).toLocaleDateString()}
            </p>
            {submission.rejectionReason ? (
              <p className="mt-2 text-sm text-red-600">
                <strong>Rejection reason:</strong> {submission.rejectionReason}
              </p>
            ) : null}
          </div>
        </div>
      );
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketplaceShell active="kyc">
        <section>
          <div className="mb-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Your Nookly
            </p>
            <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">
              Owner verification
            </h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Verify your identity once to unlock business approvals. Your NIN is masked at
              all times and your documents are private.
            </p>
          </div>

          {message ? (
            <p
              className={`mb-6 rounded-xl p-3 text-sm ${
                messageIsError ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"
              }`}
            >
              {message}
            </p>
          ) : null}

          {statusLoaded ? <div className="mb-6">{statusCard}</div> : null}

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-mono text-xl font-bold">Submit verification</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a clear selfie, your NIN, and proof of address. Documents are
                encrypted at rest on our private storage.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
                <label className="flex flex-col gap-2 text-sm font-semibold">
                  National ID number (NIN)
                  <input
                    required
                    inputMode="numeric"
                    pattern="[0-9]{11}"
                    maxLength={11}
                    name="nin"
                    placeholder="11 digits"
                    className="rounded-xl border border-input bg-background px-4 py-3 font-mono font-normal outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold">Proof of address type</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                      <input
                        type="radio"
                        name="proofOfAddressType"
                        value="HOME"
                        checked={proofType === "HOME"}
                        onChange={() => syncProofFields("HOME")}
                        className="accent-primary"
                      />{" "}
                      Home address
                    </label>
                    <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                      <input
                        type="radio"
                        name="proofOfAddressType"
                        value="WORKSHOP"
                        checked={proofType === "WORKSHOP"}
                        onChange={() => syncProofFields("WORKSHOP")}
                        className="accent-primary"
                      />{" "}
                      Workshop address
                    </label>
                    <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                      <input
                        type="radio"
                        name="proofOfAddressType"
                        value="BOTH"
                        checked={proofType === "BOTH"}
                        onChange={() => syncProofFields("BOTH")}
                        className="accent-primary"
                      />{" "}
                      Both
                    </label>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    Selfie photo
                    <input
                      required
                      type="file"
                      name="selfie"
                      accept="image/png,image/jpeg,image/webp"
                      className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    Certificate of registration (optional)
                    <input
                      type="file"
                      name="certificate"
                      accept="image/png,image/jpeg,image/webp"
                      className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className={homeWrapClass}>
                    Home proof of address
                    <input
                      required={homeActive}
                      type="file"
                      name="proofOfAddressHome"
                      accept="image/png,image/jpeg,image/webp"
                      className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className={workshopWrapClass}>
                    Workshop proof of address
                    <input
                      required={workshopActive}
                      type="file"
                      name="proofOfAddressWorkshop"
                      accept="image/png,image/jpeg,image/webp"
                      className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:opacity-90"
                >
                  {submitting ? "Submitting…" : "Submit verification"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </MarketplaceShell>
    </main>
  );
}
