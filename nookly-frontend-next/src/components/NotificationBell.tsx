"use client";

/* Bell + message-preview dropdown, ported 1:1 from js/notifications.js
   (badge injection, panel markup, mark read/all, socket live updates).
   Used by both header partials — they both carry [data-notif-root]. */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiPatch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/config";
import type { AppNotification } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return min + "m ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h ago";
  const day = Math.floor(hr / 24);
  if (day < 7) return day + "d ago";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function notifIcon(type: string): string {
  const icons: Record<string, string> = {
    BUSINESS_APPROVED: "#i-circle-check",
    BUSINESS_REJECTED: "#i-x-circle",
    BUSINESS_SUSPENDED: "#i-alert-triangle",
    KYC_VERIFIED: "#i-shield-check",
    KYC_REJECTED: "#i-shield-x",
    NEW_MESSAGE: "#i-message-circle",
  };
  return icons[type] || "#i-bell";
}

/* Route a notification to the right page based on its type + payload. */
function notifHref(n: AppNotification): string {
  const data = n.data || {};
  if (n.type === "KYC_VERIFIED" || n.type === "KYC_REJECTED") return "/owner/kyc";
  if (
    n.type === "BUSINESS_APPROVED" ||
    n.type === "BUSINESS_REJECTED" ||
    n.type === "BUSINESS_SUSPENDED"
  ) {
    return data.businessId
      ? "/owner/business-form?id=" + data.businessId
      : "/owner/dashboard";
  }
  if (n.type === "NEW_MESSAGE") {
    return data.businessId
      ? "/owner/messages?businessId=" + data.businessId
      : "/owner/messages";
  }
  return "/notifications";
}

type IoSocket = {
  on: (event: string, cb: (n: AppNotification) => void) => void;
  disconnect?: () => void;
};

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<IoSocket | null>(null);

  const setUnreadCount = useCallback((n: number) => {
    setUnread(Math.max(0, n));
  }, []);

  useEffect(() => {
    function onSet(e: Event) {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number") setUnread(Math.max(0, detail));
    }
    function onDec() {
      setUnread((u) => Math.max(0, u - 1));
    }
    window.addEventListener("nookly:unread", onSet);
    window.addEventListener("nookly:unread-dec", onDec);
    return () => {
      window.removeEventListener("nookly:unread", onSet);
      window.removeEventListener("nookly:unread-dec", onDec);
    };
  }, []);

  async function loadSocketIoClient(): Promise<
    ((url?: string, opts?: unknown) => IoSocket) | null
  > {
    const w = window as unknown as {
      io?: (url?: string, opts?: unknown) => IoSocket;
    };
    if (w.io) return w.io;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = API_BASE_URL + "/socket.io/socket.io.js";
      s.onload = () => resolve(w.io || null);
      s.onerror = () => reject(new Error("Could not load socket.io client"));
      document.head.appendChild(s);
    });
  }

  /* Badge refresh + real-time updates — mirrors refreshBadge() + boot socket.
     Seeded probe sessions set `localStorage.__NOOKLY_NO_SOCKET` in the seed
     helper before navigating here; skip the live socket so a persistent
     connection doesn't keep headless --virtual-time-budget from going idle. */
  useEffect(() => {
    if (!getToken()) return;
    const isProbe =
      typeof window !== "undefined" &&
      (window.localStorage.getItem("__NOOKLY_NO_SOCKET") === "1" ||
        new URLSearchParams(window.location.search).has("_seed_token"));
    apiGet<{ unreadCount: number }>("/notifications/unread-count")
      .then((res) => setUnread(res.data.unreadCount || 0))
      .catch(() => {});

    if (isProbe) return;

    let cancelled = false;
    loadSocketIoClient()
      .then((io) => {
        if (!io || cancelled) return;
        const socket = io(API_BASE_URL, {
          auth: { token: getToken() },
          transports: ["websocket", "polling"],
        });
        socketRef.current = socket;
        socket.on("notification:new", (n: AppNotification) => {
          setUnread((u) => u + 1);
          setItems((prev) => (prev.length ? [n, ...prev].slice(0, 5) : prev));
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* Close on any outside click — mirrors the document listener. */
  useEffect(() => {
    if (!open) return;
    function onDocClick() {
      setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const openPanel = useCallback(async () => {
    try {
      const res = await apiGet<{
        notifications: AppNotification[];
        unreadCount: number;
      }>("/notifications");
      const recent = (res.data.notifications || []).slice(0, 5);
      setItems(recent);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      setItems([]);
    }
  }, [setUnreadCount]);

  function togglePanel(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !open;
    setOpen(next);
    if (next) openPanel();
  }

  function handlePanelClick(e: React.MouseEvent) {
    e.stopPropagation();
  }

  function handleItemClick(n: AppNotification) {
    if (!n.read) {
      apiPatch("/notifications/" + n.id + "/read").catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
  }

  async function markAllRead() {
    try {
      await apiPatch("/notifications/read-all");
      setUnreadCount(0);
      setItems((prev) =>
        prev.map((x) => ({ ...x, read: true }))
      );
      // Marked items dim, mirroring the opacity-60 class added by the original.
      document
        .querySelectorAll("[data-notif-id]")
        .forEach((el) => el.classList.add("opacity-60"));
    } catch {
      /* ignore */
    }
  }

  /* Dev-only probe hook: ?_open_panel=1 renders the dropdown expanded so
     headless dumps can be compared against the original site. */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("_open_panel") && getToken()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      openPanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={togglePanel}
        className="relative block rounded-full p-2.5 text-muted-foreground hover:bg-muted"
        aria-label="Notifications"
      >
        <svg className="size-5" aria-hidden="true">
          <use href="#i-bell" />
        </svg>
        <span
          className={`pointer-events-none absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-white ${
            unread === 0 ? "hidden" : ""
          }`}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      </button>

      <div
        onClick={handlePanelClick}
        className={`absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-lg ${
          open ? "" : "hidden"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-mono text-sm font-bold">Notifications</p>
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-80 divide-y divide-border overflow-y-auto">
          {items.map((n) => (
            <Link
              key={n.id}
              href={notifHref(n)}
              onClick={() => handleItemClick(n)}
              className="flex gap-3 px-4 py-3 text-sm transition hover:bg-muted"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <svg className="size-4" aria-hidden="true">
                  <use href={notifIcon(n.type)} />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{n.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {n.body}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground/70">
                  {timeAgo(n.createdAt)}
                </span>
              </span>
              {!n.read ? (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              ) : null}
            </Link>
          ))}
        </div>
        <div
          className={`px-4 py-6 text-center text-xs text-muted-foreground ${
            items.length === 0 ? "" : "hidden"
          }`}
        >
          You&rsquo;re all caught up.
        </div>
        <Link
          href="/notifications"
          className="flex items-center justify-center gap-1 border-t border-border px-4 py-3 text-sm font-semibold text-primary hover:bg-muted"
        >
          View all notifications
          <svg className="size-4" aria-hidden="true">
            <use href="#i-chevron-right" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
