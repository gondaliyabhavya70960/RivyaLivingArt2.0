import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { CureLoop } from "@/components/storefront/cure-loop";
import { NewsletterSignup } from "@/components/storefront/newsletter-signup";
import { SystemPage } from "@/components/storefront/system-page";
import { routing } from "@/i18n/routing";
import { systemPageFooter } from "@/lib/system-page-copy";

/**
 * Maintenance — §2.10, served with a real **503 + Retry-After** by
 * `src/proxy.ts` when `MAINTENANCE_MODE` is set.
 *
 * ## An env flag, not a database column (owner decision 7)
 *
 * The reason is the failure it has to survive: the most likely thing to be
 * maintained IS the database, and a switch stored in the thing that is down
 * cannot turn itself on. `MAINTENANCE_MODE` is read in middleware, at the
 * edge, before any query runs.
 *
 * ## `/studio` and `/api` are exempt, and that is the point
 *
 * The owner has to be able to sign in and fix whatever they took the site down
 * for. A maintenance page that also locks out the person doing the maintenance
 * is a page that has to be undeployed to be useful.
 *
 * ## Why this page reads NOTHING
 *
 * No Site Settings, no catalogue, no site-image slot, no remote host. It is
 * rendered at the one moment those are least likely to answer, so it composes
 * from the bundled text and the compiled-in WhatsApp constant only — a
 * maintenance page that 500s is worse than no maintenance page, because the
 * visitor cannot tell it from the outage.
 *
 * ## The notify-me field is the EXISTING subscribers feature
 *
 * §2.10 asks for one and the repo already has it, wired to a Server Action
 * that writes a `Subscriber` row. It is reused rather than rebuilt — and it is
 * also the one thing here that can fail while the site is down, which is fine:
 * it fails as a form, in place, with its own error state, and the page around
 * it stays readable.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function MaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, footer] = await Promise.all([
    getTranslations({ locale, namespace: "SystemPages" }),
    systemPageFooter(locale),
  ]);

  return (
    <SystemPage
      eyebrow={t("maintenance.eyebrow")}
      statement={t("maintenance.statement")}
      support={t("maintenance.support")}
      primary={{ ...footer.whatsapp, label: t("maintenance.primary") }}
      footer={footer}
      atmosphere={{ src: "/redesign/texture-resin-flow.jpg", opacity: 0.25 }}
    >
      {/* §2.10's cure loop. It sits ABOVE the field rather than beside the
          statement: the line is the answer to "how long", and putting it next
          to the one control on the page keeps that question and its only
          honest reply — leave an address — in the same glance. */}
      <CureLoop className="mb-8" />
      {/* `source` is stored on the Subscriber row, so the owner can see which
          of these addresses arrived while the site was down. The component
          reads its own copy from the `Newsletter` namespace — it is the ONE
          newsletter implementation (see its header), and handing it strings
          from here would have been a second set of labels for one form. */}
      <NewsletterSignup source="maintenance" />
    </SystemPage>
  );
}
