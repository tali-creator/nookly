import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications — Nookly",
};

export default function NotificationsLayout({
  children,
}: LayoutProps<"/notifications">) {
  return children;
}
