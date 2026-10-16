ALTER TABLE "clients"
  ADD COLUMN "parent_client_id" UUID,
  ADD COLUMN "service_rates" JSONB NOT NULL DEFAULT '[]'::JSONB;

CREATE INDEX "clients_parent_client_id_idx" ON "clients"("parent_client_id");

ALTER TABLE "clients"
  ADD CONSTRAINT "clients_parent_client_id_fkey"
  FOREIGN KEY ("parent_client_id") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidates"
  ADD COLUMN "subclient_id" UUID;

CREATE INDEX "candidates_subclient_id_idx" ON "candidates"("subclient_id");

ALTER TABLE "candidates"
  ADD CONSTRAINT "candidates_subclient_id_fkey"
  FOREIGN KEY ("subclient_id") REFERENCES "clients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bgv_cases"
  ADD COLUMN "subclient_id" UUID;

CREATE INDEX "bgv_cases_subclient_id_idx" ON "bgv_cases"("subclient_id");

ALTER TABLE "bgv_cases"
  ADD CONSTRAINT "bgv_cases_subclient_id_fkey"
  FOREIGN KEY ("subclient_id") REFERENCES "clients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
