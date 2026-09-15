"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  continueScrapeJob,
} from "@/actions/scraper-jobs";
import type { ScrapeJobSnapshot } from "@/lib/scraper/job-runner";

/**
 * The scrape runner as one module-scoped store, shared by every screen under
 * `/studio/scraper`.
 *
 * Before this, `job-dashboard.tsx` and `source-detail.tsx` each kept their
 * OWN poll-until-finished loop in component refs. That meant a run had to
 * live and die with whichever page started it — navigate from the source
 * detail page back to the dashboard mid-scrape and the loop that was ticking
 * it forward simply stopped (the component holding it unmounted), leaving a
 * job stuck RUNNING until the stale-reclaim window opened it back up.
 *
 * Lifting the queue, the active job id and every job's latest snapshot into
 * a module store — read via `useSyncExternalStore`, never a synchronous
 * `setState` in an effect — means the loop is a property of the scraper
 * section, not of whichever component happened to start it. `layout.tsx`
 * mounts `<ScrapeRunnerProvider>` once, above every route under
 * `/studio/scraper`, so the loop survives navigation between them.
 */

type RunnerState = {
  /** Job ids waiting their turn, FIFO, not counting the one running now. */
  queue: string[];
  /** The job currently being polled, or null between jobs / when idle. */
  activeJobId: string | null;
  /** Latest known snapshot per job id — accumulates, never pruned here. */
  snapshots: Record<string, ScrapeJobSnapshot>;
  /** Bumped every time a job leaves the queue (DONE, FAILED, or an error) —
   *  the provider watches this to know when to `router.refresh()`. */
  finishedTick: number;
};

const EMPTY_STATE: RunnerState = {
  queue: [],
  activeJobId: null,
  snapshots: {},
  finishedTick: 0,
};

let state: RunnerState = EMPTY_STATE;
const listeners = new Set<() => void>();
/** Every id ever queued this session — enqueue() is a no-op for a repeat. */
const seen = new Set<string>();
let pumping = false;

function emit() {
  for (const listener of listeners) listener();
}

function patch(next: Partial<RunnerState>) {
  state = { ...state, ...next };
  emit();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot(): RunnerState {
  return EMPTY_STATE;
}

/** One job to completion — identical loop to the pre-extraction component
 *  version: poll `continueScrapeJob`, record the snapshot, stop on a
 *  terminal status or an error, otherwise wait 800ms and poll again. */
async function runJob(jobId: string): Promise<void> {
  for (;;) {
    const res = await continueScrapeJob(jobId);
    if (!res.ok || !res.data) {
      toast.error(!res.ok ? res.error : "Scrape run failed.");
      return;
    }
    const snap = res.data;
    patch({ snapshots: { ...state.snapshots, [jobId]: snap } });
    if (snap.status === "DONE") {
      toast.success(
        `Scrape finished — ${snap.totalScraped} products (${snap.newCount} new, ${snap.updatedCount} updated).`,
      );
      return;
    }
    if (snap.status === "FAILED") {
      toast.error(snap.error ?? "Scrape failed.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    let next = state.queue[0];
    while (next !== undefined) {
      const jobId = next;
      patch({ activeJobId: jobId, queue: state.queue.slice(1) });
      await runJob(jobId);
      seen.delete(jobId);
      patch({ finishedTick: state.finishedTick + 1 });
      next = state.queue[0];
    }
  } finally {
    pumping = false;
    patch({ activeJobId: null });
  }
}

/** Queue jobs for the runner. Already-queued or already-running ids are
 *  skipped — a double click on "Resume" must not double-poll a job. */
export function enqueueScrapeJobs(jobIds: string[]): void {
  const additions = jobIds.filter((id) => !seen.has(id));
  if (additions.length === 0) return;
  for (const id of additions) seen.add(id);
  patch({ queue: [...state.queue, ...additions] });
  void pump();
}

export type ScrapeRunnerState = {
  /** The job id currently being polled, or null when idle. */
  activeJobId: string | null;
  /** Jobs waiting behind the active one. */
  queueSize: number;
  /** Latest snapshot per job id this session has touched. */
  snapshots: Record<string, ScrapeJobSnapshot>;
  /** True while anything is queued or running — the unload guard reads this. */
  isRunning: boolean;
  enqueue: (jobIds: string[]) => void;
};

/** Read side. Every screen under /studio/scraper calls this instead of
 *  keeping its own poll loop. */
export function useScrapeRunner(): ScrapeRunnerState {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const enqueue = useCallback(
    (jobIds: string[]) => enqueueScrapeJobs(jobIds),
    [],
  );
  return {
    activeJobId: snap.activeJobId,
    queueSize: snap.queue.length,
    snapshots: snap.snapshots,
    isRunning: snap.activeJobId !== null || snap.queue.length > 0,
    enqueue,
  };
}

/**
 * Mounted once, in `scraper/layout.tsx`, above every route the section owns.
 * Two jobs that no per-page component can do on its own: refresh the current
 * route's server data whenever a job in the shared queue finishes (so
 * whichever screen is open reflects it, exactly as the old per-page
 * `router.refresh()` did), and warn before an unload drops an active run.
 */
export function ScrapeRunnerProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isRunning } = useScrapeRunner();
  const tick = useSyncExternalStore(
    subscribe,
    () => state.finishedTick,
    () => 0,
  );
  const lastTick = useRef(tick);

  useEffect(() => {
    if (tick !== lastTick.current) {
      lastTick.current = tick;
      router.refresh();
    }
  }, [tick, router]);

  useEffect(() => {
    if (!isRunning) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Chrome requires this legacy assignment; the shown text is browser-chosen.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRunning]);

  return children;
}
