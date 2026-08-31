-- Header, drawer and footer navigation, moved out of src/lib/constants.ts.
--
-- Additive. An empty pair of tables renders the bundled menus, so this applies
-- against a live database while the previous build is still serving.
CREATE TABLE "NavMenu" (
    "key" TEXT NOT NULL,

    CONSTRAINT "NavMenu_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "NavItem" (
    "id" TEXT NOT NULL,
    "menuKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" JSONB NOT NULL DEFAULT '{}',
    "href" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "newTab" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NavItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NavItem_menuKey_key_key" ON "NavItem"("menuKey", "key");
CREATE INDEX "NavItem_menuKey_order_idx" ON "NavItem"("menuKey", "order");

ALTER TABLE "NavItem" ADD CONSTRAINT "NavItem_menuKey_fkey"
  FOREIGN KEY ("menuKey") REFERENCES "NavMenu"("key") ON DELETE CASCADE ON UPDATE CASCADE;
