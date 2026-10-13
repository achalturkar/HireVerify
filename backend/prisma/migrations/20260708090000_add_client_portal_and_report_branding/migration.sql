ALTER TABLE "roles"
ADD COLUMN "is_client_user" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
ADD COLUMN "client_id" UUID,
ADD COLUMN "client_permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "clients"
ADD COLUMN "report_show_company_branding" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "report_show_client_branding" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "users_client_id_idx" ON "users"("client_id");

ALTER TABLE "users"
ADD CONSTRAINT "users_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "clients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
