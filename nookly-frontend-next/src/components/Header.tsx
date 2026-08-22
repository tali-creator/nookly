"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUser, signOut } from "@/lib/auth";
import type { User } from "@/lib/types";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
            N
          </span>
          Nookly
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="hidden text-muted-foreground sm:inline">
                {user.name || user.email}
              </span>
              <button
                onClick={() => signOut("/")}
                className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-muted"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl px-4 py-2 font-semibold hover:bg-muted"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
