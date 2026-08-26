"use client";

/* Profile — port 1:1 from nookly-frontend/profile.html. */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AccountShell from "@/components/AccountShell";
import RequireAuth from "@/components/RequireAuth";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { getToken, ensureSeedFromQuery } from "@/lib/auth";
import { imageUrl, initials } from "@/lib/helpers";
import { ApiError } from "@/lib/api";
import type { ProfileData, ProfileBusiness, KycSubmission } from "@/lib/types";

const PROOF_LABELS: Record<string, string> = {
  HOME: "Home address",
  WORKSHOP: "Workshop address",
  BOTH: "Home & workshop address",
};

const CONTACT_LABELS: Record<string, string> = {
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

const KYC_STYLES: Record<string, string> = {
  NOT_SUBMITTED: "bg-muted text-muted-foreground",
  PENDING: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-primary/15 text-primary",
  REJECTED: "bg-red-100 text-red-700",
};
const KYC_LABELS: Record<string, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Pending review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};
const KYC_LINK_TEXT: Record<string, string> = {
  NOT_SUBMITTED: "Start verification",
  PENDING: "View status",
  VERIFIED: "Manage",
  REJECTED: "Resubmit",
};

const BIZ_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-primary/15 text-primary",
  REJECTED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-muted text-muted-foreground",
};

