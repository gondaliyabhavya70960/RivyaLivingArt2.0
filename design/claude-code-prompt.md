# Rivya Living Art — Claude Code Prompt (copy-paste ready)

**How to use:** paste the block below as the first message in every Claude Code session — or save it as `CLAUDE.md` in the repo root (Claude Code then loads it automatically). It assumes the three docs live in the repo at `design/`.

```
# Rivya Living Art — Build Rules (Liquid Luxury redesign)

You are building the Awwwards-level redesign of rivyalivingart.com:
Next.js 16 App Router · TypeScript · Tailwind v4 · shadcn-style components ·
Prisma 7 + Neon · Auth.js v5 (staff only) · next-intl (9 locales, incl. RTL).

READ FIRST (in this repo):
1. design/implementation-plan.md  — master plan: pages, components, assets, deps
2. design/awwwards-redesign-spec.md — art direction + 12-motion system
3. design/ui-ux-audit-report.md — what is broken and why
4. REDESIGN.md + src/lib/site-images.ts — slot system and repo conventions

HARD RULES — never violate:
- NO database/schema changes. NO payment/cart/checkout. NO customer accounts
  (only staff login at /studio). Every order finalizes on WhatsApp.
- All UI copy goes through messages/en.json (+ 8 locale files), then run
  `npm run copy:registry`. Never hardcode strings. `npm run copy:check` must pass.
- Motion only via `@/lib/gsap` (named eases "luxury"/"settle"). Every animation
  needs a prefers-reduced-motion resting frame and pointer:coarse guards —
  copy the pattern in src/components/storefront/featured-rail.tsx.
  GSAP bundle must stay under the 49KB gate (scripts/motion-budget.mjs).
- Images use the site-image slot system (src/lib/site-images.ts). Never hotlink.

IMAGES — Google Drive library:
All brand/product imagery lives in:
https://drive.google.com/drive/folders/1P2HCTmPge6HsEwtoo-xGEzPTSn68oZOW
The file-ID map of all 45 images + 26 videos is in implementation-plan.md §4.7.
If a Google Drive MCP tool is available, fetch by file ID. If not, STOP and ask
me to download the folder into `assets-inbox/`, then run
`scripts/optimize-redesign-assets.mjs` (plan §5.4) before using any image.
Anything under `public/redesign/catalog/` is a PLACEHOLDER for a product that
does not exist — allowed in dev/preview and captioned "concept" frames only,
never publishable on a real product (plan §4.6). The maker portrait and workshop
photos are NEVER AI-generated (slot rule §15.2).

DEPENDENCIES:
Everything needed is already in package.json (plan §5.1). The only approved new
package is @dnd-kit/core + @dnd-kit/sortable for the Studio kanban. Ask me
before adding anything else.

BUILD ORDER: follow the roadmap (plan §8). Current phase: P0 → P1.
Component specs for cursor, progress bars, preloader, dropdowns, buttons,
inputs, dialogs etc.: plan §6 — use those exact eases/durations, don't invent.

VERIFY BEFORE FINISHING ANY TASK:
npm run typecheck && npm run lint && npm run copy:check && npm run test:e2e
Budgets: LCP < 2.5s · CLS < 0.1 · INP < 200ms · hero media ≤ 6MB.

DESIGN LANGUAGE: obsidian + champagne, Instrument Serif / Inter / JetBrains Mono,
meniscus hairlines, one italic accent word per headline max, max 3 dark bands per
page and never adjacent. Reference level: Aesop · Cartier · Henge · Lusion.
```
