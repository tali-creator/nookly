import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages — Nookly",
};

export default function MessagesLayout({ children }: LayoutProps<"/owner/messages">) {
  return children;
}
