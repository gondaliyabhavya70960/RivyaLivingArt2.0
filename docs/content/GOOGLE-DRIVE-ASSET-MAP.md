# Google Drive asset map

_2026-09-19. Master folder:
`drive.google.com/drive/folders/1P2HCTmPge6HsEwtoo-xGEzPTSn68oZOW` — listed
via the Drive API, cross-checked against the repository. No file was modified,
moved or deleted. `DELETE` is deliberately not an action in this map — removal
stays owner-controlled._

Actions used: **KEEP** (brand/source of truth, do not touch) · **USE**
(approved for current pages) · **REUSE** (already integrated — keep using) ·
**OPTIMIZE** (usable after compression/format work) · **REVIEW** (needs an
owner/index pass before any use) · **EARLIER VERSION** (superseded, kept for
history) · **UNUSED** (no current purpose identified) · **NEED REPLACEMENT**
(not fit for the intended production use).

## Brand

| Drive asset | Type | Intended use | Current website use | Quality | Action |
| --- | --- | --- | --- | --- | --- |
| `logo art` (PNG, 1.8 MB) | Logo | Primary brand mark | Owner-supplied brand asset | Owner original | **KEEP** — never regenerate |
| `logo art large` (PNG, 1.9 MB) | Logo | Large-format brand mark | Owner-supplied brand asset | Owner original | **KEEP** — never regenerate |

## `assets/` — the curated set (37 files, 2026-09-17)

The fourteen named visuals the redesign was built with, each as a PNG master
plus a web-weight JPG; two video loops in MP4 + web-MP4 + WebM with JPG
posters; one OG card.

| Drive asset | Type | Intended use | Current website use | Quality | Action |
| --- | --- | --- | --- | --- | --- |
| `hero-pour.png/.jpg` | Image | Home hero | Referenced via site-image slots (`src/lib/site-images.ts`, `placeholder-assets.ts`) | Master 2.3 MB / web 212 KB | **REUSE** |
| `hero-pour-loop.mp4` / `-web.mp4` / `.webm` + `hero-pour-loop-poster.jpg` | Video loop | Home hero motion | Wired through `src/lib/site-videos.ts` | ~4 MB MP4, 1.6 MB WebM | **REUSE** |
| `pour-swirl-loop.mp4` / `-web.mp4` / `.webm` + poster | Video loop | Secondary motion band | Same pipeline | ~4.3 MB MP4 | **REUSE** |
| `maker-hands.png/.jpg` | Image | The-maker section | Site-image slot | Master 1.8 MB | **REUSE** |
| `insitu-tray-table.png/.jpg` | Image | In-situ product context | Site-image slot | Master 1.8 MB | **REUSE** |
| `insitu-bangle-wrist.png/.jpg` | Image | In-situ product context | Site-image slot | Master 1.9 MB | **REUSE** |
| `doorway-memory.png/.jpg` | Image | Mega-menu doorway tile | Site-image slot | Master 1.6 MB | **REUSE** |
| `doorway-collectible.png/.jpg` | Image | Mega-menu doorway tile | Site-image slot | Master 2.4 MB | **REUSE** |
| `doorway-gifts.png/.jpg` | Image | Mega-menu doorway tile | Site-image slot | Master 2.8 MB | **REUSE** |
| `texture-resin-flow.png/.jpg` | Texture | Section backgrounds | Site-image slot | Master 2.7 MB | **REUSE** |
| `testimonial-home.png/.jpg` | Image | Testimonial band art | Site-image slot | Master 1.7 MB | **REUSE** |
| `visual-404.png/.jpg` | Image | 404 page | Site-image slot | Master 4.0 MB | **REUSE** |
| `product-varmala-frame.png/.jpg` | Image | Product visual | Site-image slot | Master 1.7 MB | **REUSE** |
| `product-platter.png/.jpg` | Image | Product visual | Site-image slot | Master 1.8 MB | **REUSE** |
| `product-bangle.png/.jpg` | Image | Product visual | Site-image slot | Master 1.5 MB | **REUSE** |
| `product-coasters.png/.jpg` | Image | Product visual | Site-image slot | Master 1.6 MB | **REUSE** |
| `og-home.jpg` | OG card | Social/OG image | OG pipeline | 114 KB | **REUSE** |

The PNG masters are sources, not web assets — pages serve the JPG/WebM
variants. Keep the masters in Drive as the regeneration base.

## `Rivya_All_Generated_Images/` — the concept catalogue (45 final + 2 superseded)

