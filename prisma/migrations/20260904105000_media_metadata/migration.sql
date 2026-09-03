-- B0 commit 6 — library metadata on Media.
--
-- The media library could search a file's name and alt and nothing else: no
-- tags, no caption, no favourites, no duration for a film and no poster
-- frame to stand in for it. All additive; every existing row is untouched.
-- `posterUrl` stores a URL, so the same commit registers it in
-- src/lib/media-usages.ts (the delete guard) — the header rule there.
ALTER TABLE "Media" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Media" ADD COLUMN "caption" TEXT;
ALTER TABLE "Media" ADD COLUMN "favourite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Media" ADD COLUMN "duration" INTEGER;
ALTER TABLE "Media" ADD COLUMN "posterUrl" TEXT;
