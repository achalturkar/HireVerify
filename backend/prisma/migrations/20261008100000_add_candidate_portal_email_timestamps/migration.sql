ALTER TABLE "candidate_portal_invitations"
ADD COLUMN "activated_at" TIMESTAMPTZ(6),
ADD COLUMN "last_sent_at" TIMESTAMPTZ(6);

UPDATE "candidate_portal_invitations"
SET "activated_at" = "created_at"
WHERE "activated_at" IS NULL;

ALTER TABLE "candidate_portal_invitations"
ALTER COLUMN "activated_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "activated_at" SET NOT NULL;