CREATE TABLE "marketing_smtp_configs" (
    "company_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "from_name" VARCHAR(150) NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketing_smtp_configs_pkey" PRIMARY KEY ("company_id")
);

CREATE TABLE "marketing_leads" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(150),
    "consent_source" VARCHAR(255) NOT NULL,
    "consented_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_campaigns" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SENDING',
    "attachment_names" JSONB NOT NULL DEFAULT '[]',
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_campaign_recipients" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "lead_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "error" VARCHAR(500),
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_campaign_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_leads_company_id_email_key" ON "marketing_leads"("company_id", "email");
CREATE INDEX "marketing_leads_company_id_unsubscribed_at_idx" ON "marketing_leads"("company_id", "unsubscribed_at");
CREATE INDEX "marketing_campaigns_company_id_created_at_idx" ON "marketing_campaigns"("company_id", "created_at");
CREATE INDEX "marketing_campaign_recipients_campaign_id_status_idx" ON "marketing_campaign_recipients"("campaign_id", "status");
CREATE INDEX "marketing_campaign_recipients_lead_id_idx" ON "marketing_campaign_recipients"("lead_id");

ALTER TABLE "marketing_smtp_configs" ADD CONSTRAINT "marketing_smtp_configs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_leads" ADD CONSTRAINT "marketing_leads_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "marketing_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
