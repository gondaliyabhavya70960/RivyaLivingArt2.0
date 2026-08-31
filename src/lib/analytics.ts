import { track } from "@vercel/analytics";

/**
 * One client-side event layer for the funnel (MKT-206). Vercel Analytics is
 * always on; Meta Pixel (`fbq`) and GA4 (`gtag`) are no-ops until those tags
 * are present (env-gated + consent — see MarketingScripts / ConsentGate), so
 * calling these is always safe. Every call is fire-and-forget: analytics must
 * never break the user's action.
 *
 * The key fix here is that a COMPLETED conversion (a submitted order, custom
 * commission, newsletter signup, contact) now reaches the ad platforms via
 * `trackLead`, not just the top-of-funnel `whatsapp_cta_click`, so Meta/GA can
 * optimise toward and attribute real inquiries.
 */

type AllowedValue = string | number | boolean | null;
export type EventProps = Record<string, AllowedValue>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

/** Meta Pixel event — no-op until the pixel script has loaded. */
export function fbqTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", event, params);
  }
}

/** GA4 event — no-op until gtag has loaded. */
export function gtagEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", event, params);
  }
}

/** Vercel Analytics custom event (always recorded). */
export function trackEvent(name: string, props?: EventProps) {
  try {
    track(name, props);
  } catch {
    // Analytics must never throw into the caller.
  }
}

/**
 * A completed conversion. Emits the Vercel event plus the ad-platform lead
 * events (Meta `Lead` + GA4 `generate_lead`) so paid acquisition can optimise
 * toward and attribute submitted inquiries.
 */
export function trackLead(name: string, props?: EventProps) {
  trackEvent(name, props);
  try {
    fbqTrack("Lead", props);
    gtagEvent("generate_lead", props);
  } catch {
    // no-op
  }
}
