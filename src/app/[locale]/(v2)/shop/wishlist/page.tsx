import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { WishlistPanel } from "@/components/shop/wishlist-panel";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { SectionHeading } from "@/components/storefront/section-heading";
import { localeCanonical } from "@/i18n/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Wishlist.meta" });
  return {
    title: t("title"),
    description: t("description"),
    // Device-personal page (localStorage content) — never indexable, but
    // crawlers may follow through to the real product pages. Canonical-only,
    // matching /search (SEO-511).
    robots: { index: false, follow: true },
    alternates: localeCanonical("/shop/wishlist", locale),
  };
}

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Wishlist");
  const tNav = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");

  return (
    /* A working page in the shop's register (§7.1): a compact hero with the
       breadcrumb and the heading, no hero image, then the saved grid. The
       list lives in the device's localStorage, so the panel is a client
       island; it carries the page's one WhatsApp action, and nothing
       cross-sells beneath it. */
    <div className="u-shell section-compact pb-major">
      <Breadcrumb
        ariaLabel={tCommon("breadcrumb")}
        items={[
          { label: tCommon("home"), href: "/" },
          { label: tNav("shop"), href: "/shop" },
          { label: t("meta.title") },
        ]}
      />

      <SectionHeading
        as="h1"
        size="h1"
        eyebrow={t("heroEyebrow")}
        title={t("heroHeadline")}
        intro={t("heroLead")}
        className="mt-8"
      />

      <div className="mt-12">
        <WishlistPanel />
      </div>
    </div>
  );
}
