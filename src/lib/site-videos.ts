/**
 * The bundled video defaults — the registry half of the CMS shape the rest of
 * the site already follows (registry in code → override in the database → a
 * total resolver).
 *
 * `SiteSettings.heroVideoUrl` is the override and stays exactly as it was: an
 * owner who uploads a film in Studio → Settings still wins. What changes is the
 * floor. It used to be `settings.heroVideoUrl ?? undefined`, so a fresh
 * environment — and production, which has never had the field set — showed the
 * poster alone and the delivered pour loop sat unreferenced in the repo.
 *
 * NOT A `site-images.ts` SLOT, deliberately. `importBundledSiteImages` copies
 * every slot default into Blob storage on first deploy and repoints the slot at
 * the upload. For a picture that is the whole point. For these it would be a
 * bug: `HeroMedia` derives the WebM twin from the MP4's PATH, and a Blob URL
 * has no twin to derive — so the 2 MB MP4 would become the only file every
 * visitor gets, silently, on the surface where weight matters most.
 *
 * ── What these files are ────────────────────────────────────────────────────
 * Delivered by the design handoff (plan §4.4) at 1280x720 · 24fps · 8.04s,
 * inside REDESIGN.md §15.4's 6–16s window, and re-encoded here to meet the
 * rest of that spec, which they did not: 4.1/4.3 MB against a ≤2.5 MB ceiling,
 * and `moov` written AFTER `mdat`, which defeats the `preload="metadata"` the
 * same line requires — the browser would have had to fetch to the end of the
 * file to learn the duration. Two-pass H.264 at 2150 kbps, yuv420p, no audio
 * track, `+faststart`. Checked frame-against-frame afterwards for the banding
 * that dark sapphire gradients show first; there is none.
 *
 * They remain 720p against the §15.4 entry's own 1920 `targetWidth`, and that
 * is a real gap rather than a resolved one: no upscaler here can honestly add
 * detail. It is survivable because `HeroMedia` keeps the 1920x1080 POSTER as
 * the LCP element and never lets the film carry the frame — and because the
 * film does not play at all under reduced motion or on touch.
 */

/** Bundled loop → the poster that stands in for it (Part 14: always one). */
export const BUNDLED_VIDEOS = {
  /** Homepage hero — the pour. Poster is the slot's own `home.hero` image. */
  homeHero: "/redesign/hero-pour-loop.mp4",
  /** Ambient swirl, for a dark band that wants motion behind it. */
  ambientSwirl: "/redesign/pour-swirl-loop.mp4",
} as const;

/**
 * Every bundled loop, with the two files each one implies. Exported so a test
 * can assert they exist rather than trusting that they do — the repo has shipped
 * a slot pointing at an absent file once already, and nothing said so for weeks.
 */
export const BUNDLED_VIDEO_FILES = Object.values(BUNDLED_VIDEOS).flatMap(
  (mp4) => [mp4, mp4.replace(/\.mp4$/, ".webm"), mp4.replace(/\.mp4$/, "-poster.jpg")],
);
