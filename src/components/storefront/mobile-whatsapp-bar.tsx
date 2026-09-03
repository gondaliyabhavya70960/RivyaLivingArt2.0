"use client";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/storefront/button";
import { usePathname } from "@/i18n/navigation";

/**
 * Global mobile WhatsApp bar (external audit §37). WhatsApp is the house's
 * only ordering channel (Part 0), so below lg — where the header's chrome
 * CTA doesn't exist — a persistent bottom bar keeps the conversation one tap
 * away on every storefront page. Royal primary voice per A2 rule 2 (WhatsApp
 * green stays reserved for the PDP's final Place Order action).
 *
 * Hidden on the PDP: its own sticky order bar (--z-bar, lg:hidden) already
 * owns that edge with higher purchase intent. The in-flow spacer keeps the
 * footer's last rows scrollable above the fixed bar; --z-bar sits under the
 * consent card (--z-consent) and the mobile menu (--z-drawer), and it carries
 * data-slot="sf-mobile-wa-bar" so the open menu inerts it with the rest of
 * the page chrome.
 */
export function MobileWhatsappBar({
  waHref,
  label,
  newTabLabel,
}: {
  waHref: string;
  /** Pre-translated CTA label (Common.startOnWhatsApp). */
  label: string;
  /** Pre-translated sr-only "opens in a new tab" hint. */
  newTabLabel: string;
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/product/")) return null;

  return (
    <>
      {/* In-flow spacer — the fixed bar must never permanently cover the
          footer's last row. */}
      <div aria-hidden className="h-16 lg:hidden" />
      <div
        data-slot="sf-mobile-wa-bar"
        className="fixed inset-x-0 bottom-0 z-(--z-bar) border-t border-hairline bg-mineral/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="px-5 py-2.5">
          <Button asChild className="w-full">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="mobile-bar"
            >
              <MessageCircle aria-hidden strokeWidth={1.5} className="size-4" />
              {label}
              <span className="sr-only"> {newTabLabel}</span>
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}
