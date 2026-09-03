"use client";

import { useTranslations } from "next-intl";
import { Home, Menu, MessageCircle, Search, Store } from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";
import { openMenu, openSearch } from "@/lib/search-signal";
import { cn } from "@/lib/utils";

/**
 * The mobile bottom bar — REDESIGN.md §5.5.
 *
 *     HOME  |  SHOP  |  SEARCH  |  WHATSAPP  |  MENU
 *
 * Fixed, 64–72px, mineral with a top hairline and a safe-area inset. The
 * active item is marked with a sapphire dot and a filled label — never colour
 * alone.
 *
 * **Because this exists, there is no floating WhatsApp button on mobile**
 * (decisions log #8: "two persistent WhatsApp affordances on a 375px screen
 * is one too many"). The desktop FAB lives in `WhatsAppFab`.
 *
 * The bar carries one of the site's two sanctioned shadows — a 1px top rule
 * rendered as a shadow so it sits above the page's own borders (§3.5).
 *
 * Suppressed on the PDP and the commission flow, where a sticky action bar
 * already owns that edge with higher intent.
 */
export function MobileBottomBar({ waHref }: { waHref: string }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");

  // The PDP's sticky buy bar and the commission flow's own action bar already
  // occupy this edge (§5.5).
  if (
    pathname.startsWith("/product/") ||
    pathname.startsWith("/custom-order")
  ) {
    return null;
  }

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const item =
    "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 outline-none transition-colors duration-(--dur-fast) ease-(--ease-luxury) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset motion-reduce:transition-none";

  return (
    <>
      {/* In-flow spacer — the fixed bar must never permanently cover the
          footer's last row. */}
      <div aria-hidden className="h-18 lg:hidden" />
      <nav
        data-slot="sf-bottom-bar"
        aria-label={t("primaryMobile")}
        className="fixed inset-x-0 bottom-0 z-(--z-bar) bg-mineral shadow-[0_-1px_0_var(--hairline)] lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex items-stretch">
          <BarLink
            href="/"
            label={t("home")}
            active={active("/")}
            className={item}
            icon={<Home aria-hidden strokeWidth={1.5} className="size-5" />}
          />
          <BarLink
            href="/shop"
            label={t("shop")}
            active={active("/shop")}
            className={item}
            icon={<Store aria-hidden strokeWidth={1.5} className="size-5" />}
          />
          <li className="flex flex-1">
            <button
              type="button"
              onClick={(event) => openSearch(event.currentTarget)}
              className={cn(item, "text-graphite hover:text-ink")}
            >
              <Search aria-hidden strokeWidth={1.5} className="size-5" />
              <span className="u-micro leading-none">{t("search")}</span>
            </button>
          </li>
          <li className="flex flex-1">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="bottom-bar"
              className={cn(item, "text-whatsapp-deep")}
            >
              <MessageCircle aria-hidden strokeWidth={1.5} className="size-5" />
              <span className="u-micro leading-none text-whatsapp-deep">
                {t("whatsapp")}
              </span>
              <span className="sr-only">{tCommon("openInNewTab")}</span>
            </a>
          </li>
          <li className="flex flex-1">
            <button
              type="button"
              onClick={(event) => openMenu(event.currentTarget)}
              className={cn(item, "text-graphite hover:text-ink")}
            >
              <Menu aria-hidden strokeWidth={1.5} className="size-5" />
              <span className="u-micro leading-none">{t("menu")}</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

function BarLink({
  href,
  label,
  icon,
  active,
  className,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  className: string;
}) {
  return (
    <li className="flex flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(className, active ? "text-ink" : "text-graphite")}
      >
        {/* The active mark: a sapphire dot above the icon, plus a filled
            label — state is never colour alone (Part 16). */}
        {active ? (
          <span
            aria-hidden
            className="absolute top-1.5 size-1 rounded-full bg-sapphire"
          />
        ) : null}
        {icon}
        <span
          className={cn(
            "u-micro leading-none",
            active && "font-medium text-ink",
          )}
        >
          {label}
        </span>
      </Link>
    </li>
  );
}
