"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { MarketingScripts } from "@/components/analytics/marketing-scripts";
import { Button } from "@/components/storefront/button";

/**
 * Consent gate for the marketing pixels (MKT-205). MarketingScripts is
 * env-gated off by default; when the owner sets NEXT_PUBLIC_META_PIXEL_ID /
 * NEXT_PUBLIC_GA_ID this makes sure the Pixel/GA only load AFTER an explicit
 * opt-in (DPDP/GDPR), rather than tracking every visitor on page one. The
 * choice is remembered in localStorage. Renders nothing (no banner, no
 * scripts) until a marketing tag is actually configured.
 *
 * useSyncExternalStore keeps the client-only localStorage read hydration-safe
 * (server snapshot = null → nothing renders during SSR).
 */
const STORAGE_KEY = "rr_marketing_consent"; // "granted" | "denied"
const CONSENT_EVENT = "rr-consent-change";

const CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ||
  process.env.NEXT_PUBLIC_GA_ID?.trim(),
);

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readConsent(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ConsentGate() {
  const t = useTranslations("Consent");
  const choice = useSyncExternalStore(subscribe, readConsent, () => null);

  function decide(value: "granted" | "denied") {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore — session-only if storage is blocked
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  if (!CONFIGURED) return null; // nothing to consent to
  if (choice === "granted") return <MarketingScripts />;
  if (choice === "denied") return null;

  // No choice yet — show a dismissible banner using existing dark-canvas
  // tokens. Part 0 audit fixes (A8-002..004, A2-005): role="region" (it is a
  // non-modal banner — role="dialog" promised a focus/Escape contract it
  // never implemented); z-[55] keeps it UNDER the aria-modal mobile menu
  // (z-[60]); safe-area margin clears the iOS home-indicator; min-h-11
  // restores the A5 44px tap floor on the two decision buttons.
  return (
    <div
      role="region"
      data-slot="sf-consent"
      aria-label={t("label")}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      /* Part 3.5: no storefront drop shadow, blur only in the header, and a
         card radius of 4px — this banner carried a third shadow, a second
         blur and a 16px radius on every page (Phase 0 audit §3.2). A solid
         obsidian ground with a hairline is the whole surface language. */
      className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-3xl rounded-card border border-mineral/15 bg-obsidian p-5 sm:inset-x-6 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small leading-relaxed text-mineral/80">
          {t("body")}
        </p>
        <div className="flex shrink-0 gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11 text-mineral/70 hover:bg-mineral/10 hover:text-mineral"
            onClick={() => decide("denied")}
          >
            {t("decline")}
          </Button>
          {/* Storefront primary (royal) replaces the v7 sapphire default,
              whose 700ms shine sweep sat outside both A5 duration bands —
              the last S-02 remnant. */}
          <Button
            size="sm"
            variant="primary"
            className="min-h-11"
            onClick={() => decide("granted")}
          >
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
