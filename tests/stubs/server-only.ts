/**
 * Stand-in for the `server-only` marker package under Vitest.
 *
 * Next.js resolves `import "server-only"` at bundle time and fails the build
 * when a Client Component reaches it; Node itself cannot resolve the package
 * at all. The marker has no runtime, so under the test runner it is aliased
 * to this empty module (vitest.db.config.mts) and server modules such as
 * `src/lib/demo-content.ts` can be exercised against the real database.
 */
export {};
