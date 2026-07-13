import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "@/providers";
import { RegisterSW } from "@/features/pwa/RegisterSW";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Bolão dos Parças",
  description: "Prognósticos da Copa do Mundo 2026",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Bolão",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon-180.png",
  },
};

export const viewport: Viewport = {
  // dark-theme TASK-04: barra do navegador (PWA) acompanha o esquema do SO —
  // claro (#fff, = --background light) ou escuro (#1f1f1f, ≈ --background dark),
  // em vez de forçar sempre o tom escuro.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1f1f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body>
        <RegisterSW />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
