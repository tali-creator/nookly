import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moderation dashboard — Nookly",
};

export default function AdminDashboardLayout({ children }: LayoutProps<"/admin/dashboard">) {
  return children;
}
