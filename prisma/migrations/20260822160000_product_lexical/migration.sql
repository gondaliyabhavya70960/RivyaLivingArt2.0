-- Aesop lexical rows (benchmark gap 4): [{label, value}] rendered into the
-- PDP spec sheet; empty for untouched products.
ALTER TABLE "Product" ADD COLUMN "lexical" JSONB NOT NULL DEFAULT '[]';
