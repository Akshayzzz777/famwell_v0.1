-- AlterTable: add doctor-specific columns to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "specialization" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "experience" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "hospital_affiliation" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "education" VARCHAR(512);

-- CreateTable: appointments
CREATE TABLE "appointments" (
    "appointment_id" VARCHAR(64) NOT NULL,
    "patient_id" VARCHAR(36) NOT NULL,
    "doctor_id" VARCHAR(36) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" VARCHAR(10) NOT NULL,
    "type" VARCHAR(30) NOT NULL DEFAULT 'In-Person',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("appointment_id")
);

-- CreateTable: prescriptions
CREATE TABLE "prescriptions" (
    "prescription_id" VARCHAR(64) NOT NULL,
    "doctor_id" VARCHAR(36) NOT NULL,
    "patient_id" VARCHAR(36) NOT NULL,
    "medication" VARCHAR(255) NOT NULL,
    "dosage" VARCHAR(100) NOT NULL,
    "duration" VARCHAR(100) NOT NULL,
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("prescription_id")
);

-- CreateIndex
CREATE INDEX "appointments_patient_id_idx" ON "appointments"("patient_id");
CREATE INDEX "appointments_doctor_id_idx" ON "appointments"("doctor_id");
CREATE INDEX "appointments_status_idx" ON "appointments"("status");
CREATE INDEX "appointments_date_idx" ON "appointments"("date");

-- CreateIndex
CREATE INDEX "prescriptions_doctor_id_idx" ON "prescriptions"("doctor_id");
CREATE INDEX "prescriptions_patient_id_idx" ON "prescriptions"("patient_id");
CREATE INDEX "prescriptions_status_idx" ON "prescriptions"("status");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
