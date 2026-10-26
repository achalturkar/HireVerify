ALTER TABLE "invoices"
ADD COLUMN "billing_period_from" DATE,
ADD COLUMN "billing_period_to" DATE;

ALTER TABLE "invoice_items"
ADD COLUMN "is_period_summary" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE "invoice_period_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_period_cases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_period_cases_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_period_cases_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "bgv_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "invoice_period_cases_invoice_id_case_id_key"
ON "invoice_period_cases"("invoice_id", "case_id");

CREATE INDEX "invoice_period_cases_case_id_idx"
ON "invoice_period_cases"("case_id");
