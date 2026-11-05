WITH latest_case AS (
  SELECT DISTINCT ON ("candidate_id")
    "candidate_id",
    "status"
  FROM "bgv_cases"
  ORDER BY "candidate_id", "created_at" DESC
)
UPDATE "candidates" AS candidate
SET "status" = 'CANCELLED'
FROM latest_case
WHERE candidate."id" = latest_case."candidate_id"
  AND latest_case."status" = 'CANCELLED'
  AND candidate."status" <> 'CANCELLED';
