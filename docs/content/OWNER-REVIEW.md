# Owner review — decisions only the owner can make

_2026-09-19. Everything below is confirmed in code, fixtures or the live site;
what is missing is a decision, not a fact. Nothing here is actioned without
the owner's word._

## 1. Starter content — the one real content gap

**Fact:** `prisma/fixtures/starter/{faqs,concepts,research}.json` are three
empty arrays. The seeder (`npm run seed:starter`, dry-run by default,
additive-only, no update branch) is built and tested.

**Decision needed:** confirm the scope so the fixtures can be authored —
- FAQs: 35–50 (craft prompt target), grounded in the six genuine answers
  already live, covering ordering, resin, furniture, 3D printing,
  personalisation, preservation, shipping.
- Portfolio concept studies: clearly labelled, seeded as DRAFT.
- Internal research records: competitor/market notes, never public.

Then the owner runs: `npm run seed:starter` (read the dry run) →
`npm run seed:starter -- --apply`.

## 2. Portfolio direction

**Fact:** all 23 live cases are small-format pieces (bookmarks, earrings,
coasters, bangles, thali, magnets). The brand positions itself as large-format
furniture and spatial art. A visitor looking for a dining table sees
jewellery.

**Decision needed:** labelled concept studies alongside the real cases
(proposed in CONTENT-AUDIT.md), or hold the portfolio small until real
large-format commissions are documented? Both are defensible; mixing
unlabelled concept work into the portfolio is not.

## 3. Testimonials stay at zero

**Fact:** zero render today, which is correct. Publishing requires real
customer words and `permissionStatus: GRANTED`; the Review JSON-LD counts only
published, permitted, non-demo rows.

**Decision needed:** none from code. When real customers give words and
permission, enter them in the Studio. This file will never recommend
otherwise.

## 4. The demo-visibility switch in production

**Fact:** Studio → Content Lab shows **"Show demo content on the live site"
ON**, while the production database holds zero demo rows (the host guard has
never let a seed through). The switch therefore changes nothing today.

**Decision needed:** leave on (harmless; fixtures would render marked if a
CLI seed were ever run with the explicit override) or switch off for
tidiness. No technical recommendation — purely owner preference.

## 5. The historical `hf_` libraries

**Fact:** `images/` holds 100+ unindexed PNG masters and `videos/` 26 MP4s
from the earlier generation workflow. No manifest exists, so nobody — owner
included — can say what each file shows without opening it.

**Decision needed:** invest one pass to index them (subject, quality,
keep/review — output lands in `GOOGLE-DRIVE-ASSET-MAP.md`), or leave them as
cold archive and generate fresh when something is needed?

## 6. Demo data in production — the road not taken

**Fact:** demo fixtures CAN be written to production from the command line
(`--allow-production` plus typing `DEMO INTO PRODUCTION` at an interactive
prompt). The Studio button refuses by design.

**Decision needed:** none, and this file recommends keeping it that way —
the 754 fixture rows exist so previews and CI render realistically, not so
the live store carries synthetic products, inquiries and testimonials.
Recorded here so the option is documented rather than discovered.

## Pending from the craft prompt

- `docs/content/COMPETITOR-RESEARCH.md` — Phase 08, not yet started.
  CONTENT-AUDIT.md already links here for it; the link stays broken until
  that phase runs.
- `ASSET-REQUESTS.md` — created when the first asset request is raised;
  currently none outstanding (see GOOGLE-DRIVE-ASSET-MAP.md gaps).

## Related

- `docs/content/CONTENT-AUDIT.md` — the root-cause analysis
- `docs/content/CONTENT-INVENTORY.md` — the counts
- `docs/content/GOOGLE-DRIVE-ASSET-MAP.md` — the Drive library
