-- CreateTable
CREATE TABLE "users" (
    "user_id" VARCHAR(36) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "role" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "full_name" TEXT,
    "phone_number" TEXT,
    "health_id" VARCHAR(32),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "files" (
    "file_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "file_hash" VARCHAR(64) NOT NULL,
    "gcs_path" VARCHAR(512) NOT NULL,
    "scan_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("file_id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "job_id" VARCHAR(36) NOT NULL,
    "file_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "extracted_json" (
    "extraction_id" VARCHAR(36) NOT NULL,
    "job_id" VARCHAR(36) NOT NULL,
    "extracted_data" JSONB NOT NULL,
    "validation_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "validation_errors" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_json_pkey" PRIMARY KEY ("extraction_id")
);

-- CreateTable
CREATE TABLE "llm_results" (
    "result_id" VARCHAR(36) NOT NULL,
    "job_id" VARCHAR(36) NOT NULL,
    "prompt_sent" TEXT NOT NULL,
    "llm_response" TEXT NOT NULL,
    "structured_output" JSONB,
    "processing_time_seconds" DOUBLE PRECISION NOT NULL,
    "tokens_used" INTEGER,
    "model_used" VARCHAR(100) NOT NULL DEFAULT 'gemini-2.0-flash',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_results_pkey" PRIMARY KEY ("result_id")
);

-- CreateTable
CREATE TABLE "processing_metrics" (
    "metric_id" VARCHAR(36) NOT NULL,
    "job_id" VARCHAR(36),
    "metric_type" VARCHAR(100) NOT NULL,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "processing_metrics_pkey" PRIMARY KEY ("metric_id")
);

-- CreateTable
CREATE TABLE "records" (
    "record_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "record_type" VARCHAR(100) NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "records_pkey" PRIMARY KEY ("record_id")
);

-- CreateTable
CREATE TABLE "connections" (
    "connection_id" VARCHAR(64) NOT NULL,
    "follower_id" VARCHAR(36) NOT NULL,
    "following_id" VARCHAR(36) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("connection_id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "medical_record_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "file_url" VARCHAR(1024) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "record_type" VARCHAR(100) NOT NULL DEFAULT 'general',
    "upload_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("medical_record_id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "conversation_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("conversation_id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "message_id" VARCHAR(64) NOT NULL,
    "conversation_id" VARCHAR(64) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_health_id_key" ON "users"("health_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "files_file_hash_key" ON "files"("file_hash");

-- CreateIndex
CREATE INDEX "files_user_id_idx" ON "files"("user_id");

-- CreateIndex
CREATE INDEX "files_file_hash_idx" ON "files"("file_hash");

-- CreateIndex
CREATE INDEX "jobs_user_id_idx" ON "jobs"("user_id");

-- CreateIndex
CREATE INDEX "jobs_file_id_idx" ON "jobs"("file_id");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "extracted_json_job_id_key" ON "extracted_json"("job_id");

-- CreateIndex
CREATE INDEX "extracted_json_job_id_idx" ON "extracted_json"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "llm_results_job_id_key" ON "llm_results"("job_id");

-- CreateIndex
CREATE INDEX "llm_results_job_id_idx" ON "llm_results"("job_id");

-- CreateIndex
CREATE INDEX "processing_metrics_metric_type_idx" ON "processing_metrics"("metric_type");

-- CreateIndex
CREATE INDEX "processing_metrics_timestamp_idx" ON "processing_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "processing_metrics_job_id_idx" ON "processing_metrics"("job_id");

-- CreateIndex
CREATE INDEX "records_user_id_idx" ON "records"("user_id");

-- CreateIndex
CREATE INDEX "records_record_type_idx" ON "records"("record_type");

-- CreateIndex
CREATE INDEX "connections_follower_id_idx" ON "connections"("follower_id");

-- CreateIndex
CREATE INDEX "connections_following_id_idx" ON "connections"("following_id");

-- CreateIndex
CREATE INDEX "connections_status_idx" ON "connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "connections_follower_id_following_id_key" ON "connections"("follower_id", "following_id");

-- CreateIndex
CREATE INDEX "medical_records_user_id_idx" ON "medical_records"("user_id");

-- CreateIndex
CREATE INDEX "medical_records_record_type_idx" ON "medical_records"("record_type");

-- CreateIndex
CREATE INDEX "chat_conversations_user_id_idx" ON "chat_conversations"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("file_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_json" ADD CONSTRAINT "extracted_json_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("job_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_results" ADD CONSTRAINT "llm_results_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("job_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_metrics" ADD CONSTRAINT "processing_metrics_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("job_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("conversation_id") ON DELETE CASCADE ON UPDATE CASCADE;
