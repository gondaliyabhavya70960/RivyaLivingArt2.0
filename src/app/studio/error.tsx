"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the /studio AUTH tree — login, signup, forgot-password,
 * reset-password.
 *
 * Those four routes sit directly under `src/app/studio/`, NOT inside the
 * `(dashboard)` group, so `(dashboard)/error.tsx` never covered them: a
 * failure while signing in — a flaky database on the credentials lookup, say —
 * bubbled all the way to the global boundary and answered in the storefront's
 * dark public voice. Staff trying to get in were told "this piece isn't here"
 * with a WhatsApp button.
 *
 * This is the same contract as the dashboard boundary, minus the admin chrome
 * (there is none to stay inside on a sign-in screen): the light ground, a
 * retry, a way back, and the `digest` SHOWN rather than only logged, so a
 * locked-out owner has a reference to quote.
 *
 * Nested boundaries win, so `(dashboard)` keeps its own and nothing here
 * changes for the 30 admin screens.
 */
export default function StudioAuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Studio auth route failed:", error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-lg rounded-card border border-border bg-card p-8 text-center">
        <p className="u-micro text-muted-foreground">STUDIO</p>
        <h1 className="mt-3 font-display text-2xl text-foreground">
          Sign-in is unavailable
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Something went wrong reaching the studio. This is usually temporary —
          try again, and if it keeps happening the reference below will be in
          the server log.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/studio/login">Back to sign in</Link>
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
