"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/storefront/error-state";
import { SITE } from "@/lib/constants";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";

/**
 * The 500 — REDESIGN.md §11.11:
 *
 * > "**Something went wrong.** Please try again. + retry + WhatsApp + a mono
 * > reference code."
 *
 * Which is exactly `ErrorState` (§4.6), so this boundary is a frame around it
 * rather than a second implementation of the same four elements. Three things
 * the frame is responsible for:
 *
 * 1. **The reference code is the digest, not the message.** Nothing technical
 *    reaches the reader — `ErrorState` has no prop that could carry a stack —
 *    but `error.digest` is the string a person can quote back to us, so it is
 *    rendered mono and `select-all`. The real error goes to the console.
 * 2. **WhatsApp is not decoration.** Part 0 makes WhatsApp the only way an
 *    order finishes, so a failed page is a lost commission unless the
 *    conversation can continue somewhere else. The link is built from the
 *    `SITE` constant rather than Site Settings: this boundary must not touch
 *    the database, which may be the very thing that failed.
 * 3. **The heading is the page's `h1`.** A boundary replaces the page, so
 *    there is no other one (Part 17).
 *
 * It renders OUTSIDE the `(v2)` route group — no header, no footer — so the
 * retry action and the WhatsApp escape hatch are the whole way out. Copy is
 * translated: this boundary sits inside `[locale]/layout.tsx`, so the message
 * provider is mounted. A failure in the layout itself is caught upstream by
 * `global-error`, which is the boundary that must survive with no context.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorPage");
  const tCommon = useTranslations("Common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  const waHref = buildWaLink(defaultWaGreeting(), SITE.whatsappNumber);

  return (
    /* The route-group split moved <main id="main-content"> into the group
       layouts, which do not wrap this boundary — provide the skip-link target
       here so the root layout's anchor never dangles. */
    <main id="main-content" className="flex-1">
      <section
        data-theme="navy"
        className="relative flex min-h-svh items-center overflow-hidden bg-obsidian text-mineral"
      >
        {/* The §2.10 backdrop — resin flow, held low. The 404 next door runs
            its vortex at 70% because the picture IS the page there; here the
            page is a recovery instruction and the texture is only meant to
            stop an obsidian rectangle reading as a crash. 20% over obsidian
            leaves mineral text an order of magnitude above 4.5:1, which is
            what lets this ship without a veil the 404 needed.

            Bundled, `priority`, and the only asset on the page: an error
            boundary renders when something already failed, so nothing here
            may wait on a second network. */}
        <Image
          aria-hidden
          src="/redesign/texture-resin-flow.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          quality={60}
          className="pointer-events-none object-cover opacity-20"
        />
        <div className="relative z-10 u-shell py-24">
          <ErrorState
            headingLevel="h1"
            eyebrow={t("eyebrow")}
            statement={t("heading")}
            reassurance={t("body")}
            retryLabel={t("retry")}
            onRetry={reset}
            whatsappHref={waHref}
            whatsappLabel={t("whatsapp")}
            whatsappNewTabLabel={tCommon("openInNewTab")}
            reference={
              error.digest
                ? `${t("referenceLabel")} ${error.digest}`
                : undefined
            }
          />
        </div>
      </section>
    </main>
  );
}