| Drive asset | Type | Intended use | Current website use | Quality | Action |
| --- | --- | --- | --- | --- | --- |
| `final/product-heroes/` — 35 portraits, 1122×1402 | AI concept images | Concept visualisation for products not yet photographed | Ingested as `.webp` into `public/redesign/catalog/heroes/` — renders only under the placeholder honesty rule (dev/preview/captioned concept frames/Studio seed, **never** as imagery of a purchasable product) | Below the brief's own production minimum (2048×2560) per the library's README | **USE** as concept only; **NEED REPLACEMENT** with owner photography product by product |
| `final/room-scenes/` — 10 scenes, 1672×941 | AI concept images | In-room context frames | Ingested as `.webp` into `public/redesign/catalog/scenes/` under the same rule | Below production minimum (2560×1440) per README | **USE** as concept only; **NEED REPLACEMENT** with real install photography |
| `earlier-versions/` — 2 files (hero-029, scene-003) | AI concept images | History | Not integrated | Superseded | **EARLIER VERSION** |
| `asset-index.csv` | Index | Names, IDs, dimensions, SHA-256 per image | Reference for the ingestion manifest | Current | **KEEP** |
| `README.txt` | Doc | Library scope + honest quality notes | Reference | Current | **KEEP** |

## `images/` — historical `hf_` image library (~101+ PNG masters)

~101 files enumerated across two API listing passes (the connector's paged
listing repeats pages rather than converging — the folder may hold more).
All named `hf_YYYYMMDD_HHMMSS_<uuid>.png`, 5–50 MB each, generated
2026-08-09 → 2026-09-05. **Indexed 2026-09-19**: session clusters, size
stats and the grading protocol now live in `docs/content/DRIVE-HF-INDEX.md`.

| Drive asset | Type | Intended use | Current website use | Quality | Action |
| --- | --- | --- | --- | --- | --- |
| `hf_*.png` (~101+ files) | AI images, historical | None recorded — no subject list until the index pass | Not integrated anywhere | Ungraded at file level; session clusters mapped | **REVIEW** — grade per `DRIVE-HF-INDEX.md` protocol; filenames carry no meaning, and the `hf_` prefix is history, not a verdict (craft prompt: these remain valid if visually appropriate) |

## `videos/` — historical `hf_` video library (26 MP4s)

| Drive asset | Type | Intended use | Current website use | Quality | Action |
| --- | --- | --- | --- | --- | --- |
| `hf_*.mp4` (26 files, 0.6–5.8 MB) | AI video, historical | None recorded | Not integrated; current motion comes from `assets/` loops | Ungraded; session counts exact in `DRIVE-HF-INDEX.md` | **REVIEW** — same grading pass as the images |

## Historical workflow files (root)

| Drive asset | Type | Intended use | Current website use | Quality | Action |
| --- | --- | --- | --- | --- | --- |
| `Higgsfield_Prompts_250.csv` (172 KB) | Prompt archive | Creative-direction / prompt reference only | None — Higgsfield is not part of the workflow | Historical | **KEEP** as reference; prompts may be adapted for Kimi/Grok/ChatGPT |
| `Higgsfield_Prompts_250.xlsx` (76 KB) | Prompt archive | Same, spreadsheet form | None | Historical | **KEEP** as reference |
| `Download_Higgsfield_Originals.ipynb` | Colab notebook | Historical bulk-download tooling | None | Historical | **UNUSED** |

## Gaps this map surfaces

1. **Homepage poster for the hero video** — the generated-image README states
   it was never generated (it must be a frame of the matching hero video).
   `assets/hero-pour-loop-poster.jpg` covers the current loop; flag only if the
   hero creative changes.
2. ~~No index for `images/` and `videos/`~~ — **resolved 2026-09-19**:
   `docs/content/DRIVE-HF-INDEX.md` maps the library (session clusters, size
   stats, grading protocol). Remaining: the owner's grading pass itself,
   starting with the two big sessions (08-28, 09-04).
3. **Recommended future structure** (craft prompt Phase 17): `brand/`,
   `assets/` (curated, current), `generated/final`, `generated/archive`,
   `historical/images`, `historical/videos`, `reference/prompts`. Reorganising
   is an owner action and changes nothing referenced by code — every
   integration above is by file, not by folder.

## Related

- `docs/content/DRIVE-HF-INDEX.md` — the `hf_` library, indexed
- `docs/content/CONTENT-INVENTORY.md` — content counts, entity by entity
- `docs/content/CONTENT-AUDIT.md` — why the demo content is not on the site
