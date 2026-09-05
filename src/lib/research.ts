/**
 * The research record's status vocabulary — a plain module, on purpose.
 *
 * It used to be exported from `src/actions/research.ts`, which is a
 * `"use server"` file. A client component importing a VALUE from such a
 * module does not get the value: Next hands it a server-reference proxy, so
 * `RESEARCH_STATUSES.map(...)` threw "map is not a function" during render
 * and the whole /studio/research page fell to the error boundary — while
 * the Studio audit, which checks the accessibility tree rather than what
 * rendered, passed it. Anything a client component needs by value lives in
 * `src/lib`; the action imports it from here like everyone else.
 */
export const RESEARCH_STATUSES = [
  "RESEARCH",
  "SHORTLISTED",
  "DISCARDED",
] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];
