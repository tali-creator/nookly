import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Users — Nookly admin",
};

export default function AdminUsersLayout({ children }: LayoutProps<"/admin/users">) {
  return children;
}
