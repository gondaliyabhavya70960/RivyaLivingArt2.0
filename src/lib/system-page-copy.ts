import { getTranslations } from "next-intl/server";

import type { SystemPageProps } from "@/components/storefront/system-page";
import { defaultLocale } from "@/i18n/config";
import { SITE } from "@/lib/constants";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";

/**
 * The bits of a §2.10 system page that are identical on every one of them:
 * the WhatsApp · Home · Shop footer strip, and the cosmetic reference code.
 *
 * Six pages need both. Written once here rather than six times, because the
 * footer strip's whole value is that a visitor who hits two of these in a row
 * finds the way out in the same place both times — and three hand-copied
 * `<li>`s across six files is three chances for one of them to drift.
 */

/**
 * `ERR-<route>-<4 hex>` · §2.10.
 *
 * COSMETIC, and the doc comment says so because the code itself cannot. There
 * is no logging sink in this project that can resolve one, so this is a string
 * a person can read out in a WhatsApp message and nothing more.
 *
 * It is deliberately NOT derived from anything — not the request, not a trace
 * id, not a hash of the error. A code that LOOKS like a correlation id but
 * resolves to nothing wastes the single exchange where the visitor is still
 * willing to talk to us: they quote it, support searches for it, support finds
 * nothing, and now two people are confused instead of one. Random makes the
 * same promise honestly — "quote this so we know which report is yours".
 *
 * `Math.random` is correct here for the same reason: there is nothing to
 * collide with and nothing to guess.
 */
export function referenceCode(route: string): string {
  const suffix = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0")
    .toUpperCase();
  return `ERR-${route.toUpperCase()}-${suffix}`;
}

/**
 * The footer strip, localized. `whatsappNumber` comes from the caller when it
 * has one — a system page must not read Site Settings, since the reason it is
 * rendering may be that the database is what failed, so `SITE.whatsappNumber`
 * (the compiled-in constant) is the floor rather than a fallback of last
 * resort.
 */
export async function systemPageFooter(
  locale: string,
): Promise<SystemPageProps["footer"]> {
  const [t, tCommon, tWa] = await Promise.all([
    getTranslations({ locale, namespace: "SystemPages" }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "WhatsApp" }),
  ]);

  return {
    whatsapp: {
      label: t("whatsapp"),
      href: buildWaLink(
        defaultWaGreeting(tWa("greeting")),
        SITE.whatsappNumber,
      ),
      external: true,
      externalHint: tCommon("openInNewTab"),
      waSource: "system_page",
    },
    // Locale-prefixed by hand rather than through `@/i18n/navigation`'s Link:
    // these render at interrupt and error boundaries where the router's own
    // state may be the broken thing, so every way out of this family is a
    // plain <a> and a full document load. `localePath` below does the
    // `as-needed` prefixing the intl Link would otherwise have done.
    home: { label: t("home"), href: localePath(locale, "/") },
    shop: { label: t("shop"), href: localePath(locale, "/shop") },
  };
}

/**
 * `localePrefix: "as-needed"` prefixing, by hand.
 *
 * Every link out of this page family is a plain `<a>` rather than the intl
 * `Link` (see the footer above for why), so the prefixing the router would
 * have done has to happen here. `as-needed` means the DEFAULT locale carries
 * no prefix at all — `/shop`, not `/en/shop` — and the default is read from
 * `i18n/config` rather than written as "en", so a future change of default
 * locale does not leave this file quietly building dead URLs.
 */
export function localePath(locale: string, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}
