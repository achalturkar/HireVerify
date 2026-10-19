ALTER TABLE "candidates"
ADD COLUMN "employment_history" JSONB NOT NULL DEFAULT '[]'::jsonb;
