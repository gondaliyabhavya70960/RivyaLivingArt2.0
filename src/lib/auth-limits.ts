/**
 * The login throttle's NUMBERS, and nothing else.
 *
 * These lived in `src/lib/auth.ts` and still behave identically — that module
 * re-exports them, so every existing import is unchanged. They were split out
 * because `auth.ts` pulls in NextAuth, bcrypt and `@/lib/db`, and the §2.10
 * rate-limit page needs to READ the window in order to count down against the
 * real one. Importing `auth.ts` from a page would drag the whole auth stack
 * and a database client into it, which would opt that page out of static
 * generation to display a number.
 *
 * Why the page reads them at all, rather than writing "15 minutes" in copy:
 * the countdown's entire job is to agree with what the server will actually
 * do. A restated literal is a second source of truth whose failure is silent —
 * the limiter moves to 30 minutes, the page keeps saying 15, and a component
 * with no way to know tells the visitor something untrue.
 *
 * Windows are generous for a human and shut down online password guessing.
 * Durable-store backed (SEC-102) so the budget survives serverless cold starts
 * and fan-out.
 */
export const LOGIN_WINDOW_MS = 15 * 60_000;
export const LOGIN_MAX_PER_EMAIL = 5;
export const LOGIN_MAX_PER_IP = 15;
