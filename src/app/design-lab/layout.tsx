import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";

import "../globals.css";
import { instrumentSerif, inter, jetbrainsMono } from "@/app/fonts";

export const metadata: Metadata = {
  title: "ResinRiva Design Lab",
  robots: { index: false, follow: false },
};

/**
 * Dev-only root for the Phase 1 kitchen sink (DESIGN.md E6 Phase 1). Its own
 * <html> root so the v2.0 library renders on the Midnight Gild LIGHT canvas
 * (ivory :root tokens) without the v7 `dark` class or site chrome. Excluded
 * from locale routing in src/middleware.ts; the page 404s in production.
 */
export default function DesignLabLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-mineral font-body text-ink">
        {/* Bare intl context (locale only, no messages): the lab sits outside
            the [locale] tree but ProductCard's next-intl Link hydrates with
            useLocale. */}
        <NextIntlClientProvider locale="en" messages={{}}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
