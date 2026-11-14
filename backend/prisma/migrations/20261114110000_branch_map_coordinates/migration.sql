-- Additive: existing addresses and branch codes are preserved. Old branches have no pin.
ALTER TABLE "Branch" ADD COLUMN "latitude" DOUBLE PRECISION,
                     ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_location_coordinates_check" CHECK (
  ("latitude" IS NULL AND "longitude" IS NULL) OR
  ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND
   "latitude" >= -90 AND "latitude" <= 90 AND "longitude" >= -180 AND "longitude" <= 180)
);
