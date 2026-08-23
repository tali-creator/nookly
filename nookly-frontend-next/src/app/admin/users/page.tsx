"use client";

/* Admin users directory — ported 1:1 from nookly-frontend/admin/users.html. */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MarketplaceShell from "@/components/MarketplaceShell";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { clearSession, ensureSeedFromQuery, getToken, getUser } from "@/lib/auth";
import type { AdminUserDetail, AdminUserListResponse, AdminUserRow } from "@/lib/types";

const KYC_STYLES: Record<string, string> = {
  NOT_SUBMITTED: "bg-muted text-muted-foreground",
  PENDING: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-primary/15 text-primary",
  REJECTED: "bg-red-100 text-red-700",
};

const BIZ_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-primary/15 text-primary",
  REJECTED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-muted text-muted-foreground",
};

function roleLabel(role: string): string {
  return role === "ADMIN" ? "Admin" : role === "BUSINESS_OWNER" ? "Owner" : role;
}

const TABS = [
  { label: "All", role: "", kyc: "", deleted: "false" },
  { label: "Owners", role: "BUSINESS_OWNER", kyc: "", deleted: "false" },
  { label: "Admins", role: "ADMIN", kyc: "", deleted: "false" },
  { label: "Verified", role: "BUSINESS_OWNER", kyc: "VERIFIED", deleted: "false" },
  { label: "KYC pending", role: "BUSINESS_OWNER", kyc: "PENDING", deleted: "false" },
  { label: "No KYC", role: "BUSINESS_OWNER", kyc: "NOT_SUBMITTED", deleted: "false" },
  { label: "Archived", role: "", kyc: "", deleted: "true" },
];

const QUEUE_MESSAGE =
  "rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground";

