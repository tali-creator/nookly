import Link from "next/link";

export const metadata = { title: "Offline — Nookly" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-mono text-3xl font-extrabold text-primary-deep">nookly</p>
      <h1 className="mt-5 font-mono text-2xl font-bold">You&rsquo;re offline</h1>
      <p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">
        Check your connection and try again. Pages you&rsquo;ve already visited stay
        available in the meantime.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
      >
        Back to Nookly
      </Link>
    </main>
  );
}
