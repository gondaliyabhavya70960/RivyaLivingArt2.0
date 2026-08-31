-- SEC-106: session revocation — bumped on delete/demote/password-reset.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- ENG-811: one-time claim token guarding the /whatsapp-order PII readback.
ALTER TABLE "Inquiry" ADD COLUMN "claimTokenHash" TEXT;

-- ENG-806: index Media.url so the delete guard can find references / cleanup.
CREATE INDEX "Media_url_idx" ON "Media"("url");

-- SEC-102: durable rate-limit store for login / password-reset throttling.
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RateLimitHit_key_at_idx" ON "RateLimitHit"("key", "at");
