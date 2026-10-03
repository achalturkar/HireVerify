CREATE TABLE "verification_modes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verification_modes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verification_modes_company_id_name_key" ON "verification_modes"("company_id", "name");
CREATE INDEX "verification_modes_company_id_is_active_idx" ON "verification_modes"("company_id", "is_active");

ALTER TABLE "verification_modes"
ADD CONSTRAINT "verification_modes_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "verification_modes" ("id", "company_id", "name", "is_active", "updated_at")
SELECT gen_random_uuid(), company."id", modes."name", true, CURRENT_TIMESTAMP
FROM "companies" AS company
CROSS JOIN (VALUES
    ('Physical'),
    ('Digital'),
    ('Online'),
    ('Offline'),
    ('Online (GPS)'),
    ('EPFO Government Verification'),
    ('Court Search'),
    ('Document Review'),
    ('Other')
) AS modes("name");
