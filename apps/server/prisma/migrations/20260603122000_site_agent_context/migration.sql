CREATE TABLE "SiteAgentContext" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "regionsJson" JSONB NOT NULL DEFAULT '[]',
    "focusRulesJson" JSONB NOT NULL DEFAULT '[]',
    "ignoreRulesJson" JSONB NOT NULL DEFAULT '[]',
    "confidence" DECIMAL(4,3) NOT NULL,
    "sourceRequestId" TEXT NOT NULL,
    "sourceRunId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SiteAgentContext_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteAgentContext_userId_domain_key" ON "SiteAgentContext"("userId", "domain");
CREATE INDEX "SiteAgentContext_userId_updatedAt_idx" ON "SiteAgentContext"("userId", "updatedAt");
CREATE INDEX "SiteAgentContext_sourceRunId_idx" ON "SiteAgentContext"("sourceRunId");

ALTER TABLE "SiteAgentContext" ADD CONSTRAINT "SiteAgentContext_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteAgentContext" ADD CONSTRAINT "SiteAgentContext_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "IdentificationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
