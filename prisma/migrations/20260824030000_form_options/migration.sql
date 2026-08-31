-- Commission-form dropdown options, moved out of the component and into data.
--
-- Additive: a new table and nothing else. The form falls back to its bundled
-- constants while the table is empty, so this migration is safe to apply while
-- the previous build is still serving, and a rollback needs no down-migration.
CREATE TYPE "FormOptionList" AS ENUM ('MATERIAL', 'OCCASION', 'BUDGET', 'TIMELINE');

CREATE TABLE "FormOption" (
    "id" TEXT NOT NULL,
    "list" "FormOptionList" NOT NULL,
    "value" TEXT NOT NULL,
    "label" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FormOption_pkey" PRIMARY KEY ("id")
);

-- One row per value per list: re-seeding is an upsert, never a duplicate.
CREATE UNIQUE INDEX "FormOption_list_value_key" ON "FormOption"("list", "value");
CREATE INDEX "FormOption_list_order_idx" ON "FormOption"("list", "order");
