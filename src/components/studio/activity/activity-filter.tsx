"use client";

import { useRouter } from "next/navigation";

import type { ActivityActor } from "@/lib/activity-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "ALL";

/**
 * Filter links for the activity log. Both filters live in the query string, so
 * a filtered view is a URL an owner can bookmark or send.
 *
 * `page` is deliberately dropped whenever a filter changes — a filtered page 7
 * rarely exists, and landing on an empty one reads as "nothing happened".
 */
function href(entity: string | undefined, actor: string | undefined): string {
  const params = new URLSearchParams();
  if (entity) params.set("entity", entity);
  if (actor) params.set("actor", actor);
  const qs = params.toString();
  return qs ? `/studio/activity?${qs}` : "/studio/activity";
}

export function ActivityFilters({
  entities,
  actors,
  entity,
  actor,
}: {
  entities: string[];
  actors: ActivityActor[];
  entity?: string;
  actor?: string;
}) {
  const router = useRouter();

  // A stale param — an entity that no longer appears in any log, a staff member
  // since removed — falls back to "all" rather than showing a blank trigger.
  const currentEntity = entity && entities.includes(entity) ? entity : ALL;
  const currentActor =
    actor && actors.some((a) => a.id === actor) ? actor : ALL;

  const asParam = (value: string) => (value === ALL ? undefined : value);

  return (
    <>
      <Select
        value={currentEntity}
        onValueChange={(value) =>
          router.replace(href(asParam(value), asParam(currentActor)))
        }
      >
        <SelectTrigger className="w-44" aria-label="Filter by entity">
          <SelectValue placeholder="All entities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All entities</SelectItem>
          {entities.map((value) => (
            <SelectItem key={value} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentActor}
        onValueChange={(value) =>
          router.replace(href(asParam(currentEntity), asParam(value)))
        }
      >
        <SelectTrigger className="w-52" aria-label="Filter by who did it">
          <SelectValue placeholder="Everyone" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Everyone</SelectItem>
          {actors.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
