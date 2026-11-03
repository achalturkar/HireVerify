ALTER TABLE "candidates" ADD COLUMN "company_remark" TEXT;

UPDATE "candidates" AS candidate
SET "company_remark" = statements.candidate_statement
FROM (
  SELECT "candidate_id", string_agg("candidate_statement", E'\n\n' ORDER BY "updated_at" DESC) AS candidate_statement
  FROM "bgv_cases"
  WHERE "candidate_statement" IS NOT NULL AND btrim("candidate_statement") <> ''
  GROUP BY "candidate_id"
) AS statements
WHERE candidate."id" = statements."candidate_id";

ALTER TABLE "bgv_cases" DROP COLUMN "candidate_statement";
