-- AlterTable
ALTER TABLE "llm_results" ALTER COLUMN "model_used" SET DEFAULT 'gpt-4';

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "analysis_json" JSONB,
ADD COLUMN     "analyzed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "doctors" (
    "doctor_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "specialization" VARCHAR(100) NOT NULL,
    "experience" VARCHAR(50) NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "health_id" VARCHAR(32) NOT NULL,
    "avatar_url" VARCHAR(512),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("doctor_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctors_health_id_key" ON "doctors"("health_id");

-- CreateIndex
CREATE INDEX "doctors_specialization_idx" ON "doctors"("specialization");
