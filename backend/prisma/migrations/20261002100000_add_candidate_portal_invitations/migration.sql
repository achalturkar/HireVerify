CREATE TABLE "candidate_portal_invitations" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_reminded_at" TIMESTAMPTZ(6),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "candidate_portal_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_portal_invitations_candidate_id_key" ON "candidate_portal_invitations"("candidate_id");
CREATE UNIQUE INDEX "candidate_portal_invitations_token_hash_key" ON "candidate_portal_invitations"("token_hash");
CREATE INDEX "candidate_portal_invitations_expires_at_revoked_at_idx" ON "candidate_portal_invitations"("expires_at", "revoked_at");
ALTER TABLE "candidate_portal_invitations" ADD CONSTRAINT "candidate_portal_invitations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
