"""Configuration settings for the document processing system."""

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # API Configuration
    api_host: str = Field(default="0.0.0.0", env="API_HOST")
    api_port: int = Field(default=8000, env="API_PORT")
    api_env: str = Field(default="development", env="API_ENV")
    api_log_level: str = Field(default="INFO", env="API_LOG_LEVEL")

    # JWT Configuration
    jwt_secret_key: str = Field(default="change-me-in-production", env="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    jwt_expiration_hours: int = Field(default=24, env="JWT_EXPIRATION_HOURS")

    # Database
    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/document_processor",
        env="DATABASE_URL"
    )
    database_pool_size: int = Field(default=20, env="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=10, env="DATABASE_MAX_OVERFLOW")
    database_pool_timeout: int = Field(default=30, env="DATABASE_POOL_TIMEOUT")

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    redis_queue_name: str = Field(default="document_processing_jobs", env="REDIS_QUEUE_NAME")
    redis_dlq_name: str = Field(default="document_processing_dlq", env="REDIS_DLQ_NAME")
    redis_ttl_seconds: int = Field(default=86400, env="REDIS_TTL_SECONDS")

    # Google Cloud Storage
    gcs_project_id: str = Field(default="", env="GCS_PROJECT_ID")
    gcs_bucket_name: str = Field(default="document-processor-bucket", env="GCS_BUCKET_NAME")
    gcs_credentials_path: str = Field(default="/secrets/gcs-key.json", env="GCS_CREDENTIALS_PATH")

    # Gemini API
    gemini_api_key: str = Field(default="", env="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.0-flash", env="GEMINI_MODEL")
    gemini_timeout_seconds: int = Field(default=30, env="GEMINI_TIMEOUT_SECONDS")
    gemini_max_retries: int = Field(default=3, env="GEMINI_MAX_RETRIES")
    gemini_retry_delay_seconds: int = Field(default=2, env="GEMINI_RETRY_DELAY_SECONDS")

    # File Upload
    max_file_size_mb: int = Field(default=50, env="MAX_FILE_SIZE_MB")
    allowed_file_types: str = Field(default="pdf", env="ALLOWED_FILE_TYPES")
    virus_scan_enabled: bool = Field(default=False, env="VIRUS_SCAN_ENABLED")

    # Rate Limiting
    rate_limit_requests: int = Field(default=100, env="RATE_LIMIT_REQUESTS")
    rate_limit_window_seconds: int = Field(default=3600, env="RATE_LIMIT_WINDOW_SECONDS")

    # Worker Configuration
    worker_concurrency: int = Field(default=4, env="WORKER_CONCURRENCY")
    worker_job_timeout_seconds: int = Field(default=300, env="WORKER_JOB_TIMEOUT_SECONDS")
    worker_retry_attempts: int = Field(default=3, env="WORKER_RETRY_ATTEMPTS")
    worker_retry_delay_seconds: int = Field(default=5, env="WORKER_RETRY_DELAY_SECONDS")

    # Security
    enable_https: bool = Field(default=False, env="ENABLE_HTTPS")
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:8000",
        env="CORS_ORIGINS"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins as list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def allowed_file_types_list(self) -> List[str]:
        """Parse allowed file types as list."""
        return [ft.strip() for ft in self.allowed_file_types.split(",")]

    @property
    def max_file_size_bytes(self) -> int:
        """Convert max file size to bytes."""
        return self.max_file_size_mb * 1024 * 1024

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
