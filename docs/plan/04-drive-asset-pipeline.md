# D — Drive asset pipeline

**Companion file:** [`drive-asset-map.json`](drive-asset-map.json) — generated 2026-09-14,
43 entries · 71 candidates · **71 matched · 0 unmatched.**

> This is the highest value-per-hour work in the plan and it is not blocked on any decision except
> which slots survive D25.

---

## 1. What was blocked, and why it no longer is

`CLAUDE.md` records the state of the media queue honestly:

> *"They stay `status: "planned"` on purpose. … The file cannot be downloaded here: the CDN holding
> these URLs answers 403 to the agent proxy's egress policy, an organization policy denial to
> report, not to route around. What remains, on any machine with ordinary internet: `--promote <id>`
> → `--candidates` and set `"keeper"` → the default run → point a slot at the file."*

The owner has already done the "machine with ordinary internet" step. The Drive folder
**Higgsfield Originals** holds the downloaded masters, and the filenames are the CDN basenames
verbatim — `hf_<YYYYMMDD>_<HHMMSS>_<jobId>.png`. That is what makes the match exact rather than
approximate: the `jobId` in each manifest candidate URL *is* the `jobId` in the Drive filename.

| Batch | Manifest candidates | In Drive | Note |
|---|---|---|---|
| 20260823 (A–C) | 46 | 8 | Irrelevant — those 24 masters are already built in `public/media/v3/` |
| 20260826 | 2 | 0 | Already built (`process-pour.mp4` + poster) |
| **20260904 (Batch D)** | **56** | **56** | 50 PNG in `images/`, 6 MP4 in `videos/` (SET F loops ×2 variants) |
| **20260905 (Batch E)** | **15** | **15** | |

Every outstanding candidate is present. The queue is unblocked.

