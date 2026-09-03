"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import type { InboxItem } from "@/lib/studio-inbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const TONE_DOT: Record<InboxItem["tone"], string> = {
  default: "bg-graphite/50",
  warning: "bg-alert",
  success: "bg-success",
};

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * The topbar bell, upgraded from a bare link + a two-number count (10
 * remnants) into what is actually waiting: pending review queues, recent
 * scrape/import results and publish activity — `getStudioInbox()` gathers
 * these once per page load and this component just renders the list. No
 * `src/components/ui/popover.tsx` exists yet, so this reuses `DropdownMenu`,
 * matching the Account menu right beside it.
 *
 * The link to `/studio/activity` stays inside — the full log this only
 * summarises.
 */
export function NotificationsPopover({ items }: { items: InboxItem[] }) {
  const pendingCount = items.filter((item) => item.kind === "pending").length;
  const label =
    items.length === 0
      ? "Nothing waiting on you"
      : `${items.length} update${items.length === 1 ? "" : "s"} waiting on you`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-input text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
        title="Notifications"
      >
        <span className="relative">
          <Bell aria-hidden strokeWidth={1.5} className="size-5" />
          {items.length > 0 && (
            <span
              aria-hidden
              className={cn(
                "absolute -end-1 -top-1 size-1.5 rounded-full",
                pendingCount > 0 ? "bg-alert" : "bg-graphite/60",
              )}
            />
          )}
        </span>
        <span className="sr-only">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-3 text-small text-graphite">
            Nothing waiting on you right now.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((item) => (
              <DropdownMenuItem key={item.id} asChild>
                <Link href={item.href} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      TONE_DOT[item.tone],
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-medium text-foreground">
                      {item.label}
                    </span>
                    {item.detail && (
                      <span className="block truncate text-small text-graphite">
                        {item.detail}
                      </span>
                    )}
                  </span>
                  {item.at && (
                    <span className="u-num shrink-0 text-12 text-graphite">
                      {relativeTime(item.at)}
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/studio/activity">View full activity log</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
