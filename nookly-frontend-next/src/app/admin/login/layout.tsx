import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin portal — Nookly",
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({ children }: LayoutProps<"/admin/login">) {
  return children;
}
