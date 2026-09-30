CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

ALTER TABLE "companies"
  ADD COLUMN "gst_number" VARCHAR(30),
  ADD COLUMN "pan_number" VARCHAR(20),
  ADD COLUMN "city" VARCHAR(120),
  ADD COLUMN "state" VARCHAR(120),
  ADD COLUMN "postal_code" VARCHAR(20);

CREATE TABLE "invoice_sequences" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "invoice_number" VARCHAR(60) NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "invoice_date" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "supplier_name" VARCHAR(255) NOT NULL,
  "supplier_address" TEXT,
  "supplier_gst" VARCHAR(30),
  "supplier_pan" VARCHAR(20),
  "supplier_state" VARCHAR(120),
  "supplier_city" VARCHAR(120),
  "supplier_postal_code" VARCHAR(20),
  "supplier_email" VARCHAR(255),
  "supplier_phone" VARCHAR(50),
  "supplier_logo_url" VARCHAR(500),
  "client_name" VARCHAR(255) NOT NULL,
  "client_address" TEXT,
  "client_gst" VARCHAR(30),
  "client_pan" VARCHAR(20),
  "client_state" VARCHAR(120),
  "client_email" VARCHAR(255),
  "place_of_supply" VARCHAR(120),
  "tax_type" VARCHAR(20) NOT NULL DEFAULT 'NONE',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "purchase_order_number" VARCHAR(100),
  "subtotal" DECIMAL(14,2) NOT NULL,
  "discount_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "tax_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL,
  "notes" TEXT,
  "terms" TEXT,
  "sent_at" TIMESTAMPTZ(6),
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_items" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "case_id" UUID,
  "description" VARCHAR(500) NOT NULL,
  "candidate_name" VARCHAR(255),
  "service_code" VARCHAR(30),
  "quantity" DECIMAL(12,3) NOT NULL,
  "unit_price" DECIMAL(14,2) NOT NULL,
  "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "tax_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "taxable_amount" DECIMAL(14,2) NOT NULL,
  "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_payments" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "payment_date" DATE NOT NULL,
  "method" VARCHAR(40),
  "reference" VARCHAR(120),
  "notes" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_activities" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "actor_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_sequences_company_id_year_key" ON "invoice_sequences"("company_id", "year");
CREATE UNIQUE INDEX "invoices_company_id_invoice_number_key" ON "invoices"("company_id", "invoice_number");
CREATE INDEX "invoices_company_id_status_invoice_date_idx" ON "invoices"("company_id", "status", "invoice_date");
CREATE INDEX "invoices_company_id_client_id_idx" ON "invoices"("company_id", "client_id");
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");
CREATE INDEX "invoice_items_case_id_idx" ON "invoice_items"("case_id");
CREATE INDEX "invoice_payments_invoice_id_payment_date_idx" ON "invoice_payments"("invoice_id", "payment_date");
CREATE INDEX "invoice_activities_invoice_id_created_at_idx" ON "invoice_activities"("invoice_id", "created_at");

ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "bgv_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_activities" ADD CONSTRAINT "invoice_activities_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;