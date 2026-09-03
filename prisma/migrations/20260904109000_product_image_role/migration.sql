-- B0 commit 10 — a role on product photographs.
--
-- The PDP's room-context band cannot exist without knowing which frame shows
-- the piece in a room. A nullable enum with no back-fill is the cheapest
-- honest column: every existing frame stays role-less and renders as today.
CREATE TYPE "ProductImageRole" AS ENUM ('HERO', 'DETAIL', 'IN_ROOM', 'PROCESS');
ALTER TABLE "ProductImage" ADD COLUMN "role" "ProductImageRole";
