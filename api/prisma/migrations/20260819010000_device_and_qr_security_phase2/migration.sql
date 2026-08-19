CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Preserve currently issued QR tokens while removing plaintext storage.
ALTER TABLE "bookings"
  ADD COLUMN "qr_token_hash" TEXT,
  ADD COLUMN "walk_in_requester_name" TEXT,
  ADD COLUMN "walk_in_requester_reference" TEXT;

UPDATE "bookings"
SET "qr_token_hash" = encode(digest("qr_token", 'sha256'), 'hex')
WHERE "qr_token" IS NOT NULL;

-- Keep the legacy column for one rolling deployment so old application
-- machines can still prepare their SELECT statements, but scrub all secrets
-- and reject any legacy plaintext writes. Drop it in a later cleanup migration.
UPDATE "bookings" SET "qr_token" = NULL;
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_legacy_qr_token_empty" CHECK ("qr_token" IS NULL);
CREATE UNIQUE INDEX "bookings_qr_token_hash_key" ON "bookings"("qr_token_hash");
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_qr_token_hash_format" CHECK (
    "qr_token_hash" IS NULL OR "qr_token_hash" ~ '^[0-9a-f]{64}$'
  );

-- Existing device credentials remain valid after being irreversibly hashed.
ALTER TABLE "devices"
  ADD COLUMN "device_key_hash" TEXT,
  ADD COLUMN "device_key_prefix" TEXT,
  ADD COLUMN "credential_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "credential_rotated_at" TIMESTAMPTZ(3),
  ADD COLUMN "revoked_at" TIMESTAMPTZ(3),
  ADD COLUMN "walk_in_principal_id" TEXT;

UPDATE "devices"
SET
  "device_key_hash" = encode(digest("device_key", 'sha256'), 'hex'),
  "device_key_prefix" = left("device_key", 11),
  "credential_rotated_at" = "created_at",
  "device_key" = 'migrated:' || left(encode(digest("device_key", 'sha256'), 'hex'), 24);

ALTER TABLE "user" ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "user" (
  "id", "name", "email", "emailVerified", "createdAt", "updatedAt",
  "role", "is_system"
)
SELECT
  'system:walk-in:' || d."id",
  'Walk-in via ' || d."name",
  'walk-in+' || replace(d."id", '-', '') || '@roomflow.internal',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'userRole',
  true
FROM "devices" d
ON CONFLICT ("id") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "devices" d
    JOIN "user" u ON u."id" = 'system:walk-in:' || d."id"
    WHERE NOT u."is_system"
  ) THEN
    RAISE EXCEPTION 'Phase 2 migration blocked: a walk-in principal ID is already used by a normal user';
  END IF;
END $$;

UPDATE "devices"
SET "walk_in_principal_id" = 'system:walk-in:' || "id";

ALTER TABLE "devices"
  ALTER COLUMN "device_key_hash" SET NOT NULL,
  ALTER COLUMN "device_key_prefix" SET NOT NULL,
  ALTER COLUMN "credential_rotated_at" SET NOT NULL,
  ALTER COLUMN "walk_in_principal_id" SET NOT NULL,
  ADD CONSTRAINT "devices_device_key_hash_format" CHECK ("device_key_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "devices_legacy_device_key_scrubbed" CHECK ("device_key" ~ '^migrated:[0-9a-f]{24}$'),
  ADD CONSTRAINT "devices_credential_version_positive" CHECK ("credential_version" > 0),
  ADD CONSTRAINT "devices_walk_in_principal_id_fkey"
    FOREIGN KEY ("walk_in_principal_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "devices_device_key_hash_key" ON "devices"("device_key_hash");
CREATE UNIQUE INDEX "devices_walk_in_principal_id_key" ON "devices"("walk_in_principal_id");
CREATE INDEX "devices_last_seen_at_idx" ON "devices"("last_seen_at");

CREATE TABLE "device_pairing_codes" (
  "id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_pairing_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_pairing_codes_time_order" CHECK (
    "expires_at" > "created_at"
    AND ("consumed_at" IS NULL OR "consumed_at" >= "created_at")
  ),
  CONSTRAINT "device_pairing_codes_hash_format" CHECK ("code_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "device_pairing_codes_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "device_pairing_codes_code_hash_key" ON "device_pairing_codes"("code_hash");
CREATE INDEX "device_pairing_codes_device_id_expires_at_idx" ON "device_pairing_codes"("device_id", "expires_at");
CREATE INDEX "device_pairing_codes_expires_at_consumed_at_idx" ON "device_pairing_codes"("expires_at", "consumed_at");

CREATE TABLE "rate_limit_buckets" (
  "scope" TEXT NOT NULL,
  "subject_hash" TEXT NOT NULL,
  "window_started_at" TIMESTAMPTZ(3) NOT NULL,
  "count" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("scope", "subject_hash"),
  CONSTRAINT "rate_limit_buckets_count_positive" CHECK ("count" > 0),
  CONSTRAINT "rate_limit_buckets_subject_hash_format" CHECK ("subject_hash" ~ '^[0-9a-f]{64}$')
);

CREATE INDEX "rate_limit_buckets_updated_at_idx" ON "rate_limit_buckets"("updated_at");
