CREATE TABLE "platform_settings" (
  "key" VARCHAR(100) NOT NULL,
  "value" VARCHAR(255) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);