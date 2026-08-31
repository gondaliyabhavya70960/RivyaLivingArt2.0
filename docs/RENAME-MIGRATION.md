# RENAME-MIGRATION.md — Phase 1

**ResinRiva → Rivya Living Art** · executed 2026-08-31 · **640 substitutions across 112 files**

The rename was risk-tiered from the Phase 0 census (`docs/PROJECT-AUDIT.md` §8). Display copy was
renamed freely; database defaults were renamed **and** migrated; external identifiers were left
alone because changing the string breaks something live.

---

## 1. Renamed freely — display copy

| Surface | Files | Notes |
|---|---|---|
| Storefront copy | `messages/*.json` × 9 | 373 strings. The brand is **untransliterated Latin in every locale** (verified in ar/ja/zh/hi/gu), so one substitution served all nine. |
| Copy registry | `src/lib/site-copy.generated.ts` | Regenerated with `npm run copy:registry` — **1,181 slots**, `copy:check` clean. |
| Site constants | `src/lib/constants.ts` | `SITE.name` |
| Email | `src/lib/email.ts` | Sender name, subjects, body, reset-password template |
| Chrome | `footer.tsx`, `site-header.tsx`, `auth-shell.tsx` | |
| WhatsApp templates | `src/lib/whatsapp.ts` | Greeting + order-message intro |
| Legal pages | `prisma/seed.ts` | Privacy and Terms prose |
| Studio | 20 components under `src/components/studio/` | |
| Package | `package.json` | `resinriva` → `rivya-living-art` |
| Docs | README, CLAUDE.md, ADMIN/DEPLOYMENT/INSTALL/SEO/CONTENT/BACKUP guides, REDESIGN.md, COMPETITOR.md, docs/ | |

**Repository URL** updated too: `ResinRiva2.0` → `RivyaLivingArt2.0` in INSTALL.md, DEPLOYMENT.md,
BACKUP_GUIDE.md, README.md — the repo genuinely moved.

---

## 2. Renamed **and** migrated — database defaults

Two columns carry the brand as a Postgres `DEFAULT`. Changing the schema alone would only affect
rows created afterwards, so migration `20260831080000_brand_rivya_living_art` moves the existing
rows. Both statements are guarded on the old value, so an owner who had already set a custom brand
name keeps it.

| Column | Old default | New default |
|---|---|---|
| `SiteSettings.brandName` | `ResinRiva` | `Rivya Living Art` |
| `BlogPost.authorName` | `ResinRiva Studio` | `Rivya Living Art Studio` |

Applied and verified against the local database:
```
SELECT "brandName" FROM "SiteSettings";        → Rivya Living Art
SELECT DISTINCT "authorName" FROM "BlogPost";  → Rivya Living Art Studio
```
The migration adds, drops and retypes nothing, keeping the **purely additive** history intact
(now 44 migrations, still zero `DROP TABLE` / `DROP COLUMN` / `ALTER COLUMN`).

---

## 3. Deliberately NOT renamed — and why

Each of these would break something live. The `WHERE` guard, the comment, or the test that depends
on it is named so a future session does not "finish the job" and regress it.

| Identifier | Where | Why it must not change |
|---|---|---|
| **`resinriva/` Cloudinary folder** (20 URLs) | `src/lib/media.ts` ×9, `prisma/seed-category-images.ts` ×11 | A path segment in a live third-party account (`dhaqpl1kz`). Renaming the string 404s every hero and category image. **Decision D3: this imagery is replaced in Phase 2, not migrated** — the current shots (jewellery, keychains, wedding frames) do not represent the new domain anyway. |
| **`#RR-<n>` inquiry reference** | `src/lib/whatsapp.ts:127` | Customers already hold these references in sent WhatsApp threads. The `Inquiry.number` SERIAL and the `#RR-` prefix both stay. |
| **`sourceKey` values** | `src/lib/scraper/seed-data.ts` (115 sources) | The `${sourceKey}\|${externalId}` merge key. Changing it orphans every row in the tier tabs. |
| **`importSource` = `sheet:<sourceKey>`** | `prisma/import-tiers.ts` | Half of the `@@unique([importSource, importRef])` identity contract across 64,496 sheet rows. |
| **`FormOption.value`** | `src/lib/form-options.ts` | Those values landed on historical `Inquiry` rows and in sent messages. Only `label` is editable. |
| **Owner's Google Sheet name `resinriva2.0`** | `data/tiers/README.md`, `docs/import/README.md` | The real name of a sheet in the owner's Drive. My first pass renamed it; **reverted** — renaming the doc does not rename the sheet, it just makes the doc wrong. |
| **Historical git branch names** | `docs/image-inventory.md` | `claude/resinriva-audit-tasks-tfz6cs` is a real (deleted) branch in this history. |
| **`init` migration defaults** | `prisma/migrations/20260705183035_init/` | Applied migrations are immutable history. The new migration moves the data forward instead. |
| **Live domain / WhatsApp number** | throughout | `store.bhavyagondaliya.co.in`, `wa.me/917096036250` — unchanged unless the owner moves them. |

