import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { SystemPage } from "@/components/storefront/system-page";
import { RetryCountdown } from "@/components/storefront/retry-countdown";
import { routing } from "@/i18n/routing";
import { LOGIN_WINDOW_MS } from "@/lib/auth-limits";
import { systemPageFooter } from "@/lib/system-page-copy";

/**
 * 429 · rate limited — §2.10.
 *
 * ## The only page in the family with no primary action
 *
 * §2.10's copy table gives this row "— (countdown only)" where every other row
 * has a CTA, and that is the design rather than an omission: the one thing a
 * rate-limited visitor must not be handed is a button that makes another
 * request. The countdown is the content. WhatsApp stays as a text secondary,
 * because a person who is being throttled by a machine should still be able to
 * reach a human.
 *
 * ## The window is READ, never restated
 *
 * `LOGIN_WINDOW_MS` comes from the same module the limiter itself uses. The
 * numbers — 5 per email, 15 per IP, 15 minutes — are already built
 * (`src/lib/auth.ts`, `src/lib/rate-limit.ts`); three of the four briefs
 * merged into this work proposed "adding" them. Restating `15` here would
 * create a second source of truth for a number whose whole job is to match
 * what the server will actually do, and the failure mode is silent: the page
 * says "try again in 15 minutes", the limiter has been changed to 30, and the
 * visitor is told a lie by a component that has no way to know.
 *
 * `?retry=` (seconds) overrides it when a caller knows the real remaining
 * time — `Retry-After` from the response that redirected here. Clamped, and
 * clamped for a reason: it is a query parameter, so it is visitor input, and
 * an unclamped one is a page that can be made to count down from a year.
 *
 * ## WHAT ROUTES A VISITOR HERE — and what deliberately does not (2026-09-19)
 *
 * Nothing inside the app navigates to this page, and that is the decision
 * rather than a missing wire.
 *
 * Every limiter this project runs guards a FORM or an API call, not a page
 * view: the contact, subscribe and order actions answer in place, the Studio
 * login shows its own countdown, `/api/upload` returns a 429 whose body names
 * the wait, and `/api/form-token` returns a bare 429. Sending any of those to
 * a full-page interstitial would throw away a filled-in form to say something
 * the form could say in a line — and on the order path that form is the whole
 * business.
 *
 * Adding an app-level limiter on NAVIGATION to create a producer would be
 * worse than having none. The in-memory limiter is per-instance and keyed on
 * the first `x-forwarded-for` hop, so behind a school, an office or mobile
 * CGNAT one visitor's browsing throttles everyone on that address, and the
 * failure is invisible from here — they simply meet a wall. That is also a
 * behaviour change, not a visual one (§1.1).
 *
 * So the producer is the EDGE, where the numbers are per-visitor and the
 * decision is the platform's: Vercel Firewall rate-limit rules can be pointed
 * at `/too-many-requests`, and `src/proxy.ts` already turns the response into
 * a real 429 rather than a 200 that looks like one. DEPLOYMENT.md §12 records
 * how. Until such a rule exists the page is reachable, localized, audited and
 * unused — which is the correct state for an error page.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** An hour. Nothing in this project throttles for longer. */
const MAX_RETRY_SECONDS = 3600;

export default async function TooManyRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ retry?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { retry } = await searchParams;

  const [t, footer] = await Promise.all([
    getTranslations({ locale, namespace: "SystemPages" }),
    systemPageFooter(locale),
  ]);

  const parsed = Number.parseInt(retry ?? "", 10);
  const seconds =
    Number.isFinite(parsed) && parsed > 0
      ? Math.min(parsed, MAX_RETRY_SECONDS)
      : Math.round(LOGIN_WINDOW_MS / 1000);

  return (
    <SystemPage
      eyebrow={t("tooMany.eyebrow")}
      statement={t("tooMany.statement")}
      support={t("tooMany.support")}
      secondaries={[footer.whatsapp]}
      footer={footer}
    >
      <RetryCountdown
        seconds={seconds}
        label={t("tooMany.countdownLabel")}
        readyLabel={t("tooMany.countdownReady")}
      />
    </SystemPage>
  );
}
