ALTER TABLE "candidates"
ADD COLUMN "address_verification_locations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
