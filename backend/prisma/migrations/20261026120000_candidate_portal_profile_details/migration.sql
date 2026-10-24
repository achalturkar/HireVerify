ALTER TABLE "candidates"
ADD COLUMN "marital_status" VARCHAR(30),
ADD COLUMN "spouse_name" VARCHAR(255),
ADD COLUMN "children_count" INTEGER,
ADD COLUMN "candidate_notes" TEXT,
ADD COLUMN "education_history" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "employer_hr_name" VARCHAR(255),
ADD COLUMN "employer_hr_phone" VARCHAR(50);
