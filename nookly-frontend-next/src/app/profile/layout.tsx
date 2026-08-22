import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your profile — Nookly",
};

export default function ProfileLayout({ children }: LayoutProps<"/profile">) {
  return children;
}
