import type { Metadata } from "next";
import AdminLoginForm from "@/components/AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin portal — Nookly",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminLoginForm />;
}
