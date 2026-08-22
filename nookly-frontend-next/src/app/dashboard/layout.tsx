import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Nookly",
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return children;
}
