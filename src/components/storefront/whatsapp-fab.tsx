"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";

import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The desktop WhatsApp button — REDESIGN.md §5.5.
 *
 * "The desktop FAB remains, appearing after 25% scroll, and is suppressed on
 * product and commission pages where a sticky action bar already occupies
 * that role." Below `lg` it does not exist at all: the mobile bottom bar
 * carries WhatsApp there, and two persistent WhatsApp affordances on a 375px
 * screen is one too many (decisions log #8).
 *
 * WhatsApp green, not champagne and not sapphire: this is the order channel,
 * and §3.1 reserves the green for exactly this. The fill is `whatsapp-deep`
 * so the mineral glyph clears AA.
 */
export function WhatsAppFab({ waHref }: { waHref: string }) {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);
  const t = useTranslations("Common");

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setShown(max > 0 && window.scrollY / max > 0.25);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // ResizeObserver fires once on observe — the first read happens there.
    const ro = new ResizeObserver(onScroll);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (
    pathname.startsWith("/product/") ||
    pathname.startsWith("/custom-order")
  ) {
    return null;
  }

  return (
    <a
      href={waHref}
      target="_blank"
      rel="noopener noreferrer"
      data-slot="sf-wa-fab"
      data-wa-source="desktop-fab"
      aria-hidden={!shown}
      tabIndex={shown ? undefined : -1}
      className={cn(
        "fixed end-8 bottom-8 z-30 hidden size-14 items-center justify-center rounded-full bg-whatsapp-deep text-mineral outline-none lg:flex",
        "transition-[opacity,transform] duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none",
        "hover:bg-whatsapp focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3",
        shown
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <MessageCircle aria-hidden strokeWidth={1.5} className="size-6" />
      <span className="sr-only">
        {t("startOnWhatsApp")} {t("openInNewTab")}
      </span>
    </a>
  );
}
