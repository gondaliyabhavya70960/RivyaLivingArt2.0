import {
  CircleCheck,
  CircleX,
  Clock,
  Globe,
  Inbox,
  Package,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ScraperKpiData = {
  websites: number;
  enabled: number;
  scraped: number;
  failed: number;
  notRun: number;
  empty: number;
  staged: number;
  pending: number;
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-12 font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon aria-hidden className={cn("size-4", tone)} />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-0.5 min-h-4 text-xs text-muted-foreground">{sub ?? ""}</p>
    </div>
  );
}

/** KPI strip for the Product Scraper command center. */
export function ScraperKpis({ kpis }: { kpis: ScraperKpiData }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Websites"
        value={kpis.websites}
        sub={`${kpis.enabled} enabled`}
        icon={Globe}
        tone="text-sapphire-ink"
      />
      <StatCard
        label="Scraped"
        value={kpis.scraped}
        sub="have products"
        icon={CircleCheck}
        tone="text-success"
      />
      <StatCard
        label="Failed"
        value={kpis.failed}
        sub={kpis.empty > 0 ? `+ ${kpis.empty} came back empty` : "last run errored"}
        icon={CircleX}
        tone="text-destructive"
      />
      <StatCard
        label="Not run"
        value={kpis.notRun}
        sub="never scraped"
        icon={Clock}
        tone="text-muted-foreground"
      />
      <StatCard
        label="Products staged"
        value={kpis.staged}
        sub="across all sources"
        icon={Package}
        tone="text-sapphire-ink"
      />
      <StatCard
        label="Pending review"
        value={kpis.pending}
        sub="awaiting approval"
        icon={Inbox}
        tone="text-warning"
      />
    </div>
  );
}
