"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Studio-scoped error boundary (ENG-803). Keeps a transient failure (e.g. a
 * flaky Neon query) inside the light admin chrome with a retry, instead of
 * bubbling to the public-voice dark global-error page and stranding staff.
 *
 * It now SHOWS the reference code. Next puts a `digest` on every production
 * error and this boundary logged it to the console — where the owner, who is
 * not holding devtools open, never saw it. So "the products page broke" was
 * all anyone could report, and nothing tied it to a server log. The digest is
 * on screen and selectable; the console line stays for whoever does have
 * devtools open.
 */
export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Studio route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60svh] max-w-lg flex-col items-center justify-center text-center">
      <div className="w-full rounded-card border border-border bg-card p-8 shadow-e1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Studio
        </p>
        <h1 className="mt-3 font-display text-2xl text-foreground">
          This page didn’t load
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Something went wrong fetching this screen. This is usually temporary —
          try again, and if it keeps happening, reload the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/studio">Back to dashboard</Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="mt-6 border-t border-border pt-4 font-mono text-12 tracking-[0.08em] text-muted-foreground">
            Reference {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
