import type { ReactNode } from "react";

import { ScrapeRunnerProvider } from "@/hooks/use-scrape-runner";

/**
 * Mounts the shared scrape runner once, above every route this section owns
 * (`/studio/scraper`, `/sources/[key]`, `/review`, `/quality`, `/mapping`).
 * A layout persists across navigation between its own child routes, which is
 * the whole point: a run started from the dashboard or from a source's own
 * page keeps polling while the operator moves between them, instead of dying
 * with whichever component happened to start it.
 */
export default function ScraperSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ScrapeRunnerProvider>{children}</ScrapeRunnerProvider>;
}
