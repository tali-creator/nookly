import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KYC review — Nookly",
};

export default function AdminKycReviewLayout({ children }: LayoutProps<"/admin/kyc-review">) {
  return children;
}
