UPDATE "invoices" AS invoice
SET "supplier_primary_color" = company."primary_color"
FROM "companies" AS company
WHERE invoice."company_id" = company."id"
  AND invoice."supplier_primary_color" IS NULL
  AND company."primary_color" IS NOT NULL;