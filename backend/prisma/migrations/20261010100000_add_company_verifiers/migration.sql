CREATE TABLE "verifiers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verifiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verifiers_company_id_name_key" ON "verifiers"("company_id", "name");
CREATE INDEX "verifiers_company_id_is_active_idx" ON "verifiers"("company_id", "is_active");

ALTER TABLE "verifiers"
ADD CONSTRAINT "verifiers_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;