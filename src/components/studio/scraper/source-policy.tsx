"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";

import {
  setSourceAnalyticsLeague,
  setSourceCollectionMode,
  setSourcePolicyReview,
} from "@/actions/scraper-sources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  AnalyticsLeague,
  CollectionMode,
  PolicyReviewStatus,
} from "@/generated/prisma/enums";
import {
  ANALYTICS_LEAGUE_DESCRIPTIONS,
  ANALYTICS_LEAGUE_LABELS,
} from "@/lib/scraper/leagues";
import {
  COLLECTION_MODE_LABELS,
  POLICY_REVIEW_LABELS,
  describeUnauthorizedRun,
} from "@/lib/scraper/policy";

export type SourcePolicyInfo = {
  id: string;
  name: string;
  collectionMode: CollectionMode;
  analyticsLeague: AnalyticsLeague;
  policyReviewStatus: PolicyReviewStatus;
  policyReviewedAt: string | null;
  policyReviewedBy: string | null;
  policyReviewNote: string | null;
};

const STATUS_ICON: Record<
  PolicyReviewStatus,
  typeof ShieldCheck
> = {
  PENDING: ShieldQuestion,
  APPROVED: ShieldCheck,
  BLOCKED: ShieldAlert,
};

/**
 * The only control that clears the governance gate.
 *
 * It states the refusal in the same words the Scrape button will use — the
 * message comes from `describeUnauthorizedRun`, not from a second copy written
 * for the UI — so an owner reading this card already knows exactly what they
 * would be told if they pressed Scrape, and why.
 */
export function SourcePolicy({ source }: { source: SourcePolicyInfo }) {
  const router = useRouter();
  const [note, setNote] = useState(source.policyReviewNote ?? "");
  const [busy, setBusy] = useState(false);

  const refusal = describeUnauthorizedRun(source.name, source);
  const Icon = STATUS_ICON[source.policyReviewStatus];

  async function record(status: PolicyReviewStatus) {
    setBusy(true);
    const res = await setSourcePolicyReview([source.id], status, note.trim());
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      status === "PENDING"
        ? `Review withdrawn for ${source.name}.`
        : `Review recorded for ${source.name}.`,
    );
    router.refresh();
  }

  async function changeMode(mode: CollectionMode) {
    setBusy(true);
    const res = await setSourceCollectionMode(source.id, mode);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function changeLeague(league: AnalyticsLeague) {
    setBusy(true);
    const res = await setSourceAnalyticsLeague(source.id, league);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${source.name} now competes in ${ANALYTICS_LEAGUE_LABELS[league]}.`,
    );
    router.refresh();
  }

  return (
    <section
      aria-labelledby="source-policy-heading"
      className="mb-6 rounded-lg border border-hairline p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Icon aria-hidden className="size-4 text-muted-foreground" />
        <h2 id="source-policy-heading" className="text-sm font-medium">
          Collection policy
        </h2>
        <Badge variant={refusal ? "outline" : "default"}>
          {POLICY_REVIEW_LABELS[source.policyReviewStatus]}
        </Badge>
        <Badge variant="outline">
          {COLLECTION_MODE_LABELS[source.collectionMode]}
        </Badge>
        <Badge variant="outline">
          {ANALYTICS_LEAGUE_LABELS[source.analyticsLeague]}
        </Badge>
      </div>

      <p
        role="status"
        className="mb-4 max-w-prose text-sm text-muted-foreground"
      >
        {refusal ??
          "Automated collection is allowed. Withdraw the review if this site's terms change."}
      </p>

      {source.policyReviewedAt && (
        <p className="mb-4 text-xs text-muted-foreground">
          Reviewed {source.policyReviewedAt}
          {source.policyReviewedBy ? ` by ${source.policyReviewedBy}` : ""}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="policy-note">
            What the robots rules and terms said
          </Label>
          <Textarea
            id="policy-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="robots.txt allows /products; terms permit non-commercial research…"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => record("APPROVED")}>
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Record: allowed
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => record("BLOCKED")}
            >
              Record: not allowed
            </Button>
            {source.policyReviewStatus !== "PENDING" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => record("PENDING")}
              >
                Withdraw review
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:max-w-xs">
          <div className="grid gap-2">
            <Label htmlFor="collection-mode">How it may be collected</Label>
            <Select
              value={source.collectionMode}
              onValueChange={(value) => changeMode(value as CollectionMode)}
              disabled={busy}
            >
              <SelectTrigger id="collection-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HTTP">
                  {COLLECTION_MODE_LABELS.HTTP}
                </SelectItem>
                <SelectItem value="MANUAL_RESEARCH">
                  {COLLECTION_MODE_LABELS.MANUAL_RESEARCH}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Manual research means nothing here will ever fetch this site,
              whatever the review says.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="analytics-league">Which market it sells into</Label>
            <Select
              value={source.analyticsLeague}
              onValueChange={(value) => changeLeague(value as AnalyticsLeague)}
              disabled={busy}
            >
              <SelectTrigger id="analytics-league">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FINISHED_ART">
                  {ANALYTICS_LEAGUE_LABELS.FINISHED_ART}
                </SelectItem>
                <SelectItem value="MATERIALS_DIY">
                  {ANALYTICS_LEAGUE_LABELS.MATERIALS_DIY}
                </SelectItem>
                <SelectItem value="MARKETPLACE_B2B">
                  {ANALYTICS_LEAGUE_LABELS.MARKETPLACE_B2B}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ANALYTICS_LEAGUE_DESCRIPTIONS[source.analyticsLeague]}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
