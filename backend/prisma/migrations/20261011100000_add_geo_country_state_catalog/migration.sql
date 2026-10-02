CREATE TABLE "geo_countries" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "geo_countries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "geo_states" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "geo_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "geo_countries_name_key" ON "geo_countries"("name");
CREATE UNIQUE INDEX "geo_states_country_id_name_key" ON "geo_states"("country_id", "name");
CREATE INDEX "geo_states_country_id_is_active_idx" ON "geo_states"("country_id", "is_active");

ALTER TABLE "geo_states"
ADD CONSTRAINT "geo_states_country_id_fkey"
FOREIGN KEY ("country_id") REFERENCES "geo_countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;