ALTER TABLE "IdentificationRun"
ADD COLUMN "bulkBatchId" TEXT,
ADD COLUMN "bulkItemIndex" INTEGER;

CREATE INDEX "IdentificationRun_userId_domain_bulkBatchId_idx"
ON "IdentificationRun"("userId", "domain", "bulkBatchId");
