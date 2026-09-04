"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Menu, Search, X } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/storefront/button";
import { Link, usePathname } from "@/i18n/navigation";
import type { CatalogGroup, CatalogNav } from "@/lib/catalog-taxonomy";
import type { NavLink } from "@/lib/nav-menus";
import { useHeroInk } from "@/hooks/use-hero-ink";
import { useOverlayOpen } from "@/hooks/use-overlay-signal";
import { menuSignal, openSearch } from "@/lib/search-signal";
import { cn } from "@/lib/utils";

/**
 * Presence with an exit tail (the slice of AnimatePresence this file uses):
 * `present` flips true in the same commit `open` does — so focus targets
 * exist immediately — and stays true for `exitMs` after `open` drops so the
 * pure-CSS exit transition can play before unmount. Under reduced motion the
 * exit is instant anyway (the global collapse kills transitions), leaving
 * only an invisible unmount tail.
 */
function useExitPresence(open: boolean, exitMs: number) {
  const [present, setPresent] = useState(open);

  // Render-phase adjustment (the documented "adjusting state when a prop
  // changes" pattern) so opening mounts synchronously, like AnimatePresence.
  if (open && !present) {
    setPresent(true);
  }

  useEffect(() => {
    if (open || !present) return;
    const timer = window.setTimeout(() => setPresent(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, present, exitMs]);

  return { present, closing: !open && present };
}

/** Past this the transparent-over-hero bar flips to the opaque surface
 *  (§5.2: "after 80px becomes opaque mineral with a light backdrop-blur"). */
const SOLID_AT = 80;

/** Below this the bar never hides, however you scroll (§5.2). */
const HIDE_AFTER = 400;

/** Scroll delta that counts as a direction change. §5.2 asks for an 8px
 *  threshold precisely so the bar never flickers on a trackpad. */
const DIRECTION_THRESHOLD = 8;

/** Hover-intent delay before the mega panel opens (§5.3). */
const MEGA_INTENT = 120;

/** Mobile drawer item stagger (§5.4: "items staggered 40ms").
 *
 *  The `rtl:` twin matters as much as the panel's own (:650): without it the
 *  drawer slides in from the correct edge in Arabic while every item inside
 *  it flies in from the opposite one — the half-mirrored state CLAUDE.md
 *  calls worse than no mirroring at all. */
const DRAWER_ITEM =
  "animate-in fade-in slide-in-from-right-4 rtl:slide-in-from-left-4 fill-mode-backwards duration-(--dur-base) ease-(--ease-luxury) motion-reduce:animate-none";

/** Ordered mega-menu columns with their /shop?type= filter + i18n key. */
const MEGA_GROUPS: Array<{ group: CatalogGroup; labelKey: string }> = [
  { group: "art", labelKey: "groupArt" },
  { group: "supplies", labelKey: "groupSupplies" },
  { group: "print", labelKey: "groupPrint" },
];

/** 48px icon action — clears the 44px floor with room, and matches the
 *  CarouselNav circle so every icon-only control on the site is one size. */
const ICON_ACTION =
  "relative inline-flex size-12 shrink-0 items-center justify-center rounded-full text-current outline-none transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:text-sapphire focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 in-data-[theme=navy]:hover:text-champagne motion-reduce:transition-none";

export type SiteHeaderProps = {
  /**
   * The four header links and the drawer's quiet second group.
   *
   * Passed in rather than imported: they resolve from NavItem rows in the
   * layout, and this is a client component. Each link keeps its stable `key`,
   * which is what the mega-menu branch below tests for — the behaviour is
   * hooked to the key, never to the label, so renaming "Shop" in the studio
   * does not silently turn the mega menu off.
   */
  navLinks: readonly NavLink[];
  secondaryNavLinks: readonly NavLink[];

  /** Ecosystem-grouped category links for the Shop mega-menu (server-fed —
   *  never invented, Part 0). Absent/empty → Shop behaves as a plain link. */
  catalog?: CatalogNav;
  /** wa.me href built server-side from the configured WhatsApp number. */
  waHref: string;
  /**
   * The three mega-menu tile pictures, resolved server-side from the
   * site-image slots (/studio/site-images). Passed in rather than read here
   * because the header is a client component and the resolver is a server
   * cache; the layout already loads it for the rest of the chrome.
   */
  navImages: { art: string; print: string; supplies: string };
  /**
   * Locale-stripped pathnames (next-intl `usePathname` shape, e.g. "/",
   * "/custom-order") whose pages pull a dark hero under the bar. On those
   * routes the bar starts transparent with mineral ink; everywhere else it
   * is the opaque mineral surface from the first frame. Server-rendered
   * correctly — `usePathname` resolves during SSR, so there is no flash.
   *
   * CONTRACT: a listed route must sit over obsidian/deep-ocean hero imagery
   * with a scrim. Mineral links over light imagery are unreadable, and the
   * component cannot see what renders behind it.
   */
  transparentRoutes?: string[];
  /** Rendered inside the drawer's utility row — the locale control, which
   *  §5.1 moves out of the header's prime real estate. */
  localeControl?: React.ReactNode;
};

/**
 * The site header — REDESIGN.md §5.2, §5.3, §5.4.
 *
 * 80px, transparent over dark heroes, opaque + blurred + compact after 80px
 * of scroll, hidden on scroll-down past 400px and back instantly on
 * scroll-up. Four nav items — Shop · Bespoke · Studio · Journal — with
 * Search, WhatsApp and Menu on the right. No currency switcher; the language
 * control moved to the footer and the drawer.
 *
 * The active route is marked by a 1px sapphire underline offset 6px below the
 * baseline; hover draws that same underline left→right over 180ms. That
 * single gesture is the header's whole vocabulary — there is no pill, no
 * background swap, no weight change.
 *
 * Blur appears here and nowhere else on the site (§3.5).
 */
export function SiteHeader({
  catalog,
  waHref,
  navImages,
  transparentRoutes,
  localeControl,
  navLinks,
  secondaryNavLinks,
}: SiteHeaderProps) {
  const pathname = usePathname();

  const tNav = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const tHeader = useTranslations("Header");

  const [solid, setSolid] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  /* The drawer's open state lives in a module signal, not in this component:
     the mobile bottom bar's MENU item has to open the same drawer and is not
     a descendant of the header (§5.5). */
  const menuOpen = useOverlayOpen(menuSignal);
  const setMenuOpen = (next: boolean) => {
    if (next) menuSignal.open(menuButtonRef.current);
    else menuSignal.close();
  };

  const megaPresence = useExitPresence(megaOpen, 200);
  const menuPresence = useExitPresence(menuOpen, 320);

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasMenuOpenRef = useRef(false);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shopTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headerRowRef = useRef<HTMLDivElement | null>(null);

  const hasCatalog =
    !!catalog && (catalog.art.length > 0 || catalog.supplies.length > 0);

  /* `seed` is the old static allowlist — used for SSR and the first client
     paint; `useHeroInk` then watches the actual DOM (any dark band, or a
     hero wrapper `hero-media.tsx` marks) so a route the allowlist never knew
     about still gets the right header. */
  const overlayCapable = useHeroInk(
    transparentRoutes?.includes(pathname) ?? false,
  );
  /* Transparent over the hero only until the first 80px. The mega panel is a
     mineral surface, so opening it also forces the bar solid — a transparent
     bar sitting on top of an opaque panel reads as a rendering bug. */
  const transparent = overlayCapable && !solid && !megaOpen;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  /* ——— Hover intent (§5.3: a 120ms delay before opening, and a small close
     delay so the pointer can travel from the trigger into the panel). ——— */
  const openMega = () => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => setMegaOpen(true), MEGA_INTENT);
  };
  const scheduleMegaClose = () => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => setMegaOpen(false), 160);
  };
  const cancelMegaTimer = () => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
  };
  useEffect(() => () => cancelMegaTimer(), []);

  /* ——— Scroll: solidity and the hide/show. rAF-throttled, passive, and the
     only state it writes is two booleans that flip a handful of times. ——— */
  useEffect(() => {
    let raf = 0;
    let lastY = window.scrollY;

    const update = () => {
      raf = 0;
      const y = window.scrollY;
      setSolid(y > SOLID_AT);

      const delta = y - lastY;
      if (Math.abs(delta) >= DIRECTION_THRESHOLD) {
        // Down past the fold hides the bar; any upward move brings it back
        // immediately, whatever the depth.
        setHidden(delta > 0 && y > HIDE_AFTER);
        lastY = y;
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // ResizeObserver fires once on observe — the first read happens there,
    // never synchronously in the effect body.
    const ro = new ResizeObserver(onScroll);
    ro.observe(document.body);

    return () => {
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* ——— Close both layers on route change (safety net for back/forward —
     link taps already close them in onClick). ——— */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMenuOpen(false);
      setMegaOpen(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  /* ——— Mega panel: Esc closes and returns focus to the trigger; focus
     leaving the header row closes it (Tab must still reach the panel);
     an outside click closes it. ——— */
  useEffect(() => {
    if (!megaOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMegaOpen(false);
        shopTriggerRef.current?.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const row = headerRowRef.current;
      if (row && event.target instanceof Node && !row.contains(event.target)) {
        setMegaOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const row = headerRowRef.current;
      if (row && event.target instanceof Node && !row.contains(event.target)) {
        setMegaOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [megaOpen]);

  /* ——— Drawer: scroll lock, background inert, focus trap, Esc, and focus
     returned to the trigger on close. ——— */
  useEffect(() => {
    const wasOpen = wasMenuOpenRef.current;
    wasMenuOpenRef.current = menuOpen;

    if (!menuOpen) {
      // Focus return is the signal's job (it remembers the real trigger,
      // which may be the bottom bar rather than this header's button).
      void wasOpen;
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // `aria-modal` only excludes the rest of the page for AT that honours it.
    // The header carries `inert` via its own prop, but main/footer/bars are
    // siblings outside this component and would stay in the tab order.
    const pageChrome = Array.from(
      document.querySelectorAll<HTMLElement>(
        "main, body footer, [data-slot='sf-announcement-bar'], [data-slot='sf-consent'], [data-slot='sf-bottom-bar'], [data-slot='sf-wa-fab']",
      ),
    );
    for (const el of pageChrome) el.inert = true;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.getElementById("site-drawer");
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      for (const el of pageChrome) el.inert = false;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  /** The one hover/active gesture: a 1px rule 6px below the baseline. */
  const navLink = (active: boolean) =>
    cn(
      "group relative inline-flex h-11 items-center px-1 font-body text-16 whitespace-nowrap outline-none",
      "transition-colors duration-(--dur-fast) ease-(--ease-luxury) motion-reduce:transition-none",
      "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
      active ? "text-ink" : "text-graphite hover:text-ink",
      transparent &&
        (active ? "text-mineral" : "text-mineral/75 hover:text-mineral"),
    );

  const navRule = (active: boolean) =>
    cn(
      "pointer-events-none absolute inset-x-1 -bottom-1.5 h-px origin-left rtl:origin-right scale-x-0 bg-sapphire",
      "transition-transform duration-(--dur-fast) ease-(--ease-luxury) group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none",
      transparent && "bg-champagne",
      active && "scale-x-100",
    );

  return (
    <>
      <header
        data-slot="sf-site-header"
        data-theme={transparent ? "navy" : undefined}
        // Reads independently of `transparent`/`solid`: the audits key off
        // this to confirm the header is actually tracking the hero beneath
        // it, not just the scroll-solidify state — "mineral" (light ink,
        // the header itself painted transparent) while over a dark hero,
        // "ink" (dark text on the opaque bar) otherwise.
        data-ink={overlayCapable ? "mineral" : "ink"}
        inert={menuOpen || undefined}
        /* A constant-height sticky slot: the bar inside it morphs 80 → 64px
           on scroll, but the slot never changes, so nothing below it can
           shift. `pointer-events-none` on the slot / `auto` on the row keeps
           the empty strip beneath a compact bar click-through. */
        className={cn(
          "pointer-events-none sticky top-0 z-(--z-header) h-20 font-body",
          "transition-transform duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none",
          hidden && !menuOpen ? "-translate-y-full" : "translate-y-0",
        )}
      >
        {/* The opaque surface, full-bleed so ultrawide viewports stay covered.
            Blur lives here and nowhere else on the site (§3.5), and only
            while the surface is visible — an opacity-0 layer must never blur
            the hero behind it. */}
        <div
          aria-hidden
          className={cn(
            // Top scrim for the TRANSPARENT state (F2): the header floats
            // over a photograph whose top edge the hero's own bottom-up
            // gradient leaves lightest, and `redesign-audit.mjs` measured
            // mineral text beside the logo at 2.7:1 over a bright frame.
            // Obsidian at 85% fading out over 112px keeps every row of the
            // chrome above 4.5:1 whatever the picture does; it is a scrim,
            // not a box, and it is gone the moment the bar goes solid.
            "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-obsidian/85 via-obsidian/55 to-transparent transition-opacity duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none",
            transparent ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 border-b border-hairline bg-mineral/88 transition-[opacity,height] duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none",
            solid ? "h-16" : "h-20",
            transparent ? "opacity-0" : "opacity-100 backdrop-blur-md",
          )}
        />

        <div
          ref={headerRowRef}
          className={cn(
            "u-shell pointer-events-auto relative flex items-center justify-between gap-6",
            "transition-[height] duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none",
            solid ? "h-16" : "h-20",
          )}
        >
          <Logo
            className={cn(
              "shrink-0 transition-colors duration-(--dur-fast)",
              transparent ? "text-mineral" : "text-ink",
            )}
            ariaLabel={tCommon("logoHome")}
            LinkComponent={Link}
          />

          {/* ————— Centre: four items, nothing else ————— */}
          <nav
            aria-label={tHeader("primaryNav")}
            className="hidden items-center gap-8 lg:flex"
          >
            {navLinks.map((link) => {
              const active = isActive(link.href);
              const isShopMega = link.key === "shop" && hasCatalog;

              if (!isShopMega) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={cancelMegaTimer}
                    className={navLink(active)}
                  >
                    {tNav(link.key)}
                    <span aria-hidden className={navRule(active)} />
                  </Link>
                );
              }

              /* Shop is a disclosure button, not a link: it opens a panel on
                 hover-intent AND on click/Enter (§5.3). The panel's own "All
                 pieces" link carries the /shop destination, so nothing is
                 lost by making the trigger a button — and a button is what
                 aria-expanded belongs on. */
              return (
                <button
                  key={link.href}
                  ref={shopTriggerRef}
                  type="button"
                  data-slot="sf-mega-trigger"
                  aria-expanded={megaOpen}
                  aria-controls={megaOpen ? "shop-mega" : undefined}
                  onMouseEnter={openMega}
                  onMouseLeave={scheduleMegaClose}
                  onFocus={() => {
                    cancelMegaTimer();
                    setMegaOpen(true);
                  }}
                  onClick={() => {
                    cancelMegaTimer();
                    setMegaOpen((v) => !v);
                  }}
                  className={navLink(active)}
                >
                  {tNav(link.key)}
                  <span aria-hidden className={navRule(active || megaOpen)} />
                </button>
              );
            })}
          </nav>

          {/* ————— Right: search · WhatsApp · menu ————— */}
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 transition-colors duration-(--dur-fast)",
              transparent ? "text-mineral" : "text-ink",
            )}
          >
            <button
              type="button"
              data-slot="sf-search-trigger"
              aria-label={tHeader("search")}
              onClick={(event) => openSearch(event.currentTarget)}
              className={ICON_ACTION}
            >
              <Search aria-hidden strokeWidth={1.5} className="size-5" />
            </button>

            <Button
              asChild
              variant={transparent ? "premium" : "primary"}
              size="sm"
              className="ms-2 hidden md:inline-flex"
            >
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                data-wa-source="header"
              >
                {tCommon("startOnWhatsApp")}
                <span className="sr-only"> {tCommon("openInNewTab")}</span>
              </a>
            </Button>

            <button
              ref={menuButtonRef}
              type="button"
              aria-label={tHeader("openMenu")}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls="site-drawer"
              onClick={() => setMenuOpen(true)}
              className={cn(ICON_ACTION, "ms-1")}
            >
              <Menu aria-hidden strokeWidth={1.5} className="size-6" />
            </button>
          </div>

          {/* ————— Mega menu (§5.3) — visual, not a link dump ————— */}
          {hasCatalog && megaPresence.present && (
            <div
              id="shop-mega"
              role="region"
              aria-label={tHeader("catalogMenu")}
              onMouseEnter={cancelMegaTimer}
              onMouseLeave={scheduleMegaClose}
              className={cn(
                "absolute inset-x-0 top-full hidden border-y border-hairline bg-mineral p-8 lg:block",
                megaPresence.closing
                  ? "opacity-0 transition-opacity duration-(--dur-fast) ease-(--ease-luxury)"
                  : "animate-in fade-in slide-in-from-top-[6px] fill-mode-backwards duration-(--dur-fast) ease-(--ease-luxury) motion-reduce:animate-none",
              )}
            >
              {/* Full-bleed surface behind the shell-width contents: the panel
                  spans the viewport, the columns line up with the page. */}
              <span
                aria-hidden
                className="absolute inset-x-[calc(50%-50vw)] inset-y-0 -z-10 border-y border-hairline bg-mineral"
              />
              <div className="grid grid-cols-12 gap-8">
                <MegaTile
                  href="/shop?type=art"
                  image={navImages.art}
                  label={tNav("groupArt")}
                  className="col-span-3"
                />
                <div className="col-span-3">
                  {MEGA_GROUPS.filter(
                    ({ group }) => (catalog?.[group].length ?? 0) > 0,
                  )
                    .slice(0, 1)
                    .map(({ group }) => (
                      <ul key={group} className="flex flex-col gap-2.5">
                        {catalog?.[group].slice(0, 8).map((item, i) => (
                          <li
                            key={item.slug}
                            className={cn(
                              !megaPresence.closing &&
                                "animate-in fade-in fill-mode-backwards duration-(--dur-fast) ease-(--ease-luxury) motion-reduce:animate-none",
                            )}
                            style={
                              !megaPresence.closing
                                ? { animationDelay: `${i * 40}ms` }
                                : undefined
                            }
                          >
                            <Link
                              href={`/shop/${item.slug}`}
                              onClick={() => setMegaOpen(false)}
                              className="inline-flex min-h-9 items-center font-body text-16 text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                            >
                              {item.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ))}
                </div>
                <MegaTile
                  href="/shop?type=print"
                  image={navImages.print}
                  label={tNav("groupPrint")}
                  className="col-span-3"
                />
                <div className="col-span-3 flex flex-col justify-between">
                  <MegaTile
                    href="/shop?type=supplies"
                    image={navImages.supplies}
                    label={tNav("groupSupplies")}
                  />
                  <Link
                    href="/shop"
                    onClick={() => setMegaOpen(false)}
                    className="mt-6 inline-flex min-h-11 items-center gap-2 font-body text-16 text-sapphire outline-none transition-colors duration-(--dur-fast) hover:text-sapphire-hi focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                  >
                    {tHeader("exploreAll")}
                    <span aria-hidden className="rtl:-scale-x-100">
                      →
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ————— Mobile / utility drawer (§5.4) —————
          A sibling of <header> on purpose: the bar's backdrop-filter creates a
          containing block that would trap a fixed child. Full-height obsidian
          entering from the end edge over 320ms. */}
      {menuPresence.present && (
        <>
          <div
            aria-hidden
            onClick={() => setMenuOpen(false)}
            className={cn(
              "fixed inset-0 z-(--z-scrim) bg-obsidian/60",
              menuPresence.closing
                ? "opacity-0 transition-opacity duration-(--dur-base) ease-(--ease-luxury)"
                : "animate-in fade-in duration-(--dur-base) ease-(--ease-luxury) motion-reduce:animate-none",
            )}
          />
          <div
            id="site-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={tHeader("siteMenu")}
            data-theme="navy"
            className={cn(
              "fixed inset-y-0 end-0 z-(--z-drawer) flex w-full max-w-md flex-col overflow-y-auto overscroll-contain bg-obsidian font-body text-mineral",
              menuPresence.closing
                ? "translate-x-full rtl:-translate-x-full transition-transform duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none"
                : "animate-in slide-in-from-right rtl:slide-in-from-left duration-(--dur-base) ease-(--ease-luxury) motion-reduce:animate-none",
            )}
          >
            <div className="flex h-20 shrink-0 items-center justify-between ps-6 pe-4">
              <Logo
                className="text-mineral"
                ariaLabel={tCommon("logoHome")}
                LinkComponent={Link}
              />
              <button
                ref={closeButtonRef}
                type="button"
                aria-label={tHeader("closeMenu")}
                onClick={() => setMenuOpen(false)}
                className={cn(ICON_ACTION, "text-mineral")}
              >
                <X aria-hidden strokeWidth={1.5} className="size-6" />
              </button>
            </div>

            <nav
              aria-label={tHeader("mobileNav")}
              className="flex flex-1 flex-col px-6 pb-10"
            >
              <ul className="flex flex-col">
                {navLinks.map((link, index) => (
                  <li
                    key={link.href}
                    className={DRAWER_ITEM}
                    style={{ animationDelay: `${0.06 + index * 0.04}s` }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-14 items-center font-display text-h3 outline-none transition-colors duration-(--dur-fast) hover:text-champagne focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
                        isActive(link.href) ? "text-champagne" : "text-mineral",
                      )}
                    >
                      {tNav(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* The quiet second register, below a divider at small size. */}
              <ul className="mt-6 flex flex-col gap-1 border-t border-hairline-dk pt-6">
                {secondaryNavLinks.map((link, index) => (
                  <li
                    key={link.href}
                    className={DRAWER_ITEM}
                    style={{
                      animationDelay: `${0.06 + (navLinks.length + index) * 0.04}s`,
                    }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-11 items-center font-body text-16 outline-none transition-colors duration-(--dur-fast) hover:text-mineral focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
                        isActive(link.href) ? "text-mineral" : "text-mist",
                      )}
                    >
                      {tNav(link.key)}
                    </Link>
                  </li>
                ))}
                <li className={DRAWER_ITEM} style={{ animationDelay: "0.3s" }}>
                  <Link
                    href="/shop/wishlist"
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex min-h-11 items-center font-body text-16 text-mist outline-none transition-colors duration-(--dur-fast) hover:text-mineral focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                  >
                    {tNav("wishlist")}
                  </Link>
                </li>
              </ul>

              <div
                className={cn(
                  "mt-auto flex flex-col gap-6 border-t border-hairline-dk pt-6",
                  DRAWER_ITEM,
                )}
                style={{ animationDelay: "0.34s" }}
              >
                <Button asChild variant="whatsapp" size="md">
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-wa-source="drawer"
                  >
                    {tCommon("startOnWhatsApp")}
                    <span className="sr-only"> {tCommon("openInNewTab")}</span>
                  </a>
                </Button>
                {localeControl ? <div>{localeControl}</div> : null}
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}

/** A mega-menu image doorway — §5.3 asks for a visual panel, not a link
 *  dump, so each ecosystem gets a photograph at 4:3 with its name over a
 *  bottom scrim. */
function MegaTile({
  href,
  image,
  label,
  className,
}: {
  href: string;
  image: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative block overflow-hidden rounded-image outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        className,
      )}
    >
      <span className="relative block aspect-[4/3]">
        <Image
          src={image}
          alt=""
          fill
          sizes="280px"
          className="object-cover transition-transform duration-(--dur-slow) ease-(--ease-luxury) group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-obsidian/85 to-transparent"
        />
        <span className="u-micro absolute inset-x-0 bottom-0 p-4 text-mineral">
          {label}
        </span>
      </span>
    </Link>
  );
}
