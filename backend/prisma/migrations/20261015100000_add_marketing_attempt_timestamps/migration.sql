ALTER TABLE "marketing_campaign_recipients"
ADD COLUMN "attempted_at" TIMESTAMPTZ(6);

CREATE INDEX "marketing_campaign_recipients_attempted_at_idx"
ON "marketing_campaign_recipients"("attempted_at");
