"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setInquiriesStatus } from "@/actions/inquiries";
import {
  SELECTABLE_STATUSES,
  SOURCE_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/components/studio/inquiries/labels";
import {
  priorityFromBand,
  stageTimer,
  type StageTimer,
} from "@/components/studio/inquiries/lead-time";
import { StageTimerRing } from "@/components/studio/inquiries/stage-timer-ring";
import { EmptyState } from "@/components/studio/page-header";
import type { InquirySource, InquiryStatus } from "@/generated/prisma/enums";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { cn, monogram } from "@/lib/utils";

export type CommissionCard = {
  id: string;
  /** Pre-formatted "#RR-<n>" reference. */
  number: string;
  customerName: string;
  source: InquirySource;
  /** Product title, or null for a custom / contact commission. */
  projectTitle: string | null;
  thumbnailUrl: string | null;
  status: InquiryStatus;
  /** The customer's own words for when they need it — there is no deadline column. */
  timeline: string | null;
  /** Raw ISO string; the timer is computed on the client so it stays live. */
  createdAtIso: string;
  /** Pre-formatted on the server to keep hydration deterministic. */
  createdAt: string;
};

const PRIORITY_TONE = {
  flat: "border-border text-graphite",
  warning: "border-warning/50 text-warning",
  alert: "border-alert/50 text-alert",
} as const;

/**
 * Commission board — REDESIGN.md §12.4.
 *
 * **The columns are ResinRiva's real pipeline, not the spec's.** §12.4 lists
 * `Inquiry → Quoted → Approved → Design → Production → Curing → Finishing →
 * Ready → Delivered`. Six of those nine stages do not exist anywhere in this
 * product: `InquiryStatus` (prisma/schema.prisma) is `NEW · CONTACTED ·
 * DISCUSSION · QUOTED · CONFIRMED · IN_PRODUCTION · DELIVERED` plus the
 * terminal pair `CLOSED · LOST`. §1.1 forbids schema changes, and decision #5
 * settles the principle: keep the pattern, carry ResinRiva's real values.
 * So the board is seven columns — `STATUS_ORDER`, the same active pipeline the
 * stats row and the status filter already use — and the terminal pair stays
 * off the board, where a lost lead cannot occupy a lane.
 *
 * **No drag-and-drop.** §12.4 makes it optional and requires keyboard parity
 * if it ships. A status `<select>` on every card is the keyboard path, it is
 * also the fastest pointer path (one click, no drop target to miss), and it
 * goes through the existing `setInquiriesStatus` Server Action unchanged — so
 * adding drag on top would buy a second way to do the same thing and a second
 * way for it to disagree with the server. Left out on purpose.
 */
export function CommissionBoard({
  cards,
  counts,
  shown,
  total,
}: {
  cards: CommissionCard[];
  /** True per-status totals (the board renders a capped slice). */
  counts: Map<InquiryStatus, number>;
  shown: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const move = (card: CommissionCard, next: InquiryStatus) => {
    if (next === card.status) return;
    setBusyId(card.id);
    startTransition(async () => {
      const result = await setInquiriesStatus([card.id], next);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${card.customerName} moved to ${STATUS_LABELS[next].toLowerCase()}.`,
      );
      router.refresh();
    });
  };

  if (total === 0) {
    return (
      <EmptyState
        title="The bench is clear"
        description="Every commission that starts on the website lands here — from the first WhatsApp message through to delivery. Nothing is in the pipeline right now."
      />
    );
  }

  return (
    <div>
      {shown < total && (
        <p className="u-micro mb-3">
          SHOWING THE {shown} MOST RECENT OF {total} · OPEN THE TABLE FOR THE
          FULL LIST
        </p>
      )}
      {/* One horizontal scroller for the whole board — columns keep a fixed
          width so a long lane never squeezes its neighbours to nothing. */}
      <div className="relative -mx-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
        <ol className="flex min-w-max items-start gap-4">
          {STATUS_ORDER.map((status) => {
            const lane = cards.filter((card) => card.status === status);
            const laneTotal = counts.get(status) ?? 0;
            return (
              <li key={status} className="w-[19rem] shrink-0">
                <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
                  <h3 className="u-micro text-foreground">
                    {STATUS_LABELS[status]}
                  </h3>
                  <span className="u-num text-small text-graphite">
                    {laneTotal}
                  </span>
                </div>
                {lane.length === 0 ? (
                  <p className="u-micro mt-4 px-1">Nothing at this stage</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {lane.map((card) => (
                      <li key={card.id}>
                        <CommissionCardBody
                          card={card}
                          busy={pending && busyId === card.id}
                          onMove={(next) => move(card, next)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function CommissionCardBody({
  card,
  busy,
  onMove,
}: {
  card: CommissionCard;
  busy: boolean;
  onMove: (next: InquiryStatus) => void;
}) {
  const timer: StageTimer = stageTimer(new Date(card.createdAtIso));
  const priority = priorityFromBand(timer.band);
  const project =
    card.projectTitle ?? `${SOURCE_LABELS[card.source]} commission`;

  return (
    <article
      className={cn(
        "rounded-card border border-border bg-card p-3 shadow-e1 transition-opacity duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
        busy && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail — the commissioned product's own first image, or the
            customer's monogram when the commission has no product attached
            (custom orders and contact leads never do). */}
        <span className="relative size-12 shrink-0 overflow-hidden rounded-image border border-border bg-background">
          {card.thumbnailUrl ? (
            <Image
              src={card.thumbnailUrl}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              unoptimized={!isOptimizableImageSrc(card.thumbnailUrl)}
            />
          ) : (
            <span
              aria-hidden
              className="u-num absolute inset-0 flex items-center justify-center text-small text-graphite"
            >
              {monogram(card.customerName)}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="u-micro">{card.number}</p>
          <h4 className="mt-0.5 truncate text-small font-medium text-foreground">
            <Link
              href={`/studio/inquiries/${card.id}`}
              title={card.customerName}
              className="rounded-input underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
            >
              {card.customerName}
            </Link>
          </h4>
          <p className="truncate text-small text-graphite" title={project}>
            {project}
          </p>
        </div>

        <StageTimerRing timer={timer} />
      </div>

      <dl className="mt-3 space-y-1 border-t border-border pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="u-micro">Timeline</dt>
          {/* No deadline column exists on Inquiry — this is the customer's own
              stated timeline, labelled as such. */}
          <dd className="min-w-0 truncate text-small text-foreground">
            {card.timeline ?? "Not stated"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="u-micro">Received</dt>
          <dd className="u-num text-small text-graphite">{card.createdAt}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span
          title={timer.description}
          className={cn(
            "u-micro inline-flex min-h-6 items-center rounded-full border px-2.5",
            PRIORITY_TONE[priority.tone],
          )}
        >
          {priority.label} · {timer.bandLabel}
        </span>

        {/* The keyboard-and-pointer path for moving a card between lanes.
            A native select, not a listbox: it is one control, it is reachable
            with a single Tab, and it works on a phone. */}
        <label className="flex items-center gap-2">
          <span className="sr-only">
            Stage for {card.customerName}&rsquo;s commission
          </span>
          <select
            value={card.status}
            disabled={busy}
            onChange={(event) => onMove(event.target.value as InquiryStatus)}
            className="min-h-9 rounded-input border border-field bg-transparent px-2 text-small text-foreground outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-sapphire-ink/50 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-40 motion-reduce:transition-none"
          >
            {SELECTABLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}
