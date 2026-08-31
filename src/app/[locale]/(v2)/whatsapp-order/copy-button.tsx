"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/storefront/button";

/**
 * Copies the saved WhatsApp order text — a lifeline when wa.me misfires.
 * v2.0 restyle-in-place: the v7 porcelain-outline skin becomes the storefront
 * secondary button (B3 — outline ink on light); clipboard write, copied
 * state and timer are untouched. `aria-live` lets the label swap ("Copied")
 * be announced, and the check rides success-ink so the confirmation is never
 * color-only (A5).
 */
export function CopyMessageButton({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("WhatsAppOrder");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions / http) — leave the button as-is;
      // the message is selectable right above.
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      aria-live="polite"
      onClick={() => void handleCopy()}
    >
      {copied ? (
        <>
          <Check aria-hidden strokeWidth={1.5} className="size-4 text-success" />
          {t("copied")}
        </>
      ) : (
        <>
          <Copy aria-hidden strokeWidth={1.5} className="size-4" />
          {t("copy")}
        </>
      )}
    </Button>
  );
}
