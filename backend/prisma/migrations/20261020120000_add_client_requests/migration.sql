CREATE TYPE "ClientRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "client_requests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "responded_by_id" UUID,
    "category" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ClientRequestStatus" NOT NULL DEFAULT 'OPEN',
    "admin_response" TEXT,
    "responded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "client_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_requests_company_id_status_created_at_idx"
    ON "client_requests"("company_id", "status", "created_at");
CREATE INDEX "client_requests_client_id_created_at_idx"
    ON "client_requests"("client_id", "created_at");

ALTER TABLE "client_requests"
    ADD CONSTRAINT "client_requests_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_requests"
    ADD CONSTRAINT "client_requests_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_requests"
    ADD CONSTRAINT "client_requests_submitted_by_id_fkey"
    FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_requests"
    ADD CONSTRAINT "client_requests_responded_by_id_fkey"
    FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
