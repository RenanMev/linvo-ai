CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),
  CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Customer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "domain" TEXT NOT NULL,
  "identityHash" TEXT NOT NULL,
  "identityKind" TEXT NOT NULL,
  "displayName" TEXT,
  "maskedIdentifiers" JSONB NOT NULL DEFAULT '{}',
  "confidence" DECIMAL(4,3) NOT NULL,
  "firstSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerCase" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "customerId" UUID,
  "domain" TEXT NOT NULL,
  "caseHash" TEXT NOT NULL,
  "caseKind" TEXT NOT NULL,
  "protocolDisplay" TEXT,
  "subjectDisplay" TEXT,
  "statusDisplay" TEXT,
  "confidence" DECIMAL(4,3) NOT NULL,
  "firstSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdentificationRun" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "customerId" UUID,
  "customerCaseId" UUID,
  "requestId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "pageUrlHash" TEXT NOT NULL,
  "selectedLabel" TEXT,
  "confidence" DECIMAL(4,3) NOT NULL,
  "saved" BOOLEAN NOT NULL DEFAULT false,
  "evidenceJson" JSONB NOT NULL DEFAULT '[]',
  "warningsJson" JSONB NOT NULL DEFAULT '[]',
  "durationMs" INTEGER,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentificationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");
CREATE INDEX "RefreshSession_userId_expiresAt_idx" ON "RefreshSession"("userId", "expiresAt");
CREATE UNIQUE INDEX "Customer_userId_domain_identityHash_key" ON "Customer"("userId", "domain", "identityHash");
CREATE INDEX "Customer_userId_domain_lastSeenAt_idx" ON "Customer"("userId", "domain", "lastSeenAt");
CREATE UNIQUE INDEX "CustomerCase_userId_domain_caseHash_key" ON "CustomerCase"("userId", "domain", "caseHash");
CREATE INDEX "CustomerCase_userId_domain_lastSeenAt_idx" ON "CustomerCase"("userId", "domain", "lastSeenAt");
CREATE UNIQUE INDEX "IdentificationRun_userId_requestId_key" ON "IdentificationRun"("userId", "requestId");
CREATE INDEX "IdentificationRun_userId_domain_createdAt_idx" ON "IdentificationRun"("userId", "domain", "createdAt");

ALTER TABLE "RefreshSession"
  ADD CONSTRAINT "RefreshSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerCase"
  ADD CONSTRAINT "CustomerCase_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerCase"
  ADD CONSTRAINT "CustomerCase_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IdentificationRun"
  ADD CONSTRAINT "IdentificationRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IdentificationRun"
  ADD CONSTRAINT "IdentificationRun_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IdentificationRun"
  ADD CONSTRAINT "IdentificationRun_customerCaseId_fkey"
  FOREIGN KEY ("customerCaseId") REFERENCES "CustomerCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
