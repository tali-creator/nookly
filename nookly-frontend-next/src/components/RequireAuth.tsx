"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

/* Client-side route guard. Renders a tiny spinner until mounted, then redirects
   unauthenticated visitors to /login. Keeps gated pages (dashboard, account,
   notifications) away from guests: visiting the URL without a session bounces
   to /login instead of rendering a guest view. */
export default function RequireAuth({
  children,
  redirectTo = "/login",
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (getUser()) {
      setAllowed(true);
    } else {
      router.replace(redirectTo);
    }
    setChecked(true);
  }, [router, redirectTo]);

  if (!checked || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }

  return <>{children}</>;
}
