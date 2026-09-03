import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Studio-scoped 404 (ENG-803): a missing entity (e.g. an edit link to a
 * deleted product) stays inside the admin chrome instead of falling through
 * to the public dark 404.
 */
export default function StudioNotFound() {
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-lg flex-col items-center justify-center text-center">
      <div className="w-full rounded-card border border-border bg-card p-8 shadow-e1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Studio
        </p>
        <h1 className="mt-3 font-display text-2xl text-foreground">
          Not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This item may have been deleted or moved.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/studio">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
