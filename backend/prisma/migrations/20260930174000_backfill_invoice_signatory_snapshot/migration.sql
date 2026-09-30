UPDATE "invoices" AS invoice
SET "supplier_signature_url" = company."signature_url",
    "supplier_admin_name" = admin.name
FROM "companies" AS company
LEFT JOIN LATERAL (
  SELECT NULLIF(BTRIM(CONCAT_WS(' ', user_account."first_name", user_account."last_name")), '') AS name
  FROM "users" AS user_account
  JOIN "roles" AS user_role ON user_role.id = user_account."role_id"
  WHERE user_account."company_id" = company.id
    AND user_account."is_deleted" = FALSE
    AND user_account.status = 'ACTIVE'
    AND user_role."is_company_admin" = TRUE
  ORDER BY user_account."created_at" ASC
  LIMIT 1
) AS admin ON TRUE
WHERE invoice."company_id" = company.id
  AND (invoice."supplier_signature_url" IS NULL OR invoice."supplier_admin_name" IS NULL);