Also in the folder: `Higgsfield_Prompts_250.csv` / `.xlsx` (250 prompts — a superset of the
manifest's recorded prompts, worth diffing before any future generation run),
`Download_Higgsfield_Originals.ipynb` (the Colab that produced the download), and a
`Rivya_All_Generated_Images` subfolder not enumerated here.

---

## 2. Coverage by set

| Set | Entries | Candidates in Drive |
|---|---|---|
| bench-concepts | 6 | 12 / 12 |
| mobile-crops | 6 | 12 / 12 |
| gifting | 6 | 6 / 6 |
| process-actions | 5 | 10 / 10 |
| varmala-preservation | 5 | 5 / 5 |
| concept-rooms | 4 | 8 / 8 |
| large-art | 4 | 8 / 8 |
| video (SET F loops) | 3 | 6 / 6 |
| atelier | 2 | 2 / 2 |
| workshops | 2 | 2 / 2 |
| **Total** | **43** | **71 / 71** |

The remaining 12 of the manifest's 55 planned entries were never generated — the Higgsfield
workspace ran out of credits and the "365 Unlimited" subscriptions are not reachable through the
MCP API. Those 12 stay `planned` and stay honest. `--planned` must keep reporting the mixed state
(`12 planned · 43 generated`), because telling an owner to regenerate 43 finished renders is the one
wrong instruction here that costs real money.

---

## 3. The pipeline

### 3.1 A new fetcher, not a change to the old one

`scripts/media-v3-fetch.mjs` downloads from the CDN. Leave it alone — it is correct, and it works
on a machine with ordinary internet. Add a sibling that reads Drive instead:

```
scripts/media-v3-drive-fetch.mjs
  --candidates        download both variants of each mapped entry → contact sheet
  --build             one AVIF master per entry with a culled keeper → public/media/v3/
  [--set <name>]      scope to one set
```

It resolves files through `docs/plan/drive-asset-map.json` → `driveFileId`, so it never touches the
403'd host. Both scripts must write **identical output**: the same AVIF encode settings, the same
20px LQIP into `src/lib/media-v3-blur.json`, the same `width`/`height` records. `bundled-media.test.ts`
already verifies that recorded dimensions match the file on disk and that regenerating the LQIP
reproduces the committed `blurDataURL` — those assertions are the contract between the two scripts.

SET F's three loops go through `scripts/media-v3-video-fetch.mjs`, not the still pipeline. Their
variant `a` is the 1080p audio-free re-run; variant `b` is the off-spec 720p first take and stays
marked `offSpec`.

### 3.2 The order that keeps CI green

`--promote` flips a row to `promoted`, and from that moment `bundled-media.test.ts` demands the
master exist **on disk** and `media-v3-preflight.mjs` demands a culled `keeper`. Promote a row whose
file nobody has built and the build goes red. So, per set:

```
1. --candidates <set>      download both variants, write the contact sheet
2. cull                    set "keeper": "a" | "b" on each entry  ← human judgement
3. --build <set>           write the AVIF master + LQIP
4. --promote <set>         flip status; now the tests have something to find
5. wire                    point a slot at the file in /studio/site-images
6. npm run test            bundled-media + site-images must pass
```

**Step 5 is not optional.** `CLAUDE.md`: *"a built master is not a wired one."* A promoted, built,
unwired master is dead weight that passes every test.

### 3.3 Why the cull cannot be automated

Two variants per entry, one keeper. The existing 24 masters were culled from five contact sheets in
`docs/media-v3-review/`, 20 keeping `a` and 4 keeping `b` — a 17% override rate, which is exactly
the rate that says the choice was real. Generate the contact sheets; let the owner choose. Budget
an hour.

---

## 4. Guards that stay in force

These are not bureaucracy; each one exists because of a specific failure.

- **§15.2 — the maker is never AI.** `home.maker` and `about.maker` keep what they have. The
  maker portrait is deliberately absent from the generation queue, because a row in a generation
  queue is an invitation to generate it. The file currently behind those slots is itself a
  generation, recorded by `site-images-import.test.ts`, and replacing it with a real photograph is
  the owner's job.
- **The two withdrawn Batch E rows stay withdrawn.** `varmala-before-after` restates the manifest's
  own `excluded[0]` — §15.2 forbids a generated picture standing in for a customer's own flowers,
  and changing the aspect ratio does not change the claim the picture makes.
  `varmala-floret-macro` has nowhere to land: the only 1:1 slots are `about.material1–4.macro`, and
  §15.3 generated those four as one batch on identical ground and light.
- **§15.5 — 2560px floor.** Batch D stills measure 3712×4608 and 3072×5504; Batch E likewise. No
  upscale pass needed. SET F's 1080p is that model's ceiling and is the entry's stated target.
- **Every new table that stores a media URL goes into `media-usages.ts` in the same commit.** That
  header rule was broken three times in one week and each break was silent — the worst 404'd only
  the phone layout.
- **The three guards that closed the "everything green while the site had no photography" hole**
  stay: `site-images.test.ts` asserts each fallback is on disk; `bundled-media.test.ts` covers the
  121 scrub frames, `CANONICAL_CATEGORIES[].image`, the manifest icon and the LQIP manifest; and
  `redesign-audit.mjs` fails any **bundled** image that finished loading with `naturalWidth === 0`.

---

## 5. Where the new imagery lands

`site-images.ts` carries 78 slots over 25 bundled files. `tile-live.avif` alone backs eight slots
and `tile-create.avif` seven — that over-subscription is precisely why Batch E exists, and each
Batch E entry names the over-worked master it is meant to relieve.

Sets map to surfaces roughly as follows; confirm against each entry's `placement` field, which
records the intended slot in prose:

| Set | Surface |
|---|---|
| bench-concepts · large-art · concept-rooms | `/large-resin-art`, the homepage large-format band |
| process-actions | `/process`, the four process steps |
| varmala-preservation | the varmala collection, `/shop/[category]` |
| gifting | the gift collection, `home.collections.*` |
| workshops · atelier | `/workshops`, `/about` |
| mobile-crops | the ≤390px variants of existing slots |
| studio-chrome | Studio login backdrop and chrome (12 planned, 0 generated) |
| video (SET F) | ambient loops behind `HeroMedia` — muted, `aria-hidden`, off under reduced motion |

Twelve alt keys were rewritten across all nine locales when the last batch landed. Budget the same
here: **any slot whose picture changes needs its alt text re-read in nine languages**, because alt
text describes the picture, not the brand.

---

## 6. Sequencing

| Step | Work | Gate |
|---|---|---|
| D1 | `media-v3-drive-fetch.mjs` + contact sheets for all ten sets | Script parity with the CDN fetcher |
| D2 | Owner cull — set `keeper` on 43 entries | `media-v3-preflight.mjs` |
| D3 | Build masters + LQIP; promote | `bundled-media.test.ts` |
| D4 | Wire slots in `site-images.ts`; relieve `tile-live` and `tile-create` | `site-images.test.ts` |
| D5 | Alt text across nine locales | `i18n-missing.mjs`, `copy:check` |
| D6 | Re-run the design and a11y audits at 1440 · 1280 · 390 · 360 | `redesign-audit.mjs` |

D1–D3 can run per set, so the work is shippable in ten small PRs rather than one large one.
