import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { THEME_BOOT_SCRIPT } from "@/lib/themeBoot";

const body = Geist({
  variable: "--nf-body",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--nf-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VOX·AI Studio",
  description: "Asisten suara AI: ngobrol, ngoding, bikin dokumen, dan deploy pakai suara.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${body.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
