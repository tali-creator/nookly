import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings — Nookly",
};

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return children;
}
