import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { ViewTransitions } from "next-view-transitions";

import "../globals.css";
import { instrumentSerif, inter, jetbrainsMono } from "@/app/fonts";
import { requireStaffPage } from "@/actions/helpers";
import enMessages from "../../../messages/en.json";

export const metadata: Metadata = {
  title: "Rivya Living Art Design Lab",
  robots: { index: false, follow: false },
};

/**
 * Design lab root — REDESIGN.md's staff-only review surface for the live v3
 * storefront primitives (D17). Its own `<html>` root so the page renders on
 * the real v3 tokens without the site chrome (SiteHeader, AnnouncementBar,
 * etc.) mounted around it. Excluded from locale routing (`src/proxy.ts`);
 * `page.tsx` 404s in production on top of the staff gate below.
 *
 * `requireStaffPage()` runs here AND in `page.tsx` — mock products must
 * never be publicly reachable (HARD RULE 3), and a layout that forgets the
 * check is exactly the kind of gap a future page added under this route
 * could fall through. Belt and suspenders, not redundancy for its own sake.
 *
 * `<ViewTransitions>` wraps the tree because `CatalogProductCard` renders a
 * `MorphLink`, which calls `useTransitionRouter()` — that throws outside the
 * provider `[locale]/layout.tsx` normally supplies.
 */
export default async function DesignLabLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireStaffPage();

  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-mineral font-body text-ink">
        {/* Bare intl context (locale + the full English catalogue): the lab
            sits outside the [locale] tree, but several live primitives call
            useTranslations/getTranslations (CatalogProductCard, RatingStars,
            WishlistButton) and need real strings to resolve, not {}. */}
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <ViewTransitions>{children}</ViewTransitions>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
