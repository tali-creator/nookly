import Link from "next/link";
import type { ReactNode } from "react";

// Shared shell for all auth screens — mirrors the original login/signup card.
// The admin portal page uses its own spacing/logo markup (py-10, gap-2,
// mono anchor) per the original admin/login.html.
export default function AuthShell({
  children,
  variant = "customer",
}: {
  children: ReactNode;
  variant?: "customer" | "admin";
}) {
  const isAdmin = variant === "admin";
  return (
    <main
      className={`flex min-h-screen items-center justify-center bg-background px-5 ${
        isAdmin ? "py-10" : "py-12"
      }`}
    >
      <div className="w-full max-w-md">
        {isAdmin ? (
          <Link
            href="/"
            className="mb-10 flex items-center justify-center gap-2 font-mono text-xl font-bold"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg className="size-5" aria-hidden="true">
                <use href="#i-sparkles" />
              </svg>
            </span>
            nookly
          </Link>
        ) : (
          <Link href="/" className="mb-10 flex items-center justify-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg className="size-5" aria-hidden="true">
                <use href="#i-sparkles" />
              </svg>
            </span>
            <span className="font-mono text-xl font-bold">nookly</span>
          </Link>
        )}
        {children}
      </div>
    </main>
  );
}
