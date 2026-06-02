CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');
CREATE TYPE "IdentityKind" AS ENUM ('document', 'email', 'name_context', 'phone', 'protocol');
CREATE TYPE "CaseKind" AS ENUM ('protocol', 'subject_context');
CREATE TYPE "ConfirmationStatus" AS ENUM (
  'not_required',
  'low_confidence',
  'pending_confirmation',
  'known',
  'accepted',
  'rejected'
);

ALTER TABLE "User"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "UserStatus" USING "status"::"UserStatus",
  ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "Customer"
  ALTER COLUMN "identityKind" TYPE "IdentityKind" USING "identityKind"::"IdentityKind";

ALTER TABLE "CustomerCase"
  ALTER COLUMN "caseKind" TYPE "CaseKind" USING "caseKind"::"CaseKind";

ALTER TABLE "IdentificationRun"
  ALTER COLUMN "confirmationStatus" DROP DEFAULT,
  ALTER COLUMN "confirmationStatus" TYPE "ConfirmationStatus" USING "confirmationStatus"::"ConfirmationStatus",
  ALTER COLUMN "confirmationStatus" SET DEFAULT 'not_required';
