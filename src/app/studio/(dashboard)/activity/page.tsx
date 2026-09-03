import type { Metadata } from "next";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ActivityFilters } from "@/components/studio/activity/activity-filter";
import {
  SYSTEM_ACTOR,
  type ActivityActor,
} from "@/lib/activity-filter";
import { EmptyState, PageHeader } from "@/components/studio/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity" };

const PAGE_SIZE = 50;

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * The day separator. Same locale and same (server) time zone as the timestamps
 * beside it, so a row can never appear under a day its own "When" contradicts.
 */
const dayFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "full" });

type BadgeVariant = "default" | "secondary" | "outline";

function actionVariant(action: string): BadgeVariant {
  if (action.includes("delete")) return "outline";
  if (action === "create" || action === "publish") return "default";
  if (action === "reset-password" || action === "update-role") return "default";
  return "secondary";
}

function compactMeta(meta: unknown): string {
  const str = JSON.stringify(meta);
  if (!str || str === "{}" || str === "null") return "—";
  return str.length > 80 ? `${str.slice(0, 80)}…` : str;
}

function truncateId(id: string | null): string {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}

/** Next gives a repeated query key as an array; take the first occurrence. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(
  entity: string | undefined,
  actor: string | undefined,
  page: number,
): string {
  const params = new URLSearchParams();
  if (entity) params.set("entity", entity);
  if (actor) params.set("actor", actor);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/studio/activity?${qs}` : "/studio/activity";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    entity?: string | string[];
    actor?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  // Next resolves a REPEATED query key to an array. Typed as a bare string it
  // would be spread into the Prisma filter as one, and `?actor=a&actor=b`
  // would throw PrismaClientValidationError out of the render instead of
  // showing a page.
  const rawEntity = first(params.entity);
  const rawActor = first(params.actor);
  const requestedPage = Math.max(
    1,
    Number.parseInt(first(params.page) ?? "1", 10) || 1,
  );

  // The facets come FIRST, because the filters have to be validated against
  // them before they reach a query. Filtering on a value the UI then reports
  // as absent is how an audit log ends up claiming it is empty.
  const [entityGroups, actorGroups] = await Promise.all([
    db.activityLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } }),
    db.activityLog.groupBy({ by: ["userId"], orderBy: { userId: "asc" } }),
  ]);

  const entities = entityGroups.map((group) => group.entity);

  /**
   * Who appears anywhere in the log.
   *
   * `ActivityLog.user` is `onDelete: SetNull`, so removing a staff member turns
   * every entry they ever made into a null userId — indistinguishable from a
   * genuine system action. "System" here therefore means "no signed-in user
   * recorded", which is weaker than it sounds. Fixing that would mean a schema
   * change, which this pass does not make.
   */
  const actorIds = actorGroups
    .map((group) => group.userId)
    .filter((id): id is string => id !== null);
  const actorUsers = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      })
    : [];
  const actors: ActivityActor[] = [
    ...actorUsers.map((u) => ({ id: u.id, label: u.name ?? u.email })),
    ...(actorGroups.some((group) => group.userId === null)
      ? [{ id: SYSTEM_ACTOR, label: "System" }]
      : []),
  ];

  // Validated, and only now allowed near a query. An id that no longer appears
  // in the log — a staff member since deleted, a mistyped or stale bookmark —
  // resolves to "no filter" in the WHERE clause and in every affordance that
  // describes it, so the two can no longer disagree.
  const actor = rawActor && actors.some((a) => a.id === rawActor)
    ? rawActor
    : undefined;
  const entity = rawEntity && entities.includes(rawEntity)
    ? rawEntity
    : undefined;

  const actorLabel = actor
    ? (actors.find((a) => a.id === actor)?.label ?? null)
    : null;

  // `userId: null` is a real filter value, not "no filter" — hence the
  // sentinel. Note the table is indexed on (entity, createdAt) and not on
  // userId, so an actor filter scans; that matches what the entity groupBy and
  // the count already do, and an index is a migration this pass does not make.
  const where = {
    ...(entity ? { entity } : {}),
    ...(actor ? { userId: actor === SYSTEM_ACTOR ? null : actor } : {}),
  };

  const total = await db.activityLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamped, not just floored. An unclamped page past the end returned an empty
  // slice that reads exactly like an empty log, under a pager printing an
  // impossible "Page 9 of 3".
  const pageNum = Math.min(requestedPage, totalPages);

  const logs = await db.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (pageNum - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { user: { select: { name: true, email: true } } },
  });

  const rows = logs.map((log) => ({
    id: log.id,
    day: dayFormatter.format(log.createdAt),
    when: dateFormatter.format(log.createdAt),
    userName: log.user?.name ?? null,
    userEmail: log.user?.email ?? null,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    meta: compactMeta(log.meta),
  }));

  /**
   * Rows bucketed into consecutive days. The query is already sorted newest
   * first, so a single pass is enough and the order the owner sees is the order
   * the database returned — no client-side re-sort to disagree with the pager.
   */
  const days: { day: string; rows: typeof rows }[] = [];
  for (const row of rows) {
    const last = days.at(-1);
    if (last?.day === row.day) last.rows.push(row);
    else days.push({ day: row.day, rows: [row] });
  }

  return (
    <>
      <PageHeader
        title="Activity"
        description="A read-only audit trail of everything staff have changed in the studio."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ActivityFilters
          entities={entities}
          actors={actors}
          entity={entity}
          actor={actor}
        />
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString("en-IN")} {total === 1 ? "entry" : "entries"}
          {entity ? ` for ${entity}` : ""}
          {actorLabel ? ` by ${actorLabel}` : ""}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description={
            entity || actorLabel
              ? "Nothing matches these filters. Try another entity or actor, or clear them."
              : "Actions taken in the studio — creates, updates, deletes — will show up here."
          }
        />
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Activity log"
          className="overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <table className="w-full text-sm">
            <thead>
              <StudioTableHead>
                <th scope="col" className="px-4 py-3 font-medium">
                  When
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  User
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Action
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Entity
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Entity ID
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Meta
                </th>
              </StudioTableHead>
            </thead>
            {days.map((group, groupIndex) => (
              <tbody key={group.day}>
                <tr>
                  {/* scope="rowgroup": this heading labels the rest of its own
                      tbody, which is exactly what a day separator does.

                      border-t on every group but the first, because StudioRow's
                      `last:border-0` is scoped to its parent — with one tbody
                      per day it now fires at every boundary, so the last row of
                      each day has no rule under it and this header must supply
                      one. The first group is exempt: the thead already draws
                      there and two rules would stack. */}
                  <th
                    scope="rowgroup"
                    colSpan={6}
                    className={cn(
                      "u-micro border-b border-border bg-foreground/5 px-4 py-2 text-start font-normal",
                      groupIndex > 0 && "border-t border-border",
                    )}
                  >
                    {group.day}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <StudioRow key={row.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {row.when}
                    </td>
                    <td className="px-4 py-3">
                      {row.userName ? (
                        <>
                          <p className="font-medium text-foreground">
                            {row.userName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.userEmail}
                          </p>
                        </>
                      ) : (
                        <span className="italic text-muted-foreground">
                          system
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={actionVariant(row.action)}>
                        {row.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.entity}</td>
                    <td
                      className="px-4 py-3 font-mono text-xs text-muted-foreground"
                      title={row.entityId ?? undefined}
                    >
                      {truncateId(row.entityId)}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <code className="block truncate font-mono text-xs text-muted-foreground">
                        {row.meta}
                      </code>
                    </td>
                  </StudioRow>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Page {pageNum.toLocaleString("en-IN")} of{" "}
          {totalPages.toLocaleString("en-IN")}
        </p>
        <div className="flex items-center gap-2">
          {pageNum > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(entity, actor, pageNum - 1)} rel="prev">
                <ChevronLeft /> Prev
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft /> Prev
            </Button>
          )}
          {pageNum < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(entity, actor, pageNum + 1)} rel="next">
                Next <ChevronRight />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next <ChevronRight />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
