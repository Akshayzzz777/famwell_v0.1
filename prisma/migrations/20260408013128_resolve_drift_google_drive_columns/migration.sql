-- AlterTable (drift resolution: these columns already exist in production, added via raw SQL)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_access_token" TEXT,
ADD COLUMN IF NOT EXISTS "google_refresh_token" TEXT,
ADD COLUMN IF NOT EXISTS "google_drive_folder_id" VARCHAR(128);

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN IF NOT EXISTS "drive_file_id" VARCHAR(256);
