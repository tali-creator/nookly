import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import IconSprite from "@/components/IconSprite";
import PWAInstall from "@/components/PWAInstall";
import { AuthGateProvider } from "@/components/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nookly — Get more done. Live a little.",
  description:
    "Find trusted local pros for the things on your to-do list.",
  applicationName: "Nookly",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nookly",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#5A8000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <IconSprite />
        <AuthGateProvider>{children}</AuthGateProvider>
        <PWAInstall />
      </body>
    </html>
  );
}
