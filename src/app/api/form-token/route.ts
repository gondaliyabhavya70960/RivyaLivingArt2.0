import { headers } from "next/headers";

import { issueFormToken } from "@/lib/form-token";
import { clientIp, rateLimit, retryAfterHeaders } from "@/lib/rate-limit";

/**
 * Issues the signed form-mount timestamp the public forms send back with
 * their submissions (S-06 — see src/lib/form-token.ts). Cheap and
 * unauthenticated by design, but never cacheable (a shared cached token
 * would defeat the fill-time measurement) and coarsely rate-limited so it
 * can't be farmed.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const ip = clientIp(await headers());
  const limited = rateLimit(`form-token:${ip}`, {
    limit: 120,
    windowMs: 600_000,
  });
  // 429 with `Retry-After`, and DELIBERATELY with no body that distinguishes
  // it from any other failure the client sees. 120 tokens per ten minutes is
  // far above any human filling forms, so a throttled caller here is a script
  // or a large shared NAT; telling the first one which of the spam checks it
  // tripped is the oracle `passesSpamChecks`'s generic copy exists to withhold.
  // `use-form-token.ts` therefore treats this exactly like a network blip —
  // the submit that follows fails the min-fill check once and the retry works.
  if (!limited.ok) {
    return new Response(null, {
      status: 429,
      headers: retryAfterHeaders(limited.retryAfterSeconds),
    });
  }

  return Response.json(
    { token: issueFormToken() },
    { headers: { "cache-control": "no-store" } },
  );
}
