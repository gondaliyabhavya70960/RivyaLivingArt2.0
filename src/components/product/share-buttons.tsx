"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { Check, Link2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ShareButtonsProps {
  slug: string;
  title: string;
  /** Absolute canonical product URL — built on the server. */
  url: string;
  /**
   * What is being shared. The row is mounted on the PDP, on `/blog/[slug]`
   * and (potentially) on a case study; emitting `share_product` from all of
   * them filed every journal share under product shares, so the blog's share
   * numbers were unreadable. Defaults to `product` so the PDP call sites are
   * unchanged.
   */
  kind?: "product" | "post" | "case";
}

/**
 * Share row actions. WhatsApp uses the numberless wa.me share composer
 * (recipient picked by the user); copy-link gives a 2s check-icon pulse.
 * Analytics fire-and-forget — never block the user's action.
 */
export function ShareButtons({
  slug,
  title,
  url,
  kind = "product",
}: ShareButtonsProps) {
  const shareEvent = `share_${kind}`;
  const tCommon = useTranslations("Common");
  const tShare = useTranslations("Product.share");
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending feedback reset on unmount.
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  // wa.me with no number opens WhatsApp's "share to…" composer.
  const waShareHref = `https://wa.me/?text=${encodeURIComponent(
    `${title} — ${url}`,
  )}`;
  // Gap 9 "drop a hint": the recipient-framed twin — written as a nudge TO
  // someone ("thought you'd love this"), where the plain share speaks as the
  // sender. Same numberless composer, one deep link.
  const hintHref = `https://wa.me/?text=${encodeURIComponent(
    `${tShare("hintMessage", { title })} ${url}`,
  )}`;

  async function handleCopy() {
    track(shareEvent, { slug, channel: "copy" });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/http) — quietly do nothing.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" asChild>
        <a
          href={waShareHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(shareEvent, { slug, channel: "whatsapp" })}
        >
          <MessageCircle aria-hidden className="size-4" />
          WhatsApp
          <span className="sr-only"> {tCommon("openInNewTab")}</span>
        </a>
      </Button>

      <Button variant="outline" asChild>
        <a
          href={hintHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(shareEvent, { slug, channel: "hint" })}
        >
          <MessageCircle aria-hidden className="size-4" />
          {tShare("hintLabel")}
          <span className="sr-only"> {tCommon("openInNewTab")}</span>
        </a>
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => void handleCopy()}
      >
        {copied ? (
          <Check aria-hidden className="size-4" />
        ) : (
          <Link2 aria-hidden className="size-4" />
        )}
        {copied ? tCommon("linkCopied") : tCommon("copyLink")}
      </Button>
    </div>
  );
}
