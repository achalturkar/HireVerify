-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'INVITED', 'IN_PROGRESS', 'VERIFICATION_IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "BGVCaseStatus" AS ENUM ('DRAFT', 'INITIATED', 'CONSENT_PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BGVOverallResult" AS ENUM ('PENDING', 'CLEAR', 'MINOR_DISCREPANCY', 'MAJOR_DISCREPANCY', 'UNABLE_TO_VERIFY', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('PAN', 'UAN', 'COURT', 'IDENTITY', 'ADDRESS', 'EDUCATION', 'EMPLOYMENT', 'DOCUMENT', 'DOCUMENT_FORGERY', 'CIBIL', 'TWENTY_SIX_AS', 'POLICE');

-- CreateEnum
CREATE TYPE "VerificationProvider" AS ENUM ('SUREPASS', 'MANUAL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('PENDING', 'VERIFIED', 'NOT_VERIFIED', 'MATCH', 'MISMATCH', 'NO_RECORD_FOUND', 'RECORD_FOUND', 'REQUIRES_REVIEW', 'UNABLE_TO_VERIFY');

-- CreateEnum
CREATE TYPE "VerificationEventType" AS ENUM ('CREATED', 'QUEUED', 'STARTED', 'API_REQUEST', 'API_RESPONSE', 'WEBHOOK_RECEIVED', 'RETRY', 'COMPLETED', 'FAILED', 'MANUAL_REVIEW', 'STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PAN', 'AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER', 'SALARY_SLIP', 'ADDRESS_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('BGV_CONSENT', 'IDENTITY_VERIFICATION', 'EMPLOYMENT_VERIFICATION', 'COURT_VERIFICATION', 'DOCUMENT_VERIFICATION');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'GENERATED', 'REVIEW_PENDING', 'APPROVED', 'SENT_TO_CLIENT', 'ARCHIVED');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "short_code" VARCHAR(10),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(50),
    "logo_url" VARCHAR(500),
    "signature_url" VARCHAR(500),
    "stamp_url" VARCHAR(500),
    "primary_color" VARCHAR(20),
    "address" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_company_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "role_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "password_hash" VARCHAR(255) NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "jti" VARCHAR(100) NOT NULL,
    "user_agent" VARCHAR(500),
    "ip_address" VARCHAR(50),
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100),
    "metadata" JSONB,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "client_code" VARCHAR(50) NOT NULL,
    "industry" VARCHAR(150),
    "contact_name" VARCHAR(150),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(50),
    "website" VARCHAR(255),
    "gst_number" VARCHAR(30),
    "pan_number" VARCHAR(20),
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postal_code" TEXT,
    "logo_url" VARCHAR(500),
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "candidate_code" VARCHAR(50) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "date_of_birth" DATE,
    "gender" VARCHAR(30),
    "current_address" TEXT,
    "permanent_address" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bgv_cases" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_number" VARCHAR(50) NOT NULL,
    "client_reference" VARCHAR(100),
    "package_name" VARCHAR(150),
    "status" "BGVCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "overallResult" "BGVOverallResult" NOT NULL DEFAULT 'PENDING',
    "initiated_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "assigned_to_id" UUID,
    "remarks" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bgv_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_checks" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "type" "VerificationType" NOT NULL,
    "provider" "VerificationProvider" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "result" "VerificationResult" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "provider_request_id" VARCHAR(150),
    "provider_reference_id" VARCHAR(150),
    "input_data" JSONB,
    "result_data" JSONB,
    "raw_response" JSONB,
    "failure_reason" TEXT,
    "remarks" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "locked_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_events" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "verification_id" UUID,
    "eventType" "VerificationEventType" NOT NULL,
    "status" "VerificationStatus",
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_documents" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "verification_id" UUID,
    "documentType" "DocumentType" NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" VARCHAR(1000) NOT NULL,
    "mime_type" VARCHAR(100),
    "file_size" INTEGER,
    "document_number" VARCHAR(100),
    "verification_status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),
    "remarks" TEXT,

    CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_consents" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "consent_version" VARCHAR(50),
    "consent_text" TEXT,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(500),
    "consented_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bgv_reports" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "report_number" VARCHAR(100) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "overallResult" "BGVOverallResult" NOT NULL,
    "summary" TEXT,
    "report_data" JSONB NOT NULL,
    "pdf_url" VARCHAR(1000),
    "generated_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "sent_to_client_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bgv_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_short_code_key" ON "companies"("short_code");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "companies_is_deleted_idx" ON "companies"("is_deleted");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "roles_company_id_idx" ON "roles"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_company_id_name_key" ON "roles"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_jti_idx" ON "refresh_tokens"("jti");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_idx" ON "audit_logs"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "clients_client_code_key" ON "clients"("client_code");

-- CreateIndex
CREATE INDEX "clients_company_id_idx" ON "clients"("company_id");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_company_id_is_deleted_idx" ON "clients"("company_id", "is_deleted");

-- CreateIndex
CREATE INDEX "candidates_company_id_status_idx" ON "candidates"("company_id", "status");

-- CreateIndex
CREATE INDEX "candidates_company_id_client_id_idx" ON "candidates"("company_id", "client_id");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_company_id_candidate_code_key" ON "candidates"("company_id", "candidate_code");

-- CreateIndex
CREATE UNIQUE INDEX "bgv_cases_case_number_key" ON "bgv_cases"("case_number");

-- CreateIndex
CREATE INDEX "bgv_cases_company_id_status_idx" ON "bgv_cases"("company_id", "status");

-- CreateIndex
CREATE INDEX "bgv_cases_company_id_client_id_idx" ON "bgv_cases"("company_id", "client_id");

-- CreateIndex
CREATE INDEX "bgv_cases_candidate_id_idx" ON "bgv_cases"("candidate_id");

-- CreateIndex
CREATE INDEX "bgv_cases_overallResult_idx" ON "bgv_cases"("overallResult");

-- CreateIndex
CREATE INDEX "verification_checks_case_id_idx" ON "verification_checks"("case_id");

-- CreateIndex
CREATE INDEX "verification_checks_type_idx" ON "verification_checks"("type");

-- CreateIndex
CREATE INDEX "verification_checks_status_idx" ON "verification_checks"("status");

-- CreateIndex
CREATE INDEX "verification_checks_provider_idx" ON "verification_checks"("provider");

-- CreateIndex
CREATE INDEX "verification_checks_provider_reference_id_idx" ON "verification_checks"("provider_reference_id");

-- CreateIndex
CREATE INDEX "verification_events_case_id_idx" ON "verification_events"("case_id");

-- CreateIndex
CREATE INDEX "verification_events_verification_id_idx" ON "verification_events"("verification_id");

-- CreateIndex
CREATE INDEX "verification_events_eventType_idx" ON "verification_events"("eventType");

-- CreateIndex
CREATE INDEX "verification_events_created_at_idx" ON "verification_events"("created_at");

-- CreateIndex
CREATE INDEX "candidate_documents_candidate_id_idx" ON "candidate_documents"("candidate_id");

-- CreateIndex
CREATE INDEX "candidate_documents_verification_id_idx" ON "candidate_documents"("verification_id");

-- CreateIndex
CREATE INDEX "candidate_documents_documentType_idx" ON "candidate_documents"("documentType");

-- CreateIndex
CREATE INDEX "candidate_documents_verification_status_idx" ON "candidate_documents"("verification_status");

-- CreateIndex
CREATE INDEX "candidate_consents_candidate_id_idx" ON "candidate_consents"("candidate_id");

-- CreateIndex
CREATE INDEX "candidate_consents_case_id_idx" ON "candidate_consents"("case_id");

-- CreateIndex
CREATE INDEX "candidate_consents_consentType_idx" ON "candidate_consents"("consentType");

-- CreateIndex
CREATE UNIQUE INDEX "bgv_reports_case_id_key" ON "bgv_reports"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "bgv_reports_report_number_key" ON "bgv_reports"("report_number");

-- CreateIndex
CREATE INDEX "bgv_reports_company_id_idx" ON "bgv_reports"("company_id");

-- CreateIndex
CREATE INDEX "bgv_reports_client_id_idx" ON "bgv_reports"("client_id");

-- CreateIndex
CREATE INDEX "bgv_reports_candidate_id_idx" ON "bgv_reports"("candidate_id");

-- CreateIndex
CREATE INDEX "bgv_reports_status_idx" ON "bgv_reports"("status");

-- CreateIndex
CREATE INDEX "bgv_reports_overallResult_idx" ON "bgv_reports"("overallResult");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bgv_cases" ADD CONSTRAINT "bgv_cases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bgv_cases" ADD CONSTRAINT "bgv_cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bgv_cases" ADD CONSTRAINT "bgv_cases_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_checks" ADD CONSTRAINT "verification_checks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "bgv_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "bgv_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verification_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verification_checks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_consents" ADD CONSTRAINT "candidate_consents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_consents" ADD CONSTRAINT "candidate_consents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "bgv_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bgv_reports" ADD CONSTRAINT "bgv_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bgv_reports" ADD CONSTRAINT "bgv_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bgv_reports" ADD CONSTRAINT "bgv_reports_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bgv_reports" ADD CONSTRAINT "bgv_reports_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "bgv_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
