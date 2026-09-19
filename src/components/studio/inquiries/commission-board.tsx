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
import { DemoBadge } from "@/components/studio/demo-badge";
import { EmptyState } from "@/components/studio/page-header";
import {
  KanbanBoard,
  KanbanCardShell,
  KanbanColumn,
  KanbanMoveSelect,
  type KanbanMoveOption,
} from "@/components/studio/kanban";
import type { InquirySource, InquiryStatus } from "@/generated/prisma/enums";
import { Icon } from "@/components/icons";
import { INQUIRY_STATUS_ICON } from "@/components/icons/status";
import { WhatsAppReplyButton } from "@/components/studio/inquiries/whatsapp-reply-button";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { cn, monogram } from "@/lib/utils";

export type CommissionCard = {
  id: string;
  /** Pre-formatted "#RR-<n>" reference. */
  number: string;
  customerName: string;
  /** The customer's own number — the card's Reply button deep-links to it. */
  phone: string;
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
  /** Content Lab fixture (batch G) — never a real commission. */
  isDemo?: boolean;
};

/**
 * Same three tones as `badgeVariants`, at the same weights — this pill is not
 * a `<Badge>` because it carries two data points (`priority · band`) and needs
 * the wider box, but it sat at /50 while the scraper's badges sat at /40, so
 * the identical state was drawn two ways on two screens an owner moves between
 * all day. Weights match now; only the sizing differs.
 */
const PRIORITY_TONE = {
  flat: "border-border text-graphite",
  warning: "border-warning/40 bg-warning/8 text-warning",
  alert: "border-alert/40 bg-alert/8 text-alert",
} as const;

const MOVE_OPTIONS: readonly KanbanMoveOption<InquiryStatus>[] =
  SELECTABLE_STATUSES.map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
  }));

/**
 * Commission board — REDESIGN.md §12.4.
 *
 * **The columns are Rivya Living Art's real pipeline, not the spec's.** §12.4 lists
 * `Inquiry → Quoted → Approved → Design → Production → Curing → Finishing →
 * Ready → Delivered`. Six of those nine stages do not exist anywhere in this
 * product: `InquiryStatus` (prisma/schema.prisma) is `NEW · CONTACTED ·
 * DISCUSSION · QUOTED · CONFIRMED · IN_PRODUCTION · DELIVERED` plus the
 * terminal pair `CLOSED · LOST`. §1.1 forbids schema changes, and decision #5
 * settles the principle: keep the pattern, carry Rivya Living Art's real values.
 * So the board is seven columns — `STATUS_ORDER`, the same active pipeline the
 * stats row and the status filter already use — and the terminal pair stays
 * off the board, where a lost lead cannot occupy a lane.
 *
 * **No drag-and-drop.** §12.4 makes it optional and requires keyboard parity
 * if it ships. The per-card move select (`KanbanMoveSelect`) is the keyboard
 * path, it is also the fastest pointer path (one click, no drop target to
 * miss), and it goes through the existing `setInquiriesStatus` Server Action
 * unchanged — so adding drag on top would buy a second way to do the same
 * thing and a second way for it to disagree with the server. Left out on
 * purpose (KANBAN-SPEC records the decision so it stays out).
 *
 * **Built on the shared Kanban primitives** (`components/studio/kanban`) —
 * this board was their reference implementation: the primitives were
 * extracted from this file with zero visual or behavioural change, which is
 * the proof the extraction is faithful. Products and the scraper review
 * build their boards from the same set.
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
      <KanbanBoard>
        {STATUS_ORDER.map((status) => {
          const lane = cards.filter((card) => card.status === status);
          const laneTotal = counts.get(status) ?? 0;
          return (
            <KanbanColumn
              key={status}
              icon={
                /* §16 · the stage is never carried by colour alone. Each lane
                   takes its own mark from the icon registry, keyed off the
                   real `InquiryStatus` value — so CLOSED and LOST, which a
                   person has to act on differently, are two shapes rather
                   than two shades. `aria-hidden`, because the heading beside
                   it already says the name. */
                <Icon
                  name={INQUIRY_STATUS_ICON[status]}
                  size={16}
                  className="translate-y-px text-graphite"
                />
              }
              label={STATUS_LABELS[status]}
              count={laneTotal}
              empty={lane.length === 0}
            >
              {lane.map((card) => (
                <li key={card.id}>
                  <CommissionCardBody
                    card={card}
                    busy={pending && busyId === card.id}
                    onMove={(next) => move(card, next)}
                  />
                </li>
              ))}
            </KanbanColumn>
          );
        })}
      </KanbanBoard>
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
    <KanbanCardShell busy={busy}>
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
          <p className="flex items-center gap-1.5 u-micro">
            {card.number}
            {card.isDemo && <DemoBadge />}
          </p>
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

        {/* The keyboard-and-pointer path for moving a card between lanes —
            the shared `KanbanMoveSelect`: a native select, reachable with a
            single Tab, working on a phone. */}
        <KanbanMoveSelect
          value={card.status}
          options={MOVE_OPTIONS}
          disabled={busy}
          onMove={onMove}
          ariaLabel={`Stage for ${card.customerName}’s commission`}
        />

        {/* Reply and move in one act (plan §3 S3). The stage select beside it
            stays the way to move a card WITHOUT replying — this button only
            ever makes the first move, NEW → Contacted, so it cannot undo a
            stage the owner set by hand. */}
        <WhatsAppReplyButton
          inquiry={card}
          variant="ghost"
          size="icon"
          iconOnly
          className="ms-auto min-h-9 min-w-9"
        />
      </div>
    </KanbanCardShell>
  );
}
