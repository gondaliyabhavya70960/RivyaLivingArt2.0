"use client";

import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";

import { useWaNumber } from "@/components/providers/wa-number-provider";
import { Button } from "@/components/storefront/button";
import { SITE } from "@/lib/constants";
import { buildWaLink } from "@/lib/whatsapp";

/**
 * The card's "Ask on WhatsApp" ghost link (D21). A small client island of
 * its own — NOT inlined into `catalog-product-card.tsx`, which stays a
 * server component — because the studio-configured WhatsApp number only
 * reaches client code through `useWaNumber()`'s Context, and Context cannot
 * be read from a Server Component.
 */
export function CardAskWhatsApp({
  title,
  slug,
}: {
  title: string;
  slug: string;
}) {
  const t = useTranslations("Shop");
  const tCommon = useTranslations("Common");
  const waNumber = useWaNumber();
  const waHref = buildWaLink(
    `${t("card.askOnWhatsApp")}: ${title}\n${SITE.url}/product/${slug}`,
    waNumber,
  );

  return (
    // Flush, no horizontal padding — see quick-view-trigger.tsx's note: a
    // 2-up mobile grid card is narrower than this ghost line's own default
    // padding left room for. `--btn-pad` moves with `px-0` so the hover
    // underline still starts and ends exactly at the visible text.
    <Button asChild variant="ghost" size="sm" className="px-0 [--btn-pad:0rem]">
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        data-wa-source="card"
      >
        <MessageCircle aria-hidden strokeWidth={1.5} className="size-4" />
        {t("card.askOnWhatsApp")}
        <span className="sr-only"> {tCommon("openInNewTab")}</span>
      </a>
    </Button>
  );
}
