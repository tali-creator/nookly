import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your favorites — Nookly",
};

export default function FavoritesLayout({ children }: LayoutProps<"/favorites">) {
  return children;
}
