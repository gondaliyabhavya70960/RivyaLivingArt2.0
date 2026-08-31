"use client";

import { useEffect } from "react";

import { fbqTrack, trackEvent } from "@/lib/analytics";
import { captureAttribution } from "@/lib/attribution";

/**
 * True when a wa.me / api.whatsapp.com URL targets a specific number (a real
 * "contact the business" link) rather than the numberless share composer
 * (`wa.me/?text=…`, used by ShareButtons). Share clicks must NOT count as CTA
 * clicks / Meta Contact conversions or they inflate the core KPI (MKT-209).
 */
function isContactWaLink(href: string): boolean {
  try {
    const u = new URL(href, window.location.href);
    if (u.hostname === "api.whatsapp.com") {
      return Boolean(u.searchParams.get("phone"));
    }
    // wa.me/<number> → pathname is "/<number>"; share composer → "/".
    return u.pathname.replace(/\/+$/, "") !== "";
  } catch {
    return true; // unparseable — fall back to counting it
  }
}

/**
 * Instruments EVERY WhatsApp deep-link click site-wide with one delegated
 * listener (MKT-001) — the floating button, hero, header, footer and every
 * page CTA emit a consistent `whatsapp_cta_click` event (Vercel Analytics +
 * Meta Pixel `Contact`) without having to edit each anchor. Attribution comes
 * from a `data-wa-source` attribute on or above the anchor, else the current
 * pathname. The core macro-conversion of a WhatsApp-only store is now measured.
 */
export function WhatsAppTracker() {
  useEffect(() => {
    // First-touch attribution: capture on the session's first page load so
    // the campaign that brought the visitor in is available at submit (MKT-201).
    captureAttribution();

    function onClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>(
        'a[href*="wa.me"], a[href*="api.whatsapp.com"]',
      );
      if (!anchor) return;
      // Skip the numberless share composer — it's a share, not a contact (MKT-209).
      if (!isContactWaLink(anchor.href)) return;
      const source =
        anchor.getAttribute("data-wa-source") ||
        anchor.closest("[data-wa-source]")?.getAttribute("data-wa-source") ||
        "link";
      trackEvent("whatsapp_cta_click", {
        source,
        path: window.location.pathname,
      });
      fbqTrack("Contact", { source });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
