-- Brand transformation: ResinRiva → Rivya Living Art.
--
-- Two columns carry the brand as a DEFAULT, so the schema change alone only
-- affects rows created from here on. These statements move the rows that
-- already exist. Both are value updates — no column is added, dropped or
-- retyped, keeping this migration consistent with the additive-only history.
--
-- Deliberately NOT touched:
--   • Inquiry.number / the "#RR-<n>" reference format — customers hold those
--     references in sent WhatsApp threads.
--   • Product.importSource ("sheet:<sourceKey>") and ScrapedProduct.sourceKey —
--     the `${sourceKey}|${externalId}` merge key orphans every sheet row if
--     these change.
--   • FormOption.value — those values landed on historical Inquiry rows.
--   • Any Cloudinary URL under the `resinriva/` folder — renaming the string
--     404s a live third-party asset. That imagery is replaced in Phase 2.

-- The site-wide brand name shown in the header, OG cards and email.
-- Guarded so an owner who already set a custom brand name keeps it.
UPDATE "SiteSettings"
   SET "brandName" = 'Rivya Living Art'
 WHERE "brandName" = 'ResinRiva';

-- Blog author byline. Same guard: only the shipped default is moved.
UPDATE "BlogPost"
   SET "authorName" = 'Rivya Living Art Studio'
 WHERE "authorName" = 'ResinRiva Studio';
