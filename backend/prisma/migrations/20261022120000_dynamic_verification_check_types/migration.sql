ALTER TABLE "verification_checks"
  ALTER COLUMN "type" TYPE VARCHAR(60) USING "type"::text;

DROP TYPE "VerificationType";

CREATE TABLE "verification_check_types" (
  "type" VARCHAR(60) NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "default_provider" "VerificationProvider" NOT NULL DEFAULT 'MANUAL',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "verification_check_types_pkey" PRIMARY KEY ("type")
);

CREATE UNIQUE INDEX "verification_check_types_label_key"
  ON "verification_check_types"("label");
CREATE INDEX "verification_check_types_is_active_created_at_idx"
  ON "verification_check_types"("is_active", "created_at");

INSERT INTO "verification_check_types" ("type", "label", "default_provider", "updated_at")
VALUES
  ('PAN', 'PAN', 'SUREPASS', CURRENT_TIMESTAMP),
  ('UAN', 'UAN', 'SUREPASS', CURRENT_TIMESTAMP),
  ('COURT', 'Criminal Record', 'SUREPASS', CURRENT_TIMESTAMP),
  ('IDENTITY', 'Identity', 'MANUAL', CURRENT_TIMESTAMP),
  ('ADDRESS', 'Address', 'MANUAL', CURRENT_TIMESTAMP),
  ('ADDRESS_PHYSICAL', 'Address (Physical)', 'MANUAL', CURRENT_TIMESTAMP),
  ('EDUCATION', 'Education', 'MANUAL', CURRENT_TIMESTAMP),
  ('EMPLOYMENT', 'Employment', 'MANUAL', CURRENT_TIMESTAMP),
  ('GAP', 'Gap Check', 'MANUAL', CURRENT_TIMESTAMP),
  ('REFERENCE', 'Reference Check', 'MANUAL', CURRENT_TIMESTAMP),
  ('CV', 'CV Validation', 'MANUAL', CURRENT_TIMESTAMP),
  ('SOCIAL_MEDIA', 'Social Media', 'MANUAL', CURRENT_TIMESTAMP),
  ('DOCUMENT', 'Documents', 'MANUAL', CURRENT_TIMESTAMP),
  ('DOCUMENT_FORGERY', 'Document Forgery', 'MANUAL', CURRENT_TIMESTAMP),
  ('CIBIL', 'CIBIL', 'MANUAL', CURRENT_TIMESTAMP),
  ('TWENTY_SIX_AS', '26AS', 'MANUAL', CURRENT_TIMESTAMP),
  ('POLICE', 'Police Verification', 'MANUAL', CURRENT_TIMESTAMP),
  ('POLICE_RECORD', 'Police Record', 'MANUAL', CURRENT_TIMESTAMP);

ALTER TABLE "verification_checks"
  ADD CONSTRAINT "verification_checks_type_fkey"
  FOREIGN KEY ("type") REFERENCES "verification_check_types"("type")
  ON DELETE RESTRICT ON UPDATE CASCADE;
