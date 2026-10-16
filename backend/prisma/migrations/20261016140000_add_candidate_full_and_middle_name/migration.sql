ALTER TABLE "candidates"
ADD COLUMN "middle_name" VARCHAR(100),
ADD COLUMN "full_name" VARCHAR(255);

WITH candidate_names AS (
  SELECT
    "id",
    "last_name",
    regexp_split_to_array(btrim("last_name"), '[[:space:]]+') AS "last_name_parts"
  FROM "candidates"
)
UPDATE "candidates" AS candidate
SET
  "full_name" = regexp_replace(
    concat_ws(' ', btrim(candidate."first_name"), btrim(candidate."last_name")),
    '[[:space:]]+',
    ' ',
    'g'
  ),
  "middle_name" = CASE
    WHEN array_length(candidate_names."last_name_parts", 1) > 1
      THEN array_to_string(candidate_names."last_name_parts"[1:array_length(candidate_names."last_name_parts", 1) - 1], ' ')
    ELSE NULL
  END,
  "last_name" = CASE
    WHEN array_length(candidate_names."last_name_parts", 1) > 1
      THEN candidate_names."last_name_parts"[array_length(candidate_names."last_name_parts", 1)]
    ELSE candidate_names."last_name"
  END
FROM candidate_names
WHERE candidate."id" = candidate_names."id";

ALTER TABLE "candidates"
ALTER COLUMN "full_name" SET NOT NULL;
