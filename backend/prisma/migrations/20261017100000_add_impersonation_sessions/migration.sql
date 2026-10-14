CREATE TABLE "impersonation_sessions" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "impersonation_sessions_actor_user_id_started_at_idx"
    ON "impersonation_sessions"("actor_user_id", "started_at");
CREATE INDEX "impersonation_sessions_target_user_id_started_at_idx"
    ON "impersonation_sessions"("target_user_id", "started_at");
CREATE INDEX "impersonation_sessions_company_id_started_at_idx"
    ON "impersonation_sessions"("company_id", "started_at");
CREATE INDEX "impersonation_sessions_expires_at_idx"
    ON "impersonation_sessions"("expires_at");

ALTER TABLE "impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_target_user_id_fkey"
    FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
