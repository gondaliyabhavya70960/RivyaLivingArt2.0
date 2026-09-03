/**
 * The demo-content WHERE fragment, as a pure function.
 *
 * Every public reader spreads this into its `where` so demo fixtures — rows
 * the owner seeded to see the design with content, never real products,
 * words or work — reach a visitor only when the gate says so. Kept apart
 * from `demo-content.ts` (which is server-only and asks the environment and
 * the settings row) so the clause itself can be unit-tested and imported
 * from anywhere.
 */
export type DemoClause = { isDemo: false } | Record<string, never>;

/**
 * `show === true` → no constraint (demo rows are visible alongside real
 * ones). `show === false` → `{ isDemo: false }`, which hides every fixture.
 */
export function demoClause(show: boolean): DemoClause {
  return show ? {} : { isDemo: false };
}