function statusBadge(status: string, note?: string | null): React.ReactNode {
  return (
    <>
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
          BIZ_STATUS_STYLES[status] || "bg-muted text-muted-foreground"
        }`}
      >
        {status}
      </span>
      {(status === "REJECTED" || status === "SUSPENDED") && note ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <strong className="text-red-600">Reason:</strong> {note}
        </p>
      ) : null}
    </>
  );
}

function roleText(role: string): string {
  if (role === "ADMIN") return "Administrator";
  if (role === "BUSINESS_OWNER") return "Business owner";
  return role;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [kyc, setKyc] = useState<KycSubmission | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bioCount, setBioCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  /* Form field state */
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [tiktok, setTiktok] = useState("");

  useEffect(() => {
    ensureSeedFromQuery();
    if (!getToken()) {
      router.replace("/owner/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fillForm(p: ProfileData) {
    setDisplayName(p.displayName || "");
    setEmail(p.email || "");
    setBio(p.bio || "");
    setBioCount((p.bio || "").length);
    setPhone(p.phone || "");
    setWhatsapp(p.whatsappNumber || "");
    setContactMethod(p.preferredContactMethod || "");
    const s = p.socialHandles || {};
    setInstagram(s.instagram || "");
    setFacebook(s.facebook || "");
    setTwitter(s.twitter || "");
    setTiktok(s.tiktok || "");
  }

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ profile: ProfileData }>("/profile");
      setProfile(res.data.profile);
      fillForm(res.data.profile);
      try {
        const kres = await apiGet<{ submission: KycSubmission | null }>("/kyc");
        setKyc(kres.data.submission ?? null);
      } catch {
        setKyc(null);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load your profile.");
      setMessageIsError(true);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const body = {
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        preferredContactMethod: (contactMethod || null) as
          | "PHONE"
          | "WHATSAPP"
          | "EMAIL"
          | null,
        phone: phone.trim() || null,
        whatsappNumber: whatsapp.trim() || null,
        socialHandles: {
          instagram: instagram.trim() || undefined,
          facebook: facebook.trim() || undefined,
          twitter: twitter.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
        },
      };
      const res = await apiPatch<{ profile: ProfileData }>("/profile", body);
      setProfile(res.data.profile);
      fillForm(res.data.profile);
      setMessage("Profile saved.");
      setMessageIsError(false);
      setEditOpen(false);
    } catch (err) {
      const f = err instanceof ApiError ? err.fields || {} : {};
      const first =
        f.displayName?.[0] ||
        f.bio?.[0] ||
        f.preferredContactMethod?.[0] ||
        f.phone?.[0] ||
        f.whatsappNumber?.[0] ||
        f.socialHandles?.[0];
      setMessage(
        first ||
          (err instanceof Error ? err.message : "Could not save changes.")
      );
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await apiPost<{ avatarUrl: string }>("/profile/avatar", fd);
      setProfile((prev) => (prev ? { ...prev, avatarUrl: res.data.avatarUrl } : prev));
      setMessage("Profile photo updated.");
      setMessageIsError(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Photo upload failed.");
      setMessageIsError(true);
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  }

  const name = profile ? profile.displayName || profile.email : "Guest";
  const kycStatus = profile?.kycStatus || "NOT_SUBMITTED";
  const joined = profile?.createdAt ? new Date(profile.createdAt) : null;
  const businesses: ProfileBusiness[] = profile?.businesses || [];

  const socials: [string, string][] = [
    ["Instagram", profile?.socialHandles?.instagram || ""],
    ["Facebook", profile?.socialHandles?.facebook || ""],
    ["Twitter / X", profile?.socialHandles?.twitter || ""],
    ["TikTok", profile?.socialHandles?.tiktok || ""],
  ].filter(([, v]) => Boolean(v)) as [string, string][];

  function closeEdit() {
    if (profile) fillForm(profile);
    setEditOpen(false);
  }

  return (
    <RequireAuth>
    <main className="min-h-screen bg-background text-foreground">
      <AccountShell active="profile">
        <section>
          <div className="mb-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Your Nookly
            </p>
            <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">Your profile</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Keep your details current so customers and service providers know who they are
              working with.
            </p>
          </div>

          <p
            className={`mb-6 rounded-xl p-3 text-sm ${
              messageIsError ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"
            } ${message ? "" : "hidden"}`}
          >
            {message}
          </p>

          <div className="flex flex-col gap-6">
            {/* Profile header */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col sm:flex-wrapalso add  items-center gap-4 border-b border-border pb-6">
                <div className="relative">
                  {profile?.avatarUrl ? (
                    <Image
                      src={imageUrl(profile.avatarUrl) || ""}
                      alt="Avatar"
                      width={80}
                      height={80}
                      className="size-20 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex size-20 items-center justify-center rounded-full bg-primary/20 font-mono text-2xl font-bold text-primary">
                      {initials(name)}
                    </div>
                  )}
                  <label
                    title="Change photo"
                    aria-label="Change profile photo"
                    className="absolute -bottom-1 -right-1 flex size-7 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
                  >
                    <svg className="size-4" aria-hidden="true">
                      <use href="#i-upload" />
                    </svg>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-2 font-mono text-xl font-bold">
                    {name}
                  </h2>
                  <p
                    className="truncate text-sm text-muted-foreground"
                    title={profile?.email ?? undefined}
                  >
                    {profile ? profile.email : "Not signed in"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {joined
                      ? "Member since " +
                        joined.toLocaleDateString("en-NG", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {profile ? roleText(profile.role) : "—"}
                </span>
              </div>

              {/* KYC status */}
              <div className="mt-6 rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <svg className="size-5" aria-hidden="true">
                        <use href="#i-shield-check" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Verification</p>
                      <p className="text-xs text-muted-foreground">
                        Confirm your identity to list businesses
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                        KYC_STYLES[kycStatus] || KYC_STYLES.NOT_SUBMITTED
                      }`}
                    >
                      {kycStatus === "VERIFIED" ? (
                        <svg className="size-4" aria-hidden="true">
                          <use href="#i-check-circle-2" />
                        </svg>
                      ) : null}
                      {KYC_LABELS[kycStatus] || kycStatus}
                    </span>
                    <Link
                      href="/owner/kyc"
                      className={`rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary ${
                        kycStatus === "REJECTED" ? "border-red-300 text-red-600" : ""
                      }`}
                    >
                      {KYC_LINK_TEXT[kycStatus] || "Manage"}
                    </Link>
                  </div>
                </div>
                {kyc ? (
                  <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        NIN
                      </dt>
                      <dd className="mt-1 font-mono text-sm">{kyc.ninMasked}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Proof of address
                      </dt>
                      <dd className="mt-1 text-sm">
                        {PROOF_LABELS[kyc.proofOfAddressType] || kyc.proofOfAddressType}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            </div>

            {/* Profile details (read-only) */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-mono text-lg font-bold">Profile details</h3>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary"
                >
                  Edit profile
                </button>
              </div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Name
                  </dt>
                  <dd className="mt-1 text-sm">{profile?.displayName || profile?.email || "—"}</dd>
                </div>
                {profile?.whatsappNumber ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      WhatsApp
                    </dt>
                    <dd className="mt-1 text-sm">{profile.whatsappNumber}</dd>
                  </div>
                ) : null}
                {profile?.phone ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Phone
                    </dt>
                    <dd className="mt-1 text-sm">{profile.phone}</dd>
                  </div>
                ) : null}
                {profile?.preferredContactMethod ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Preferred contact
                    </dt>
                    <dd className="mt-1 text-sm">
                      {CONTACT_LABELS[profile.preferredContactMethod] ||
                        profile.preferredContactMethod}
                    </dd>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Bio
                  </dt>
                  <dd className="mt-1 text-sm">{profile?.bio || "No bio yet."}</dd>
                </div>
                {socials.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Edit profile modal */}
            {editOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
                onClick={closeEdit}
              >
                <div
                  className="relative mt-20 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={closeEdit}
                    aria-label="Close"
                    className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <svg className="size-5" aria-hidden="true">
                      <use href="#i-x" />
                    </svg>
                  </button>
                  <h3 className="mb-5 font-mono text-lg font-bold">Edit profile</h3>
                  <form onSubmit={handleSave} className="flex flex-col gap-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-semibold">
                        Display name
                        <input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          maxLength={120}
                          className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold">
                        Email
                        <input
                          value={email}
                          disabled
                          className="rounded-xl border border-input bg-background px-4 py-3 font-normal opacity-60 outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">
                        <span className="flex items-baseline justify-between">
                          Bio<small className="font-normal text-muted-foreground">{bioCount} / 300</small>
                        </span>
                        <textarea
                          value={bio}
                          onChange={(e) => {
                            setBio(e.target.value);
                            setBioCount(e.target.value.length);
                          }}
                          rows={3}
                          maxLength={300}
                          placeholder="A short line about you — shown to customers and providers."
                          className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold">
                        Phone
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+234…"
                          className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold">
                        WhatsApp number
                        <input
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          placeholder="+234…"
                          className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </label>
                      <fieldset className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">
                        <legend className="mb-1">Preferred contact method</legend>
                        <div className="flex flex-wrap gap-3">
                          {[
                            ["PHONE", "Phone"],
                            ["WHATSAPP", "WhatsApp"],
                            ["EMAIL", "Email"],
                            ["", "No preference"],
                          ].map(([value, label]) => (
                            <label
                              key={label}
                              className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal"
                            >
                              <input
                                type="radio"
                                name="contactMethod"
                                value={value}
                                checked={contactMethod === value}
                                onChange={() => setContactMethod(value)}
                              />{" "}
                              {label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div className="sm:col-span-2">
                        <p className="text-sm font-semibold">Social handles</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <input
                            value={instagram}
                            onChange={(e) => setInstagram(e.target.value)}
                            placeholder="Instagram"
                            className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                          />
                          <input
                            value={facebook}
                            onChange={(e) => setFacebook(e.target.value)}
                            placeholder="Facebook"
                            className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                          />
                          <input
                            value={twitter}
                            onChange={(e) => setTwitter(e.target.value)}
                            placeholder="Twitter / X"
                            className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                          />
                          <input
                            value={tiktok}
                            onChange={(e) => setTiktok(e.target.value)}
                            placeholder="TikTok"
                            className="rounded-xl border border-input bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:opacity-90 sm:col-span-2"
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            {/* Account */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <svg className="size-5" aria-hidden="true">
                      <use href="#i-lock-keyhole" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Password &amp; security</p>
                    <p className="text-xs text-muted-foreground">
                      Change your password or manage your session
                    </p>
                  </div>
                </div>
                <Link
                  href="/settings"
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary"
                >
                  Account settings
                </Link>
              </div>
            </div>

            {/* My Businesses */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-1 font-mono text-lg font-bold">My businesses</h3>
              <p className="mb-5 text-sm text-muted-foreground">
                Everything you own, at a glance.
              </p>
              <div>
                {businesses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      You have no businesses yet.
                    </p>
                    <Link
                      href="/owner/business-form"
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
                    >
                      <svg className="size-4" aria-hidden="true">
                        <use href="#i-plus" />
                      </svg>
                      Create your first business
                    </Link>
                  </div>
                ) : (
                  businesses.map((b) => (
                    <div
                      key={b.id}
                      className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-background p-5 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{b.name}</p>
                          {statusBadge(b.status, b.moderationNote)}
                          {b.isFeatured ? (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                              <svg className="size-3" aria-hidden="true">
                                <use href="#i-star" />
                              </svg>
                              Featured
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Link
                        href={`/owner/business-form?id=${b.id}`}
                        className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary"
                      >
                        Manage listing
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </AccountShell>
    </main>
    </RequireAuth>
  );
}
