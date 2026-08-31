import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

import { requireStaff } from "@/actions/helpers";

/**
 * Staff draft-preview switch (ENG-802 / audit C2).
 *
 * Public catalog pages used to read a `?preview=1` searchParam, which forced
 * every request — including every normal visitor's — into dynamic rendering
 * and silently killed their declared ISR. Draft visibility now rides Next's
 * draft-mode cookie instead: this handler is the only place that mints it,
 * and it does so only for a verified staff session (same DB-revalidated
 * guard as the other staff route handlers). Pages just read
 * `draftMode().isEnabled`, which is ISR-safe.
 *
 *   GET /api/draft?redirect=/blog/my-post      → enable draft mode (staff only)
 *   GET /api/draft?redirect=/blog/my-post&disable=1 → drop the cookie (anyone)
 *
 * `redirect` must be a same-origin path ("/…", never "//…" or "/\…") so the
 * handler can't be used as an open redirect.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  const requested = url.searchParams.get("redirect") ?? "/";
  const target =
    requested.startsWith("/") &&
    !requested.startsWith("//") &&
    !requested.startsWith("/\\")
      ? requested
      : "/";

  const draft = await draftMode();

  // Leaving preview needs no auth — clearing the bypass cookie is harmless
  // and lets a signed-out browser stop seeing drafts.
  if (url.searchParams.get("disable") === "1") {
    draft.disable();
    redirect(target);
  }

  try {
    await requireStaff();
  } catch {
    // No (valid) staff session — never mint the bypass cookie.
    redirect("/studio/login");
  }

  draft.enable();
  redirect(target);
}
