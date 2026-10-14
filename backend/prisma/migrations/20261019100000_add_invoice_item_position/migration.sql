ALTER TABLE "invoice_items"
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ordered_items AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (PARTITION BY "invoice_id" ORDER BY "id") - 1 AS "position"
    FROM "invoice_items"
)
UPDATE "invoice_items" AS item
SET "position" = ordered_items."position"
FROM ordered_items
WHERE item."id" = ordered_items."id";

DROP INDEX IF EXISTS "invoice_items_invoice_id_idx";

CREATE INDEX "invoice_items_invoice_id_position_idx"
ON "invoice_items"("invoice_id", "position");
