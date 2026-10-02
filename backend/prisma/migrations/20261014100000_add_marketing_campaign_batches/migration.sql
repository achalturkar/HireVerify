ALTER TABLE "marketing_campaigns"
ADD COLUMN "next_batch_at" TIMESTAMPTZ(6);

CREATE TABLE "marketing_campaign_attachments" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(150) NOT NULL,
    "content" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_campaign_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_campaign_attachments_campaign_id_idx"
ON "marketing_campaign_attachments"("campaign_id");

ALTER TABLE "marketing_campaign_attachments"
ADD CONSTRAINT "marketing_campaign_attachments_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
