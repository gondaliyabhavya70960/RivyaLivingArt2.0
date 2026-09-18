import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { SystemPage } from "@/components/storefront/system-page";
import { localePath, systemPageFooter } from "@/lib/system-page-copy";

/**
 * 403 · the public tree's `forbidden()` boundary — §2.10.
 *
 * Next injects `<meta name="robots" content="noindex">` for this boundary
 * itself, and the `robots` block below covers the other half: a crawler that
 * reaches the URL through a link rather than through the interrupt.
 *
 * WHY 403 AND NOT A REDIRECT TO LOGIN. The two states are different questions
 * and want different answers, which is exactly what `requireStaffPage` used to
 * blur — it redirected BOTH "no session" and "wrong role" and so told an
 * EDITOR who opened an ADMIN page nothing at all, at a URL they no longer had.
 *
 *   403 forbidden       you are signed in, and this is not yours
 *                       → the way out is OUT: back to the store
 *   401 / session gone  you were signed in and are not any more
 *                       → the way out is BACK IN: /studio/login
 *
 * So this page offers the exit, and `studio/session-expired` offers the
 * re-auth. Neither renders anything from behind the guard — `forbidden()`
 * unwinds the render, so nothing protected has been composed, let alone sent.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Forbidden() {
  const locale = await getLocale();
  const [t, footer] = await Promise.all([
    getTranslations({ locale, namespace: "SystemPages" }),
    systemPageFooter(locale),
  ]);

  return (
    <SystemPage
      eyebrow={t("forbidden.eyebrow")}
      statement={t("forbidden.statement")}
      support={t("forbidden.support")}
      primary={{
        label: t("forbidden.primary"),
        // NOT locale-prefixed: /studio is English-only and sits outside the
        // [locale] tree entirely. `localePath` here would build /hi/studio,
        // which is a 404.
        href: "/studio/login",
      }}
      secondaries={[
        { label: t("forbidden.secondary"), href: localePath(locale, "/shop") },
      ]}
      footer={footer}
    />
  );
}