export default function AdminUsersPage() {
  const router = useRouter();
  const [tab, setTab] = useState(TABS[0]);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageLimit = 10;
  const [list, setList] = useState<{
    items?: AdminUserRow[];
    total?: number;
    error?: string;
  } | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [message, setMessage] = useState("");

  /* Create/edit modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [fEmail, setFEmail] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fDisplayName, setFDisplayName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fRole, setFRole] = useState("BUSINESS_OWNER");
  const [formMessage, setFormMessage] = useState("");

  function buildQuery(p: number): string {
    const params = new URLSearchParams({ page: String(p), limit: String(pageLimit), deleted: tab.deleted });
    if (tab.role) params.set("role", tab.role);
    if (tab.kyc) params.set("kycStatus", tab.kyc);
    if (q) params.set("q", q);
    return params.toString();
  }

  const loadUsers = useCallback(
    async (p: number) => {
      setList(null);
      try {
        const { data } = await apiGet<AdminUserListResponse>("/admin/users?" + buildQuery(p));
        setList({ items: data.data || [], total: data.total || 0 });
      } catch (err) {
        setList({ error: err instanceof Error ? err.message : "" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildQuery reads the current filter state
    [tab, q]
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadUsers() resets to the loading state synchronously
    loadUsers(1);
  }, [router, loadUsers]);

  function switchTab(t: (typeof TABS)[number]) {
    setTab(t);
    setSearchInput("");
    setQ("");
    setPage(1);
    loadUsers(1);
  }

  function submitSearch() {
    setQ(searchInput.trim());
    setPage(1);
    loadUsersWithQ(searchInput.trim(), 1);
  }

  async function loadUsersWithQ(query: string, p: number) {
    setList(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(pageLimit), deleted: tab.deleted });
      if (tab.role) params.set("role", tab.role);
      if (tab.kyc) params.set("kycStatus", tab.kyc);
      if (query) params.set("q", query);
      const { data } = await apiGet<AdminUserListResponse>("/admin/users?" + params.toString());
      setList({ items: data.data || [], total: data.total || 0 });
    } catch (err) {
      setList({ error: err instanceof Error ? err.message : "" });
    }
  }

  function closeDetail() {
    setDetail(null);
    loadUsers(page);
  }

  async function openDetail(userId: string) {
    try {
      const { data } = await apiGet<{ user: AdminUserDetail }>("/admin/users/" + userId);
      setDetail(data.user);
    } catch (err) {
      setList({ error: err instanceof Error ? err.message : "" });
    }
  }

  /* ---- modal ---- */
  function showModal(editMode: AdminUserRow | null) {
    setFormMessage("");
    setEditing(editMode);
    setModalOpen(true);
  }

  function hideModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function openCreate() {
    setFEmail("");
    setFPassword("");
    setFDisplayName("");
    setFPhone("");
    setFRole("BUSINESS_OWNER");
    showModal(null);
  }

  function openEdit(u: AdminUserRow) {
    setFEmail(u.email);
    setFDisplayName(u.displayName || "");
    setFPhone(u.phone || "");
    setFRole(u.role);
    showModal(u);
  }

  async function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMessage("");
    try {
      if (editing) {
        await apiPatch("/admin/users/" + editing.id, {
          displayName: fDisplayName.trim() || null,
          phone: fPhone.trim() || null,
          role: fRole,
        });
        setMessage("User updated.");
      } else {
        await apiPost("/admin/users", {
          email: fEmail.trim(),
          password: fPassword,
          role: fRole,
          displayName: fDisplayName.trim() || undefined,
          phone: fPhone.trim() || undefined,
        });
        setMessage("User created. Share the temporary password securely.");
      }
      hideModal();
      loadUsers(page);
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function archiveUser(u: { id: string; email: string }) {
    if (
      !window.confirm(
        "Archive " +
          u.email +
          "? They will be locked out and hidden from the directory. This can be undone with Restore."
      )
    )
      return;
    try {
      await apiDelete("/admin/users/" + u.id);
      setMessage("User archived.");
      loadUsers(page);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Archive failed");
    }
  }

  async function restoreUser(u: { id: string; email: string }) {
    if (!window.confirm("Restore " + u.email + "? They will regain access and reappear in the directory."))
      return;
    try {
      await apiPost("/admin/users/" + u.id + "/restore");
      setMessage("User restored.");
      loadUsers(page);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Restore failed");
    }
  }

  const pages = list?.total !== undefined ? Math.max(1, Math.ceil(list.total / pageLimit)) : 1;

  return (
    <MarketplaceShell active="users" sidebar="admin">
      <section>
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Admin console
          </p>
          <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">Registered users</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Browse every account on Nookly — owners and admins. Open a user to see their businesses
            and KYC status.
          </p>
        </div>
        {message ? (
          <p className="mb-6 rounded-xl bg-red-50 p-3 text-sm text-red-600">{message}</p>
        ) : null}

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => switchTab(t)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    t.label === tab.label
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <input
                  id="search-input"
                  type="search"
                  placeholder="Search email or name…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitSearch();
                  }}
                  style={{ flex: 1 }}
                  className="min-w-0 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={submitSearch}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
                >
                  Search
                </button>
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:border-primary hover:text-primary"
              >
                + New user
              </button>
            </div>
          </div>

          {detail ? (
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-mono text-xl font-bold">{detail.displayName || "—"}</h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        KYC_STYLES[detail.kycStatus] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {detail.kycStatus.replace("_", " ")}
                    </span>
                    {detail.deletedAt ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                        Archived
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{detail.email}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
                  >
                    &larr; Back to list
                  </button>
                  {detail.deletedAt ? (
                    <button
                      type="button"
                      onClick={() => restoreUser(detail)}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => archiveUser(detail)}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-red-600 hover:border-red-600"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
              <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="font-semibold">{roleLabel(detail.role)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-semibold">{detail.phone || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">KYC status</dt>
                  <dd className="font-semibold">{detail.kycStatus.replace("_", " ")}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Businesses</dt>
                  <dd className="font-semibold">{detail.businessCount}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Joined</dt>
                  <dd className="font-semibold">{new Date(detail.createdAt).toLocaleString()}</dd>
                </div>
                {detail.deletedAt ? (
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Archived</dt>
                    <dd className="font-semibold text-red-600">
                      {new Date(detail.deletedAt).toLocaleString()}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {detail.role === "BUSINESS_OWNER" ? (
                <>
                  <div className="mt-6">
                    <h3 className="font-mono text-lg font-bold">Businesses</h3>
                    <div className="mt-3 flex flex-col gap-2">
                      {detail.businesses?.length ? (
                        detail.businesses.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 text-sm"
                          >
                            <span className="font-semibold">{b.name}</span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                BIZ_STATUS_STYLES[b.status] || "bg-muted text-muted-foreground"
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          This owner has no businesses yet.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-6">
                    <Link
                      href="/admin/kyc-review"
                      className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                    >
                      Review {(detail.kycStatus || "KYC").toLowerCase()} documents →
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div id="user-list" className="flex flex-col gap-3">
              {list === null ? (
                <div className={QUEUE_MESSAGE}>Loading…</div>
              ) : list.error !== undefined ? (
                <div className={QUEUE_MESSAGE}>Could not load users. {list.error}</div>
              ) : !list.items?.length ? (
                <div className={QUEUE_MESSAGE}>No users match that filter.</div>
              ) : (
                list.items.map((u) => {
                  const archived = tab.deleted === "true";
                  return (
                    <div key={u.id} className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-mono text-xl font-bold">{u.displayName || "—"}</h3>
                            {archived ? (
                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                                Archived
                              </span>
                            ) : null}
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                KYC_STYLES[u.kycStatus] || "bg-muted text-muted-foreground"
                              }`}
                            >
                              {u.kycStatus.replace("_", " ")}
                            </span>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                              {roleLabel(u.role)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {u.email} · joined {new Date(u.createdAt).toLocaleDateString()} ·{" "}
                            {u.businessCount} business{u.businessCount === 1 ? "" : "es"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openDetail(u.id)}
                            className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:border-primary"
                          >
                            View
                          </button>
                          {!archived ? (
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:border-primary"
                            >
                              Edit
                            </button>
                          ) : null}
                          {!archived ? (
                            <button
                              type="button"
                              onClick={() => archiveUser(u)}
                              className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-red-600 hover:border-red-600"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => restoreUser(u)}
                              className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {detail === null && list?.items?.length && !list.error ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {list.total} user{list.total === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (page <= 1) return;
                    const p = page - 1;
                    setPage(p);
                    loadUsers(p);
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
                    loadUsers(p);
                  }}
                  disabled={page >= pages}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* user-modal */}
        <div
          className={`fixed inset-0 z-50 ${
            modalOpen ? "flex" : "hidden"
          } items-center justify-center bg-black/50 p-4`}
          onClick={(e) => {
            if (e.target === e.currentTarget) hideModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xl font-bold">{editing ? "Edit user" : "New user"}</h2>
              <button
                type="button"
                onClick={hideModal}
                className="rounded-lg p-1 hover:bg-muted"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <form onSubmit={onFormSubmit} className="mt-5 flex flex-col gap-4">
              <input type="hidden" />
              <div>
                <label htmlFor="f-email" className="mb-1 block text-sm font-semibold">
                  Email
                </label>
                <input
                  id="f-email"
                  type="email"
                  required
                  disabled={!!editing}
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {!editing ? (
                <div>
                  <label htmlFor="f-password" className="mb-1 block text-sm font-semibold">
                    Temporary password
                  </label>
                  <input
                    id="f-password"
                    type="password"
                    minLength={8}
                    value={fPassword}
                    onChange={(e) => setFPassword(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="f-display-name" className="mb-1 block text-sm font-semibold">
                    Display name
                  </label>
                  <input
                    id="f-display-name"
                    type="text"
                    value={fDisplayName}
                    onChange={(e) => setFDisplayName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="f-phone" className="mb-1 block text-sm font-semibold">
                    Phone
                  </label>
                  <input
                    id="f-phone"
                    type="text"
                    value={fPhone}
                    onChange={(e) => setFPhone(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="f-role" className="mb-1 block text-sm font-semibold">
                  Role
                </label>
                <select
                  id="f-role"
                  value={fRole}
                  onChange={(e) => setFRole(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="BUSINESS_OWNER">Business owner</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {formMessage ? (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{formMessage}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={hideModal}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  {editing ? "Save changes" : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </MarketplaceShell>
  );
}
