ALTER TABLE "companies"
  ADD COLUMN "bank_account_name" VARCHAR(255),
  ADD COLUMN "bank_name" VARCHAR(255),
  ADD COLUMN "bank_account_number" VARCHAR(80),
  ADD COLUMN "bank_ifsc_code" VARCHAR(20),
  ADD COLUMN "bank_swift_code" VARCHAR(20),
  ADD COLUMN "bank_branch" VARCHAR(255),
  ADD COLUMN "upi_id" VARCHAR(100);

ALTER TABLE "invoices"
  ADD COLUMN "supplier_bank_account_name" VARCHAR(255),
  ADD COLUMN "supplier_bank_name" VARCHAR(255),
  ADD COLUMN "supplier_bank_account_number" VARCHAR(80),
  ADD COLUMN "supplier_bank_ifsc_code" VARCHAR(20),
  ADD COLUMN "supplier_bank_swift_code" VARCHAR(20),
  ADD COLUMN "supplier_bank_branch" VARCHAR(255),
  ADD COLUMN "supplier_upi_id" VARCHAR(100);