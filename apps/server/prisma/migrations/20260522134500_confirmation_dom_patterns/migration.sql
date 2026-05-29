ALTER TABLE "IdentificationRun"
ADD COLUMN "candidateJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "domSignatureJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "confirmationStatus" TEXT NOT NULL DEFAULT 'not_required',
ADD COLUMN "confirmedAt" TIMESTAMPTZ(6);

CREATE TABLE "CustomerDomPattern" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "domain" TEXT NOT NULL,
  "patternHash" TEXT NOT NULL,
  "anchorText" TEXT,
  "nameText" TEXT,
  "identifierText" TEXT,
  "signatureJson" JSONB NOT NULL DEFAULT '{}',
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "CustomerDomPattern_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerDomPattern_userId_domain_patternHash_key"
ON "CustomerDomPattern"("userId", "domain", "patternHash");

CREATE INDEX "CustomerDomPattern_customerId_idx"
ON "CustomerDomPattern"("customerId");

CREATE INDEX "CustomerDomPattern_userId_domain_lastSeenAt_idx"
ON "CustomerDomPattern"("userId", "domain", "lastSeenAt");

ALTER TABLE "CustomerDomPattern"
ADD CONSTRAINT "CustomerDomPattern_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerDomPattern"
ADD CONSTRAINT "CustomerDomPattern_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
