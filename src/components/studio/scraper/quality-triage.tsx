"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setFailureStatus } from "@/actions/scraper-quality";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/studio/page-header";

export type QualityGroup = {
  field: string;
  severity: string;
  count: number;
  samples: { id: string; reason: string; sourceKey: string }[];
};

/**
 * Triage by root cause.
 *
 * Every action here is per-FIELD, because a backlog of thousands is a handful
 * of causes repeated — one adapter that stopped finding prices, one source
 * that never had descriptions. Resolving them one row at a time is not triage,
 * it is data entry.
 *
 * Nothing closes itself. The scrape resolves a failure only when the field
 * starts extracting again, which is a fact rather than a judgement; every
 * other transition is somebody deciding.
 */
export function QualityTriage({
  groups,
  sources,
  openTotal,
}: {
  groups: QualityGroup[];
  sources: { sourceKey: string; count: number }[];
  openTotal: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(field: string, status: "RESOLVED" | "IGNORED") {
    setBusy(`${field}:${status}`);
    const res = await setFailureStatus({ field, status });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const n = res.data?.updated ?? 0;
    toast.success(
      status === "RESOLVED"
        ? `Resolved ${n} ${field} failure${n === 1 ? "" : "s"}.`
        : `Ignoring ${n} ${field} failure${n === 1 ? "" : "s"} — they stay out of the backlog until they change.`,
    );
    router.refresh();
  }

  if (openTotal === 0) {
    return (
      <EmptyState
        title="Nothing outstanding"
        description="Every field the scraper checks came back populated. New failures appear here as scrapes run."
      />
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        <span className="u-num font-medium text-foreground">
          {openTotal.toLocaleString("en-IN")}
        </span>{" "}
        open across {groups.length} field{groups.length === 1 ? "" : "s"}.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group.field}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="flex items-center gap-2 font-medium text-foreground">
                {group.field}
                {group.severity === "ERROR" && (
                  <Badge variant="alert">
                    unusable
                  </Badge>
                )}
              </h2>
              <p className="text-25 font-semibold tabular-nums text-foreground">
                {group.count.toLocaleString("en-IN")}
              </p>
            </div>

            {group.samples[0] && (
              <p className="mt-1 text-sm text-muted-foreground">
                {group.samples[0].reason}
              </p>
            )}

            <ul className="mt-3 space-y-1">
              {group.samples.slice(0, 5).map((s) => (
                <li key={s.id} className="truncate font-mono text-12 text-graphite">
                  {s.sourceKey}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void act(group.field, "RESOLVED")}
              >
                {busy === `${group.field}:RESOLVED` ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <CheckCircle2 aria-hidden />
                )}
                Resolve all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => void act(group.field, "IGNORED")}
              >
                {busy === `${group.field}:IGNORED` ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <EyeOff aria-hidden />
                )}
                Ignore
              </Button>
            </div>
          </section>
        ))}
      </div>

      {sources.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-medium text-foreground">Worst sources</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A source at the top of this list usually means one broken adapter,
            not a hundred broken products.
          </p>
          <ul className="mt-3 space-y-1">
            {sources.map((s) => (
              <li key={s.sourceKey} className="flex justify-between text-sm">
                <span className="font-mono text-12 text-graphite">
                  {s.sourceKey}
                </span>
                <span className="tabular-nums text-foreground">
                  {s.count.toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
