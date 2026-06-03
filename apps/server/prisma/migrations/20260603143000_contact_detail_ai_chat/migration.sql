CREATE TYPE "CustomerAiMessageRole" AS ENUM ('user', 'assistant');

CREATE TYPE "CustomerAiMessageStatus" AS ENUM (
  'completed',
  'streaming',
  'interrupted',
  'error'
);

ALTER TABLE "Customer"
  ADD COLUMN "isStarred" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "favoriteFieldsJson" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "CustomerAiThread" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "summary" TEXT,
  "messageCountSinceSummary" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerAiThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerAiMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "threadId" UUID NOT NULL,
  "role" "CustomerAiMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "status" "CustomerAiMessageStatus" NOT NULL DEFAULT 'completed',
  "sequence" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerAiMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAiThread_customerId_key" ON "CustomerAiThread"("customerId");
CREATE INDEX "CustomerAiThread_userId_updatedAt_idx" ON "CustomerAiThread"("userId", "updatedAt");
CREATE UNIQUE INDEX "CustomerAiMessage_threadId_sequence_key" ON "CustomerAiMessage"("threadId", "sequence");
CREATE INDEX "CustomerAiMessage_threadId_sequence_idx" ON "CustomerAiMessage"("threadId", "sequence");

ALTER TABLE "CustomerAiThread"
  ADD CONSTRAINT "CustomerAiThread_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerAiThread"
  ADD CONSTRAINT "CustomerAiThread_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerAiMessage"
  ADD CONSTRAINT "CustomerAiMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "CustomerAiThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
