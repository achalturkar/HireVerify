WITH latest_case AS (
  SELECT DISTINCT ON ("candidate_id")
    "candidate_id",
    "status"
  FROM "bgv_cases"
  ORDER BY "candidate_id", "created_at" DESC
)
UPDATE "candidates" AS candidate
SET "status" = CASE
  WHEN latest_case."status" = 'CANCELLED' THEN 'WITHDRAWN'
  WHEN latest_case."status" IS NOT NULL THEN 'VERIFICATION_IN_PROGRESS'
  ELSE 'IN_PROGRESS'
END::"CandidateStatus"
FROM latest_case
WHERE candidate."id" = latest_case."candidate_id"
  AND candidate."status" = 'COMPLETED'
  AND latest_case."status" <> 'COMPLETED';

UPDATE "candidates" AS candidate
SET "status" = 'IN_PROGRESS'
WHERE candidate."status" = 'COMPLETED'
  AND NOT EXISTS (
    SELECT 1
    FROM "bgv_cases" AS bgv_case
    WHERE bgv_case."candidate_id" = candidate."id"
  );
