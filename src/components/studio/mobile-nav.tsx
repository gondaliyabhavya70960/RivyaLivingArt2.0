"use client";

import { useRef, useState } from "react";
import { Menu, Search } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { Logo } from "@/components/layout/logo";
import { StudioNav } from "@/components/studio/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { openStudioPalette } from "@/lib/studio-palette-signal";

const ACTION =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-input text-mist outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:bg-mineral/10 hover:text-mineral focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset motion-reduce:transition-none";

/**
 * Mobile studio chrome — §12.6 ("slide-in or bottom navigation"). Slide-in,
 * because the Studio's nav is 20 destinations across five groups and a bottom
 * bar can hold four; the storefront's bottom bar (§5.5) is the one that earns
 * that pattern.
 *
 * Same obsidian treatment as the desktop aside: `data-theme="navy"` (champagne
 * focus per Part 16) wired through the same `--ring` / `--background`
 * overrides. The sheet also re-points `--secondary` at deep ocean so the
 * shadcn close button's open-state chip stays legible on obsidian.
 *
 * The Search button raises the same ⌘K palette the desktop bar does — there is
 * no keyboard on a phone to press ⌘K with.
 */
export function StudioMobileNav({
  email,
  role,
  newCommissions,
  signOut,
}: {
  email: string;
  role: Role;
  newCommissions: number;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      data-theme="navy"
      className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-hairline-dk bg-obsidian px-3 lg:hidden [--background:var(--obsidian)] [--ring:var(--focus)]"
    >
      <Logo href="/studio" className="h-6 text-mineral" />
      <div className="flex items-center gap-0.5">
        <button
          ref={searchRef}
          type="button"
          onClick={() => openStudioPalette(searchRef.current)}
          className={ACTION}
        >
          <Search aria-hidden strokeWidth={1.5} className="size-5" />
          <span className="sr-only">Search the studio</span>
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className={ACTION}>
            <span className="relative">
              <Menu aria-hidden strokeWidth={1.5} className="size-5" />
              {newCommissions > 0 && (
                <span
                  aria-hidden
                  className="absolute -end-1 -top-1 size-1.5 rounded-full bg-champagne"
                />
              )}
            </span>
            <span className="sr-only">
              Open studio menu
              {newCommissions > 0
                ? ` — ${newCommissions} new commission${newCommissions === 1 ? "" : "s"}`
                : ""}
            </span>
          </SheetTrigger>
          <SheetContent
            side="left"
            data-theme="navy"
            className="w-[19rem] overflow-y-auto border-e border-hairline-dk bg-obsidian text-mineral shadow-none [--background:var(--obsidian)] [--ring:var(--focus)] [--secondary:var(--deep-ocean)]"
          >
            <SheetHeader>
              <SheetTitle className="u-micro text-mist/70">STUDIO</SheetTitle>
            </SheetHeader>
            <div className="px-2 pb-8">
              <StudioNav role={role} onNavigate={() => setOpen(false)} />
              <div className="mt-7 border-t border-hairline-dk px-3 pt-4">
                <p className="truncate text-small text-mineral">{email}</p>
                <p className="u-micro mt-1 text-mist/70">{role}</p>
                <form action={signOut} className="mt-2">
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center rounded-input text-small text-mist underline-offset-4 outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-mineral hover:underline focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
