"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setProductsStatus } from "@/actions/products";
import {
  KanbanBoard,
  KanbanCardShell,
  KanbanColumn,
  KanbanMoveSelect,
} from "@/components/studio/kanban";
import {
  PRODUCT_KANBAN_STATUSES,
  PRODUCT_MOVE_OPTIONS,
  PRODUCT_STATUS_LABEL,
  describeMoveToast,
} from "@/components/studio/products/products-kanban-model";
import type { ProductRow } from "@/components/studio/products/product-list";
import type { ContentStatus } from "@/generated/prisma/enums";
import { Icon } from "@/components/icons";
import { CONTENT_STATUS_ICON } from "@/components/icons/status";
import { DemoBadge } from "@/components/studio/demo-badge";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { SIZE_TIER_SHORT, SIZE_TIER_NAME } from "@/lib/product-size-tier";
import { formatPriceBand } from "@/lib/utils";

/**
 * The products board — KANBAN-SPEC Board 2.
 *
 * Four lanes, the four real statuses. The table stays the default view and
 * keeps the complete bulk system; the board is the visual workflow read —
 * what sits where, and the one-card move. Cards are compact on purpose:
 * they link to the full editor rather than recreating it (the prompt's own
 * rule).
 *
 * **Guards are the menu's job description.** Every card may attempt every
 * status; `setProductsStatus` applies the publish guards (scraped rewrite,
 * product tier, concept placeholder, photograph) and reports each refusal
 * by name — the toast then says exactly why, which is the prompt's "show
 * exactly why" rather than a silently dead card.
 *
 * **No bulk selection here.** The table (which remains) owns the full
 * Gmail-pattern bulk system. A second, differently-scoped selection model on
 * the board is its own change with its own tests, not something to slip into
 * a view PR.
 */
export function ProductsKanban({
  lanes,
  counts,
  laneCap,
}: {
  lanes: Record<ContentStatus, ProductRow[]>;
  /** True per-status totals — lanes render a capped slice. */
  counts: Record<ContentStatus, number>;
  /** The per-lane cap the server applied; a note shows when any lane exceeds it. */
  laneCap: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const truncated = PRODUCT_KANBAN_STATUSES.some(
    (status) => (counts[status] ?? 0) > (lanes[status]?.length ?? 0),
  );

  const move = (card: ProductRow, next: ContentStatus) => {
    if (next === card.status) return;
    setBusyId(card.id);
    startTransition(async () => {
      const result = await setProductsStatus([card.id], next);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const report = result.data ?? {
        updated: 0,
        skippedRewrite: 0,
        skippedUntiered: 0,
        skippedPlaceholder: 0,
        skippedNoImage: 0,
      };
      const toast_ = describeMoveToast(next, card.title, report);
      if (toast_.kind === "warning") toast.warning(toast_.message);
      else toast.success(toast_.message);
      router.refresh();
    });
  };

  return (
    <div>
      {truncated && (
        <p className="u-micro mb-3">
          SHOWING THE {laneCap} MOST RECENTLY UPDATED PER LANE · TRUE COUNTS ON
          THE HEADERS
        </p>
      )}
      <KanbanBoard>
        {PRODUCT_KANBAN_STATUSES.map((status) => {
          const lane = lanes[status] ?? [];
          return (
            <KanbanColumn
              key={status}
              icon={
                <Icon
                  name={CONTENT_STATUS_ICON[status]}
                  size={16}
                  className="translate-y-px text-graphite"
                />
              }
              label={PRODUCT_STATUS_LABEL[status]}
              count={counts[status] ?? 0}
              empty={lane.length === 0}
            >
              {lane.map((card) => (
                <li key={card.id}>
                  <ProductKanbanCard
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

function ProductKanbanCard({
  card,
  busy,
  onMove,
}: {
  card: ProductRow;
  busy: boolean;
  onMove: (next: ContentStatus) => void;
}) {
  return (
    <KanbanCardShell busy={busy}>
      <div className="flex items-start gap-3">
        {/* Cover — the first gallery image, or the empty ground when the row
            has none (the photograph guard's worklist reads it at a glance). */}
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
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <h4 className="truncate text-small font-medium text-foreground">
            <Link
              href={`/studio/products/${card.id}`}
              title={card.title}
              className="rounded-input underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
            >
              {card.title}
            </Link>
          </h4>
          <p className="truncate text-small text-graphite">
            {card.categoryName}
          </p>
        </div>
      </div>

      {/* The workflow markers — flags, never lanes. Untiered and rewrite
          are publish blockers; the empty cover is the photograph guard's. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {card.isDemo && <DemoBadge />}
        {card.needsRewrite && <Badge variant="warning">needs rewrite</Badge>}
        {card.sizeTier ? (
          <span
            className="text-12 text-graphite"
            title={SIZE_TIER_NAME[card.sizeTier]}
          >
            {SIZE_TIER_SHORT[card.sizeTier]}
          </span>
        ) : (
          <Badge variant="secondary">No tier yet</Badge>
        )}
        {!card.inStock && <Badge variant="secondary">Out of stock</Badge>}
        <span className="u-num ms-auto text-12 text-graphite">
          {formatPriceBand(card.priceMin, card.priceMax)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="u-num text-12 text-graphite">{card.updatedAt}</span>
        <KanbanMoveSelect
          value={card.status}
          options={PRODUCT_MOVE_OPTIONS}
          disabled={busy}
          onMove={onMove}
          ariaLabel={`Status for ${card.title}`}
        />
      </div>
    </KanbanCardShell>
  );
}
