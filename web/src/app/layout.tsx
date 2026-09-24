import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { JapaneseFont } from "@/components/layout/JapaneseFont";
import { HeaderHeight } from "@/components/layout/HeaderHeight";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { UserDocProvider } from "@/components/auth/useUserDoc";
import { ThemeScript } from "@/components/layout/ThemeToggle";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Noto Sans JP is loaded asynchronously by <JapaneseFont /> (see that file for why); --font-jp is set in globals.css.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description:
    "A complete Japanese course and JLPT preparation from your first kana to N1: grammar, vocabulary, kanji, reading and listening, with a daily study plan.",
  openGraph: { siteName: SITE_NAME, type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f13" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <JapaneseFont />
      </head>
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-3 focus:left-3 focus:bg-surface focus:px-3 focus:py-2 focus:rounded-lg focus:shadow-md">
          Skip to content
        </a>
        <JsonLd data={[organizationJsonLd(), websiteJsonLd(SITE_TAGLINE)]} />
        <AuthProvider>
          <UserDocProvider>
            <SiteHeader />
            <HeaderHeight />
            {/* "Skip to content" jumps here, so it needs to clear the sticky header. */}
            <main id="main" className="flex-1 scroll-mt-[calc(var(--header-h,4rem)+0.5rem)]">
              {children}
            </main>
            <SiteFooter />
          </UserDocProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