---

## 4. Things the mechanical pass got wrong (found and fixed)

A blind find-and-replace produced five genuine defects. Each was caught by inspecting every
lowercase substitution rather than trusting the diff.

1. **`robots.ts` bot token** → became `rivya-living-artresearchbot` (hyphens spliced into a
   robots.txt product token). Fixed to `rivyalivingartresearchbot`.
2. **CI database name desynced.** `.yml` was not in the pass's extension list, so `ci.yml` still
   said `resinriva_ci` while `scripts/ci-staff-user.ts`'s safety guard had been rewritten to
   `rivya-living-art_ci` — the guard would have refused the CI database. Both are now `rivya_ci`.
3. **`global-error.tsx` eyebrow** rendered the literal `rivya-living-art`. The element is
   `text-transform: lowercase`, so it now carries the proper noun and CSS lowercases it.
4. **German About eyebrow** became `der kopf hinter rivya-living-art` (the source had the brand in
   lowercase). Fixed to `Rivya Living Art`, matching fr/es.
5. **Design-audit alt-text rule stopped firing.** `scripts/redesign-audit.mjs` tested
   `/resinriva/i`, which no longer matches anything — a silent gate failure. The pattern is now
   `/rivya/i`, and the "lazy alt" word threshold is brand-length-relative (`BRAND_WORDS + 3`)
   because the brand went from one word to three; a hard-coded 4 would flag every honest alt that
   mentions it. Verified against six cases: flags `"Rivya Living Art luxury tray"`, spares
   `"A Rivya Living Art river table cooling in the workshop after its final pour"`.

---

## 5. The logo could not be renamed by substitution

`src/components/layout/logo.tsx` held a **hand-drawn vector script wordmark** — two SVG paths whose
letterforms spelled *Resin Riva* in path data. The mechanical pass rewrote its `aria-label` to
"Rivya Living Art" while the artwork still drew the old name, which would have left the accessible
name describing a different picture — worse for screen-reader users than leaving it alone.

**Replaced with a typeset wordmark** in the brand display face (Instrument Serif, `--font-display`),
which is what the design system already specifies for display type.

- The `viewBox` was **measured against the rendered glyphs**, not guessed: ink is 626.5 units wide,
  so `viewBox="0 15 627 110"` hugs cap-height to descender with no dead space and no clipping.
  (The first attempt, `0 0 665 130`, left 5.8% dead space and cut the text box.)
- `preserveAspectRatio="xMidYMid meet"` keeps the glyphs whole at any height, so the
  `h-full w-auto` contract all six call sites rely on (`h-6`, `h-7`, `h-8`) still holds.
- Verified visually in the running header at 1440px.
- The `RR` monogram (Resin Riva's two initials) became a single `R`.

**If a bespoke drawn wordmark is commissioned**, swap the `<text>` for its paths and keep the
viewBox — nothing else changes. This is a typographic placeholder of reasonable quality, not a
substitute for a designed identity.

---

## 6. Verification

Every gate run locally on the renamed tree (GitHub Actions cannot allocate a runner — decision D4):

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run copy:check` | 1,181 slots up to date |
| `node scripts/i18n-missing.mjs` | **0 missing** across all 8 non-English locales |
| `npm test` | 322 tests passing |
| `prisma migrate deploy` | 44 migrations applied |
| `next build` | passed |
| `redesign-audit` × 4 (1440/390, LTR + RTL) | 0 failing rules |
| `a11y-audit` × 3 (1440/390, RTL 390) | 0 critical/serious violations |
| `studio-audit` × 2 (1440/390) | clean across 30 studio routes |
| `lighthouse-audit` | home 98/97/96/100 · plp 97/100/96/100 — budgets met |

---

## 7. Still carrying the old domain (Phase 2, not a rename defect)

The rename changed the **name**, not the **business description**. Copy such as
*"Rivya Living Art crafts bespoke resin art, personalized gifts and 3D-printed pieces"* and the hero
eyebrow *"custom resin art · 3D printing · made to order"* is accurate for the old catalogue and is
Phase 2's job to widen to luxury resin furniture, resin art, 3D art and bespoke commissions. Keeping
the two apart is what made this change reviewable.
