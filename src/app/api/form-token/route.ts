import { headers } from "next/headers";

import { issueFormToken } from "@/lib/form-token";
import { clientIp, rateLimit } from "@/lib/rate-limit";

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
  if (!limited.ok) return new Response(null, { status: 429 });

  return Response.json(
    { token: issueFormToken() },
    { headers: { "cache-control": "no-store" } },
  );
}
