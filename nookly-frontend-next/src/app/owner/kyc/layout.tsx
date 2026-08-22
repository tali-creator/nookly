import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Owner verification — Nookly",
};

export default function KycLayout({ children }: LayoutProps<"/owner/kyc">) {
  return children;
}
