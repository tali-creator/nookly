import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Owner dashboard — Nookly",
};

export default function OwnerDashboardLayout({
  children,
}: LayoutProps<"/owner/dashboard">) {
  return children;
}
