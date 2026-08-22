"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/* Registers the service worker (production only, so it never interferes with
   the dev server / HMR) and shows a native-feeling "Install Nookly" banner
   when the browser fires `beforeinstallprompt`. On iOS Safari — which never
   fires that event — we fall back to "Add to Home Screen" instructions. */

export default function PWAInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only detection after mount
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    const onInstalled = () => {
      setShow(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-xl">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-deep text-lg font-extrabold text-primary-foreground">
          n
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Get the Nookly app</p>
          <p className="truncate text-xs text-muted-foreground">
            {isIOS
              ? "Tap Share → Add to Home Screen"
              : "Install for a faster, app-like experience"}
          </p>
        </div>
        {!isIOS && deferred ? (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
          >
            Install
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setShow(false)}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
