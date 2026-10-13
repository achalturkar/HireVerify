ALTER TABLE "clients"
ADD COLUMN "candidate_form_config" JSONB NOT NULL DEFAULT '{}'::jsonb;
