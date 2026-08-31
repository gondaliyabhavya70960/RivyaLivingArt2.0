"use client";

import { useRef } from "react";
import Link from "next/link";
import { Bell, ExternalLink, LogOut, Search, User } from "lucide-react";

import { StudioBreadcrumbs } from "@/components/studio/breadcrumbs";
import type { Role } from "@/generated/prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openStudioPalette } from "@/lib/studio-palette-signal";
import { SITE } from "@/lib/constants";

/** Every control on the bar is a 44px target with the same resting ink. */
const ACTION =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-input text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none";

/**
 * Studio top bar — REDESIGN.md §12.2: "page title left; search, notifications,
 * WhatsApp shortcut and profile right."
 *
 * The left slot is the breadcrumb trail, not a repeat of the page's `h1`.
 * Part 17 forbids duplicated heading text on a page, and the `h1` already
 * lives in `PageHeader` where the content starts; a second copy 60px above it
 * would be exactly that duplication. The trail ends on the current page, so
 * the bar still answers "where am I" — as navigation, which is what it is.
 *
 * `Notifications` is a real count, not a dot: NEW commissions plus the scraper
 * rows waiting on a human. Both are already the two things in this Studio that
 * queue up waiting for the owner, and both deep-link to the queue that holds
 * them.
 */
export function StudioTopbar({
  email,
  role,
  newCommissions,
  pendingApprovals,
  signOut,
}: {
  email: string;
  role: Role;
  newCommissions: number;
  pendingApprovals: number;
  signOut: () => Promise<void>;
}) {
  const searchRef = useRef<HTMLButtonElement>(null);
  const pending = newCommissions + pendingApprovals;

  const notificationLabel =
    pending === 0
      ? "Nothing waiting on you"
      : `${pending} waiting on you: ${newCommissions} new commission${
          newCommissions === 1 ? "" : "s"
        }, ${pendingApprovals} scraper row${
          pendingApprovals === 1 ? "" : "s"
        } to review`;

  return (
    <header className="sticky top-0 z-30 -mx-5 mb-8 hidden h-16 border-b border-border bg-background px-5 sm:-mx-8 sm:px-8 lg:flex lg:items-center lg:gap-4">
      <div className="min-w-0 flex-1">
        <StudioBreadcrumbs />
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          ref={searchRef}
          type="button"
          onClick={() => openStudioPalette(searchRef.current)}
          className="inline-flex min-h-11 items-center gap-2 rounded-input px-3 text-small text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
        >
          <Search aria-hidden strokeWidth={1.5} className="size-4" />
          <span>Search</span>
          <kbd
            aria-hidden
            className="u-micro rounded-input border border-border px-1.5 py-0.5"
          >
            ⌘K
          </kbd>
        </button>

        <Link href="/studio/activity" className={ACTION} title="Notifications">
          <span className="relative">
            <Bell aria-hidden strokeWidth={1.5} className="size-5" />
            {pending > 0 && (
              <span
                aria-hidden
                className="absolute -end-1 -top-1 size-1.5 rounded-full bg-alert"
              />
            )}
          </span>
          <span className="sr-only">{notificationLabel}</span>
        </Link>

        <a
          href={`https://wa.me/${SITE.whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className={ACTION}
          title="Open WhatsApp"
        >
          {/* Lucide has no WhatsApp glyph; the brand mark is drawn inline at
              the same 1.5 stroke as the rest of the bar (contract §7 keeps one
              icon family — this is a logo, not a UI icon). */}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-5 text-whatsapp"
          >
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.29Z" />
          </svg>
          <span className="sr-only">Open WhatsApp</span>
        </a>

        <DropdownMenu>
          <DropdownMenuTrigger className={ACTION} title="Account">
            <User aria-hidden strokeWidth={1.5} className="size-5" />
            <span className="sr-only">Account menu for {email}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="pb-1">
              <span className="block truncate text-small font-medium text-foreground">
                {email}
              </span>
              <span className="u-micro mt-1 block">{role}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden strokeWidth={1.5} />
                View site
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild variant="destructive">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2"
                >
                  <LogOut aria-hidden strokeWidth={1.5} />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
