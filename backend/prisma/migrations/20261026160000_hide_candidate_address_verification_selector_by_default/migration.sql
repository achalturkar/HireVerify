UPDATE "clients"
SET "candidate_form_config" = jsonb_set(
  "candidate_form_config",
  '{address,showVerificationLocationSelector}',
  'false'::jsonb,
  true
)
WHERE "candidate_form_config" #> '{address,showVerificationLocationSelector}' = 'true'::jsonb;
