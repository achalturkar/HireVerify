ALTER TABLE "marketing_campaigns"
ADD COLUMN "mail_type" VARCHAR(20) NOT NULL DEFAULT 'CAMPAIGN';

CREATE INDEX "marketing_campaigns_company_id_mail_type_created_at_idx"
ON "marketing_campaigns"("company_id", "mail_type", "created_at");
