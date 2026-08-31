/**
 * Content-Security-Policy violation sink (SEC-103). The CSP ships in
 * report-only mode (next.config.ts); browsers POST violations here so we can
 * watch the Vercel runtime logs for a clean stream before flipping the header
 * to enforcing. Accepts both the legacy `application/csp-report` body and the
 * newer Reporting-API `application/reports+json` batch. Never throws — a
 * malformed report must not 500.
 */
/* Part 0 audit A5-005: the sink is unauthenticated by nature (browsers POST
   here), so it carries its own guards — a 32KB body cap read via text()
   instead of an unbounded request.json() buffer, and a coarse in-memory
   throttle so a hostile client can't flood the logs. */
const MAX_REPORT_BYTES = 32_768;
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 60;
let windowStart = 0;
let windowCount = 0;

export async function POST(request: Request): Promise<Response> {
  try {
    const now = Date.now();
    if (now - windowStart > WINDOW_MS) {
      windowStart = now;
      windowCount = 0;
    }
    if (windowCount++ >= WINDOW_LIMIT)
      return new Response(null, { status: 429 });

    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_REPORT_BYTES) return new Response(null, { status: 413 });

    const text = await request.text();
    if (text && text.length <= MAX_REPORT_BYTES) {
      // One line per report so log search stays easy; trim to keep noise bounded.
      console.warn("[csp-report]", text.slice(0, 4000));
    }
  } catch {
    // Ignore — reporting is best-effort telemetry.
  }
  // 204: nothing to return to the browser's reporting queue.
  return new Response(null, { status: 204 });
}
