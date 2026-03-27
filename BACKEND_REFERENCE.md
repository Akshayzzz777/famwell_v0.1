# FamWell Backend — Complete Reference

> Single-file documentation of the entire backend: architecture, API routes, database schema, worker pipeline, shared modules, configuration, and infrastructure. Intended as model context and developer reference.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Infrastructure & Services](#2-infrastructure--services)
3. [Configuration (`backend/config/settings.py`)](#3-configuration)
4. [Database Schema (Prisma)](#4-database-schema)
5. [API Routes](#5-api-routes)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Middleware](#7-middleware)
8. [Shared Modules](#8-shared-modules)
9. [Worker Pipeline](#9-worker-pipeline)
10. [Environment Variables](#10-environment-variables)
11. [Error Handling](#11-error-handling)
12. [File & Directory Map](#12-file--directory-map)
13. [What's Built (Complete)](#13-whats-built-complete)
14. [What's Left to Build](#14-whats-left-to-build)

---

## 1. Architecture Overview

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Frontend   │──────▶│  FastAPI API  │──────▶│  PostgreSQL  │
│  (Expo/RN)   │  HTTP │  port 8000   │ Prisma│  port 5432   │
└──────────────┘       └──────┬───────┘       └──────────────┘
                              │ enqueue
                       ┌──────▼───────┐
                       │    Redis     │
                       │  port 6379   │
                       └──────┬───────┘
                              │ dequeue
                       ┌──────▼───────┐       ┌──────────────┐
                       │   Worker     │──────▶│  Google Cloud │
                       │  (async)     │  GCS  │   Storage    │
                       └──────┬───────┘       └──────────────┘
                              │ LLM call
                       ┌──────▼───────┐
                       │  Gemini API  │
                       │ gemini-2.0   │
                       └──────────────┘
```

**Flow:** Upload PDF → validate & store in GCS → enqueue job in Redis → Worker dequeues → extract text via PyPDF2 → send to Gemini LLM → store structured results in PostgreSQL → client polls for status/result.

---

## 2. Infrastructure & Services

Defined in `docker-compose.yml`. Four core services + optional pgAdmin.

| Service    | Image              | Port  | Purpose                          |
|------------|--------------------|-------|----------------------------------|
| `postgres` | postgres:15-alpine | 5432  | Primary database                 |
| `redis`    | redis:7-alpine     | 6379  | Job queue & rate-limit store     |
| `api`      | Dockerfile.api     | 8000  | FastAPI HTTP server              |
| `worker`   | Dockerfile.worker  | —     | Async PDF/LLM processing worker  |
| `pgadmin`  | pgadmin4 (opt.)    | 5050  | Database GUI                     |

**Network:** `doc_processor_network` (default bridge).  
**Volumes:** `postgres_data`, `redis_data` (persistent).

---

## 3. Configuration

**File:** `backend/config/settings.py`  
**Class:** `Settings(BaseSettings)` — reads from environment variables and `.env` file.

| Category       | Key                          | Default                                                     | Env Var                      |
|----------------|------------------------------|-------------------------------------------------------------|------------------------------|
| API            | `api_host`                   | `0.0.0.0`                                                   | `API_HOST`                   |
| API            | `api_port`                   | `8000`                                                      | `API_PORT`                   |
| API            | `api_env`                    | `development`                                               | `API_ENV`                    |
| API            | `api_log_level`              | `INFO`                                                      | `API_LOG_LEVEL`              |
| JWT            | `jwt_secret_key`             | `change-me-in-production`                                   | `JWT_SECRET_KEY`             |
| JWT            | `jwt_algorithm`              | `HS256`                                                     | `JWT_ALGORITHM`              |
| JWT            | `jwt_expiration_hours`       | `24`                                                        | `JWT_EXPIRATION_HOURS`       |
| Database       | `database_url`               | `postgresql://postgres:postgres@localhost:5432/document_processor` | `DATABASE_URL`         |
| Database       | `database_pool_size`         | `20`                                                        | `DATABASE_POOL_SIZE`         |
| Database       | `database_max_overflow`      | `10`                                                        | `DATABASE_MAX_OVERFLOW`      |
| Database       | `database_pool_timeout`      | `30`                                                        | `DATABASE_POOL_TIMEOUT`      |
| Redis          | `redis_url`                  | `redis://localhost:6379/0`                                  | `REDIS_URL`                  |
| Redis          | `redis_queue_name`           | `document_processing_jobs`                                  | `REDIS_QUEUE_NAME`           |
| Redis          | `redis_dlq_name`             | `document_processing_dlq`                                   | `REDIS_DLQ_NAME`             |
| Redis          | `redis_ttl_seconds`          | `86400`                                                     | `REDIS_TTL_SECONDS`          |
| GCS            | `gcs_project_id`             | `""`                                                        | `GCS_PROJECT_ID`             |
| GCS            | `gcs_bucket_name`            | `document-processor-bucket`                                 | `GCS_BUCKET_NAME`            |
| GCS            | `gcs_credentials_path`       | `/secrets/gcs-key.json`                                     | `GCS_CREDENTIALS_PATH`       |
| Gemini         | `gemini_api_key`             | `""`                                                        | `GEMINI_API_KEY`             |
| Gemini         | `gemini_model`               | `gemini-2.0-flash`                                          | `GEMINI_MODEL`               |
| Gemini         | `gemini_timeout_seconds`     | `30`                                                        | `GEMINI_TIMEOUT_SECONDS`     |
| Gemini         | `gemini_max_retries`         | `3`                                                         | `GEMINI_MAX_RETRIES`         |
| Gemini         | `gemini_retry_delay_seconds` | `2`                                                         | `GEMINI_RETRY_DELAY_SECONDS` |
| Upload         | `max_file_size_mb`           | `50`                                                        | `MAX_FILE_SIZE_MB`           |
| Upload         | `allowed_file_types`         | `pdf`                                                       | `ALLOWED_FILE_TYPES`         |
| Upload         | `virus_scan_enabled`         | `False`                                                     | `VIRUS_SCAN_ENABLED`         |
| Rate Limit     | `rate_limit_requests`        | `100`                                                       | `RATE_LIMIT_REQUESTS`        |
| Rate Limit     | `rate_limit_window_seconds`  | `3600`                                                      | `RATE_LIMIT_WINDOW_SECONDS`  |
| Worker         | `worker_concurrency`         | `4`                                                         | `WORKER_CONCURRENCY`         |
| Worker         | `worker_job_timeout_seconds` | `300`                                                       | `WORKER_JOB_TIMEOUT_SECONDS` |
| Worker         | `worker_retry_attempts`      | `3`                                                         | `WORKER_RETRY_ATTEMPTS`      |
| Worker         | `worker_retry_delay_seconds` | `5`                                                         | `WORKER_RETRY_DELAY_SECONDS` |
| Security       | `enable_https`               | `False`                                                     | `ENABLE_HTTPS`               |
| Security       | `cors_origins`               | `http://localhost:3000,http://localhost:8000`                | `CORS_ORIGINS`               |

**Computed Properties:**
- `cors_origins_list` → `List[str]` (comma-split)
- `allowed_file_types_list` → `List[str]` (comma-split)
- `max_file_size_bytes` → `int` (MB × 1024 × 1024)

---

## 4. Database Schema

**ORM:** Prisma Client Python (`prisma-client-py`)  
**Provider:** PostgreSQL  
**Schema file:** `prisma/schema.prisma`

### 4.1 Entity-Relationship Diagram

```
User 1──* File 1──* Job 1──1 ExtractedJSON
  │                   │──1 LLMResult
  │                   └──* ProcessingMetric
  ├──* Record
  ├──* Connection (follower)
  └──* Connection (following)
```

### 4.2 Models

#### `User` → table `users`

| Column         | Type         | Constraints                      |
|----------------|--------------|----------------------------------|
| `user_id`      | VarChar(36)  | PK, CUID                        |
| `email`        | VarChar(255) | UNIQUE                           |
| `password`     | VarChar(255) | Hashed (PBKDF2 or bcrypt)       |
| `created_at`   | DateTime     | Default: `now()`                 |
| `is_active`    | Boolean      | Default: `true`                  |
| `role`         | VarChar(20)  | Default: `"USER"` (`USER` or `DOCTOR`) |
| `full_name`    | Text         | Nullable                         |
| `phone_number` | Text         | Nullable                         |
| `health_id`    | VarChar(32)  | UNIQUE, nullable, format `HW-XXXXXXXX` |

**Indexes:** `email`  
**Relations:** `files[]`, `jobs[]`, `records[]`, `outgoingConnections[]`, `incomingConnections[]`

#### `File` → table `files`

| Column           | Type         | Constraints                |
|------------------|--------------|----------------------------|
| `file_id`        | VarChar(36)  | PK, CUID                  |
| `user_id`        | VarChar(36)  | FK → `users.user_id`      |
| `filename`       | VarChar(255) |                            |
| `file_size_bytes`| Int          |                            |
| `file_hash`      | VarChar(64)  | UNIQUE (SHA-256)           |
| `gcs_path`       | VarChar(512) | GCS object path            |
| `scan_status`    | VarChar(50)  | Default: `"pending"`       |
| `created_at`     | DateTime     | Default: `now()`           |
| `updated_at`     | DateTime     | Auto-updated               |

**Indexes:** `user_id`, `file_hash`  
**OnDelete:** CASCADE from User

#### `Job` → table `jobs`

| Column          | Type        | Constraints                |
|-----------------|-------------|----------------------------|
| `job_id`        | VarChar(36) | PK, CUID                  |
| `file_id`       | VarChar(36) | FK → `files.file_id`      |
| `user_id`       | VarChar(36) | FK → `users.user_id`      |
| `status`        | VarChar(50) | Default: `"PENDING"` — values: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `created_at`    | DateTime    | Default: `now()`           |
| `started_at`    | DateTime    | Nullable                   |
| `completed_at`  | DateTime    | Nullable                   |
| `retry_count`   | Int         | Default: `0`               |
| `error_message` | String      | Nullable                   |
| `updated_at`    | DateTime    | Auto-updated               |

**Indexes:** `user_id`, `file_id`, `status`  
**OnDelete:** CASCADE from File and User

#### `ExtractedJSON` → table `extracted_json`

| Column              | Type        | Constraints              |
|---------------------|-------------|--------------------------|
| `extraction_id`     | VarChar(36) | PK, CUID                |
| `job_id`            | VarChar(36) | FK → `jobs.job_id`, UNIQUE |
| `extracted_data`    | Json        | Validated against schema |
| `validation_status` | VarChar(50) | Default: `"pending"`     |
| `validation_errors` | String      | Nullable                 |
| `created_at`        | DateTime    | Default: `now()`         |
| `updated_at`        | DateTime    | Auto-updated             |

**Indexes:** `job_id`  
**OnDelete:** CASCADE from Job  
**Relation:** One-to-one with Job

#### `LLMResult` → table `llm_results`

| Column                    | Type         | Constraints              |
|---------------------------|--------------|--------------------------|
| `result_id`               | VarChar(36)  | PK, CUID                |
| `job_id`                  | VarChar(36)  | FK → `jobs.job_id`, UNIQUE |
| `prompt_sent`             | Text         | Full prompt string       |
| `llm_response`            | Text         | Raw LLM output           |
| `structured_output`       | Json         | Nullable, parsed JSON    |
| `processing_time_seconds` | Float        |                          |
| `tokens_used`             | Int          | Nullable                 |
| `model_used`              | VarChar(100) | Default: `"gemini-2.0-flash"` |
| `created_at`              | DateTime     | Default: `now()`         |
| `updated_at`              | DateTime     | Auto-updated             |

**Indexes:** `job_id`  
**OnDelete:** CASCADE from Job  
**Relation:** One-to-one with Job

#### `ProcessingMetric` → table `processing_metrics`

| Column         | Type         | Constraints              |
|----------------|--------------|--------------------------|
| `metric_id`    | VarChar(36)  | PK, CUID                |
| `job_id`       | VarChar(36)  | FK → `jobs.job_id`, nullable |
| `metric_type`  | VarChar(100) |                          |
| `metric_value` | Float        |                          |
| `timestamp`    | DateTime     | Default: `now()`         |
| `metadata`     | Json         | Nullable                 |

**Indexes:** `metric_type`, `timestamp`, `job_id`  
**OnDelete:** SET NULL from Job

#### `Record` → table `records`

| Column        | Type         | Constraints            |
|---------------|--------------|------------------------|
| `record_id`   | VarChar(64)  | PK (app-generated)    |
| `user_id`     | VarChar(36)  | FK → `users.user_id`  |
| `record_type` | VarChar(100) |                        |
| `data`        | Json         | Flexible payload       |
| `created_at`  | DateTime     | Default: `now()`       |
| `updated_at`  | DateTime     | Auto-updated           |

**Indexes:** `user_id`, `record_type`  
**OnDelete:** CASCADE from User

#### `Connection` → table `connections`

| Column          | Type        | Constraints                         |
|-----------------|-------------|-------------------------------------|
| `connection_id` | VarChar(64) | PK (app-generated)                 |
| `follower_id`   | VarChar(36) | FK → `users.user_id`              |
| `following_id`  | VarChar(36) | FK → `users.user_id`              |
| `created_at`    | DateTime    | Default: `now()`                   |

**Unique constraint:** `(follower_id, following_id)`  
**Indexes:** `follower_id`, `following_id`  
**OnDelete:** CASCADE from User (both sides)

---

## 5. API Routes

**Base URL:** `http://<host>:8000`  
**Entry point:** `backend/api/main.py` → `create_app()`  
**Two routers:** `api/routes.py` (core upload/job) and `api/feature_routes.py` (auth, records, connections, insights).

### 5.1 Health & Root

| Method | Path      | Auth | Description                          |
|--------|-----------|------|--------------------------------------|
| GET    | `/`       | No   | Service info (name, version, status) |
| GET    | `/health` | Opt. | DB health check; includes user profile if authenticated |

**`GET /health` response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "environment": "development",
    "api_version": "1.0.0",
    "database": "connected",
    "authenticated": true,
    "role": "USER",
    "user": {
      "user_id": "...",
      "email": "...",
      "role": "USER",
      "health_id": "HW-ABCD1234",
      "full_name": "..."
    }
  }
}
```

### 5.2 Authentication

| Method | Path                 | Auth | Rate Limited | Description          |
|--------|----------------------|------|--------------|----------------------|
| POST   | `/api/auth/login`    | No   | No           | Login with email/password |
| POST   | `/api/auth/register` | No   | No           | Register new user    |

**`POST /api/auth/login` request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "selected_role": "PATIENT"
}
```
`selected_role` accepts `PATIENT` or `DOCTOR`. `PATIENT` maps to backend role `USER`.

**`POST /api/auth/login` response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJ...",
    "token_type": "bearer",
    "expires_in": 86400,
    "user": {
      "user_id": "clu...",
      "email": "user@example.com",
      "role": "USER",
      "full_name": "John Doe",
      "phone_number": "+91...",
      "health_id": "HW-ABCD1234",
      "is_active": true,
      "created_at": "2026-03-20T..."
    }
  }
}
```

**`POST /api/auth/register` request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "selected_role": "PATIENT",
  "full_name": "John Doe",
  "phone_number": "+91XXXXXXXXXX"
}
```

**`POST /api/auth/register` response (201):** Same shape as login response.

### 5.3 File Upload & Processing

| Method | Path                   | Auth   | Rate Limited | Description              |
|--------|------------------------|--------|--------------|--------------------------|
| POST   | `/api/upload`          | JWT    | Yes (IP+User)| Upload PDF for processing|
| GET    | `/api/status/{job_id}` | JWT    | No           | Poll job processing status|
| GET    | `/api/result/{job_id}` | JWT    | No           | Get completed job result |

**`POST /api/upload`**  
Content-Type: `multipart/form-data`  
Field: `file` (PDF, max 50 MB)

Validations:
- PDF magic bytes check
- File size ≤ `max_file_size_mb`
- Filename sanitization
- SHA-256 deduplication (existing file hash → reuses file record)

Response (200):
```json
{
  "file_id": "file_abc123...",
  "job_id": "job_xyz789...",
  "upload_url": "https://storage.googleapis.com/...",
  "expires_in_seconds": 86400,
  "filename": "prescription.pdf"
}
```

**`GET /api/status/{job_id}`**  
Ownership check: job must belong to the requesting user.

Response (200):
```json
{
  "job_id": "job_xyz789...",
  "file_id": "file_abc123...",
  "status": "PROCESSING",
  "created_at": "2026-03-24T10:00:00Z",
  "started_at": "2026-03-24T10:00:05Z",
  "completed_at": null,
  "progress": 50,
  "retry_count": 0,
  "error_message": null
}
```

Progress mapping: `PENDING` → 0, `PROCESSING` → 50, `COMPLETED` → 100, `FAILED` → 100.

**`GET /api/result/{job_id}`**  
Ownership check: job must belong to the requesting user. Returns 202 if still processing.

Response (200 when COMPLETED):
```json
{
  "job_id": "job_xyz789...",
  "file_id": "file_abc123...",
  "status": "COMPLETED",
  "completed_at": "2026-03-24T10:01:00Z",
  "extracted_data": {
    "extraction_id": "extraction_...",
    "data": { "document_type": "prescription", "extracted_text": "...", "tables": [], "metadata": {} },
    "validation_status": "valid",
    "extracted_at": "2026-03-24T10:00:30Z"
  },
  "llm_result": {
    "result_id": "result_...",
    "response": "...",
    "structured_output": { ... },
    "processing_time_seconds": 4.2,
    "model_used": "gemini-2.0-flash",
    "created_at": "2026-03-24T10:00:55Z"
  }
}
```

### 5.4 Records

| Method | Path           | Auth | Role Restriction | Description        |
|--------|----------------|------|------------------|--------------------|
| GET    | `/api/records` | JWT  | USER or DOCTOR   | List user records  |
| POST   | `/api/records` | JWT  | USER or DOCTOR   | Create new record  |

**`GET /api/records`**  
Query param: `user_id` (optional — doctors can view other users' records).

Response (200):
```json
{
  "success": true,
  "data": {
    "owner_user_id": "user_...",
    "records": [
      {
        "record_id": "record_...",
        "user_id": "user_...",
        "record_type": "lab_report",
        "data": { ... },
        "created_at": "...",
        "updated_at": "..."
      }
    ]
  }
}
```

**`POST /api/records`**  
Request:
```json
{
  "record_type": "lab_report",
  "data": { "key": "value" },
  "user_id": "user_..." 
}
```
`user_id` is optional; if omitted, defaults to the authenticated user. Doctors can create records for other users.

### 5.5 Connections (Social Graph)

| Method | Path               | Auth | Role Restriction | Description             |
|--------|--------------------|------|------------------|-------------------------|
| POST   | `/api/follow`      | JWT  | USER only        | Follow user by health_id|
| GET    | `/api/connections`  | JWT  | USER only        | List user's connections |

**`POST /api/follow`**  
Request:
```json
{
  "health_id": "HW-ABCD1234"
}
```
Creates a follower→following edge. Prevents self-follow and duplicate connections.

**`GET /api/connections`**  
Response (200):
```json
{
  "success": true,
  "data": {
    "connections": [
      {
        "connection_id": "connection_...",
        "follower_id": "user_...",
        "following_id": "user_...",
        "created_at": "...",
        "user": {
          "email": "...",
          "role": "DOCTOR",
          "full_name": "...",
          "phone_number": "...",
          "health_id": "HW-..."
        }
      }
    ]
  }
}
```

### 5.6 Insights

| Method | Path             | Auth | Role Restriction | Description       |
|--------|------------------|------|------------------|-------------------|
| GET    | `/api/insights`  | JWT  | USER or DOCTOR   | Get AI insights   |

Response (200):
```json
{
  "success": true,
  "data": {
    "status": "pending",
    "message": "AI-powered health insights coming soon."
  }
}
```

---

## 6. Authentication & Authorization

**File:** `backend/api/auth.py`

### 6.1 JWT Tokens

- Algorithm: HS256
- Expiration: 24 hours (configurable)
- Payload: `{ sub: user_id, role: "USER"|"DOCTOR", exp: timestamp }`
- Header: `Authorization: Bearer <token>`

### 6.2 Password Hashing

- Primary KDF: PBKDF2-SHA256 (600,000 iterations)
- Legacy support: bcrypt (auto-detected on verification)
- Stored format (PBKDF2): `pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>`

### 6.3 Role System

| Backend Role | UI Role   | Capabilities                                              |
|--------------|-----------|-----------------------------------------------------------|
| `USER`       | `PATIENT` | Upload, own records, follow others, view connections      |
| `DOCTOR`     | `DOCTOR`  | Upload, view/create records for any user, view insights   |

### 6.4 Auth Dependencies (FastAPI `Depends`)

| Dependency                 | Returns                          | Used By                    |
|----------------------------|----------------------------------|----------------------------|
| `get_current_user()`       | `{ user_id, email, is_active, role, created_at }` | All protected routes |
| `get_optional_current_user()` | Same or `None`              | `/health`                  |
| `require_user`             | Current user (role = USER or DOCTOR) | Records, Insights     |
| `require_patient`          | Current user (role = USER)       | Follow, Connections        |
| `require_doctor`           | Current user (role = DOCTOR)     | (Available, not yet used)  |

---

## 7. Middleware

**File:** `backend/api/middleware.py`

### RequestContextMiddleware
- Injects `X-Request-ID` (UUID) on every response
- Injects `X-Process-Time` header (milliseconds)
- Logs: `METHOD PATH — STATUS (duration_ms) — CLIENT_IP`

### ErrorHandlingMiddleware
- Catches unhandled exceptions during request processing
- Returns 500 JSON: `{ "error_code": "INTERNAL_ERROR", "message": "An unexpected error occurred." }`
- Logs full traceback with `request_id`

---

## 8. Shared Modules

### 8.1 `shared/database.py` — Database Manager

```python
class DatabaseManager:
    __init__(database_url: str)
    async connect() -> None
    async disconnect() -> None
    async health_check() -> bool
    async init_db() -> None

get_prisma_client(database_url: str) -> Prisma  # singleton
```

### 8.2 `shared/models.py` — Enums

```python
class JobStatus(str, Enum):    PENDING, PROCESSING, COMPLETED, FAILED
class ScanStatus(str, Enum):   pending, in_progress, completed, failed
class ValidationStatus(str, Enum): pending, valid, invalid
```

### 8.3 `shared/schemas.py` — Pydantic Models

**Enums:** `UserRole` (USER, DOCTOR), `UiRoleSelection` (PATIENT, DOCTOR)

**Request Models:**
| Model                | Fields                                                    |
|----------------------|-----------------------------------------------------------|
| `LoginRequest`       | `email`, `password`, `selected_role`                      |
| `RegisterRequest`    | `full_name`, `email`, `phone_number`, `password`, `selected_role` |
| `UploadRequest`      | `filename` (PDF validation)                               |
| `RecordCreateRequest`| `record_type`, `data` (Json), `user_id` (optional)       |
| `FollowRequest`      | `health_id` (regex: `^HW-[A-F0-9]{8}$`)                  |

**Response Models:**
| Model                  | Key Fields                                                           |
|------------------------|----------------------------------------------------------------------|
| `UserResponse`         | `user_id`, `email`, `role`, `created_at`, `is_active`                |
| `UploadResponse`       | `file_id`, `job_id`, `upload_url`, `expires_in_seconds`, `filename`  |
| `StatusResponse`       | `job_id`, `status`, `progress` (0-100), timestamps                   |
| `ResultResponse`       | `job_id`, `status`, `extracted_data`, `llm_result`                   |
| `TokenResponse`        | `access_token`, `token_type`, `expires_in`                           |
| `ErrorResponse`        | `error_code`, `message`, `details`, `timestamp`                      |
| `ExtractedJSONValidator` | `document_type`, `extracted_text`, `tables`, `metadata`            |

**JSON Schema constant:** `EXTRACTED_JSON_SCHEMA` — Draft-07 schema enforcing `document_type`, `extracted_text`, `tables[]`, `metadata{}`.

### 8.4 `shared/security.py` — Security Utilities

```python
# Password
hash_password(password: str) -> str
verify_password(plain_password: str, hashed_password: str) -> bool

# JWT
create_jwt_token(user_id: str, role: str, expires_delta?) -> str
decode_jwt_token(token: str) -> Optional[Dict]

# File validation
calculate_file_hash(file_content: bytes) -> str           # SHA-256
validate_pdf_magic_bytes(file_content: bytes) -> bool
validate_file_size(file_size_bytes: int) -> bool
sanitize_filename(filename: str) -> str
validate_filename(filename: str) -> bool

# ID generators (all return "prefix_" + hex)
generate_job_id()        # "job_..."
generate_file_id()       # "file_..."
generate_user_id()       # "user_..."
generate_extraction_id() # "extraction_..."
generate_result_id()     # "result_..."
generate_metric_id()     # "metric_..."

# JSON security
sanitize_json_for_injection(data: Dict) -> Dict

# Rate limit key builders
RateLimitKey.user_upload_key(user_id)   # "ratelimit:upload:{user_id}"
RateLimitKey.ip_request_key(ip)         # "ratelimit:request:{ip}"
RateLimitKey.user_api_key(user_id)      # "ratelimit:api:{user_id}"
```

### 8.5 `shared/feature_store.py` — Business Logic Layer

```python
# User management
fetch_user_by_email(prisma, email) -> Optional[Dict]
fetch_user_profile(prisma, user_id) -> Optional[Dict]
create_user(prisma, *, email, password_hash, role, full_name, phone_number) -> Dict
ensure_user_health_id(prisma, user_id) -> str                       # auto-generates HW-XXXXXXXX

# Records
list_records(prisma, requester, target_user_id?) -> Dict            # role-based access
create_record(prisma, requester, *, record_type, data, target_user_id?) -> Dict

# Connections
create_connection(prisma, follower_id, health_id) -> Dict           # validates health_id, prevents self-follow
list_connections(prisma, follower_id) -> Dict

# Insights
get_insights_payload() -> Dict                                       # stub — returns "coming soon"

# Schema setup
ensure_supporting_schema(prisma) -> None                             # creates tables & indexes at startup
```

**Custom exceptions:** `FeatureStoreError`, `ConflictError`, `ForbiddenError`, `NotFoundError`, `ValidationError`

### 8.6 `shared/gcs_client.py` — Google Cloud Storage

```python
class GCSClient:
    upload_file(file_content, destination_path, content_type?, metadata?) -> bool
    download_file(source_path) -> Optional[bytes]
    delete_file(path) -> bool
    file_exists(path) -> bool
    generate_signed_url(path, expiration_hours=24, method="GET") -> Optional[str]
    get_file_metadata(path) -> Optional[dict]

get_gcs_client() -> GCSClient  # singleton
```

### 8.7 `shared/gemini_client.py` — Gemini LLM Client

```python
class GeminiClient:
    send_prompt(system_prompt, user_prompt, metadata?) -> Optional[Dict]   # with retry
    validate_api_key() -> bool

get_gemini_client() -> GeminiClient  # singleton
```

Model: `gemini-2.0-flash` (configurable). Timeout: 30s. Retries: 3 with 2s delay.

### 8.8 `shared/job_queue.py` — Redis Job Queue

```python
class JobQueue:
    enqueue_job(job_id, file_id, user_id, gcs_path, metadata?) -> bool
    dequeue_job() -> Optional[Dict]
    push_to_dlq(job_data, error_message) -> bool
    get_queue_size() -> int
    get_dlq_size() -> int
    get_dlq_jobs(limit=100) -> List[Dict]
    retry_dlq_job(job_id) -> bool
    set_job_status(job_id, status, ttl_seconds=3600) -> bool
    get_job_status(job_id) -> Optional[str]
    close()

get_queue() -> JobQueue  # singleton
```

Queue name: `document_processing_jobs`  
Dead-letter queue: `document_processing_dlq`

### 8.9 `shared/json_validator.py` — JSON Validation

```python
class JSONValidator:
    validate_extracted_json(data) -> (is_valid, error_msg, sanitized_data)
    validate_llm_response(response_text) -> (is_valid, error_msg, parsed_json)
    merge_extraction_and_system_prompt(extracted_json, system_prompt) -> str

get_json_validator() -> JSONValidator  # singleton
```

### 8.10 `shared/logger.py` — Structured Logging

```python
setup_logging()                          # call once at startup
get_logger(name: str) -> LoggerAdapter   # per-module logger

class JSONFormatter:       # outputs JSON lines with timestamp, level, module, context
class LoggerAdapter:       # supports .with_context(), .info_with_context(), etc.
```

Context fields: `user_id`, `job_id`, `request_id`, `duration_ms`, `exception`.

---

## 9. Worker Pipeline

**Files:** `backend/worker/worker.py`, `backend/worker/pdf_processor.py`

### 9.1 Processing Steps

```
1. Dequeue job from Redis
2. Mark job → PROCESSING in DB
3. Download PDF from GCS
4. Extract text & metadata (PyPDF2)
5. Validate extracted JSON against schema
6. Store ExtractedJSON record in DB
7. Build merged prompt (extracted text + system prompt)
8. Send to Gemini LLM
9. Validate & parse LLM response
10. Store LLMResult record in DB
11. Mark job → COMPLETED
```

### 9.2 Error Handling & Retries

- On failure: increment `retry_count`, re-enqueue if under `worker_retry_attempts` (default 3)
- After max retries: push to dead-letter queue (DLQ)
- Mark job → FAILED with `error_message`
- Retry delay: `worker_retry_delay_seconds` (default 5s)

### 9.3 PDF Processor

```python
class PDFProcessor:
    process(file_content: bytes) -> Dict    # returns extracted text, metadata, tables
```

Output structure:
```json
{
  "document_type": "prescription",
  "extracted_text": "...",
  "tables": [],
  "metadata": {
    "pages": 3,
    "title": "...",
    "author": "..."
  }
}
```

Document type inference: invoice, receipt, contract, form, report, or "general".

---

## 10. Environment Variables

Minimal `.env` for local development (place in `backend/.env`):

```env
DATABASE_URL=postgresql://postgres:karn@127.0.0.1:5432/famwell
JWT_SECRET_KEY=your-secret-key
GEMINI_API_KEY=your-gemini-key
GCS_PROJECT_ID=your-gcp-project
GCS_BUCKET_NAME=your-bucket
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://10.10.36.120:19006,http://10.187.123.74:19006
```

---

## 11. Error Handling

### Standard Error Response

All errors follow this shape:

```json
{
  "success": false,
  "message": "Human-readable error description."
}
```

### HTTP Status Codes Used

| Code | Meaning                                      |
|------|----------------------------------------------|
| 200  | Success                                      |
| 201  | Created (register, create record, follow)    |
| 202  | Accepted (job still processing)              |
| 400  | Bad request (validation failure)             |
| 401  | Unauthorized (missing/invalid token)         |
| 403  | Forbidden (wrong role, not owner)            |
| 404  | Not found (job, user, record)                |
| 409  | Conflict (duplicate email, duplicate follow) |
| 413  | Payload too large (file size exceeded)       |
| 422  | Unprocessable entity (invalid PDF)           |
| 429  | Rate limit exceeded                          |
| 500  | Internal server error                        |
| 503  | Service unavailable (DB down)                |

### Rate Limiting

- Applied to `POST /api/upload` only
- Redis-backed sliding window
- Default: 100 requests per 3600 seconds
- Tracked per IP and per user independently
- Returns 429 with `Retry-After` header

---

## 12. File & Directory Map

```
backend/
├── __init__.py
├── package.json
├── requirements-api.txt          # API dependencies
├── requirements-worker.txt       # Worker dependencies
├── .env                          # Local env overrides
│
├── api/
│   ├── __init__.py
│   ├── main.py                   # FastAPI app factory, lifespan, health check
│   ├── routes.py                 # /api/upload, /api/status, /api/result
│   ├── feature_routes.py         # /api/auth/*, /api/records, /api/follow, /api/connections, /api/insights
│   ├── auth.py                   # JWT verification, role-based dependencies
│   ├── middleware.py             # RequestContext, ErrorHandling
│   └── rate_limit.py            # Redis rate limiter dependency
│
├── config/
│   ├── __init__.py
│   └── settings.py               # Pydantic Settings (all env vars)
│
├── shared/
│   ├── __init__.py
│   ├── database.py               # Prisma client singleton
│   ├── models.py                 # JobStatus, ScanStatus, ValidationStatus enums
│   ├── schemas.py                # All Pydantic request/response models
│   ├── security.py               # Hashing, JWT, file validation, ID generators
│   ├── feature_store.py          # Business logic (users, records, connections)
│   ├── gcs_client.py             # Google Cloud Storage wrapper
│   ├── gemini_client.py          # Gemini API wrapper
│   ├── job_queue.py              # Redis job queue manager
│   ├── json_validator.py         # Extraction & LLM response validation
│   └── logger.py                 # JSON structured logging
│
├── worker/
│   ├── __init__.py
│   ├── worker.py                 # Main worker loop (dequeue → process → store)
│   └── pdf_processor.py          # PyPDF2 text/metadata extraction
│
├── database/
│   └── migrations/
│       └── init.py               # Legacy migration script
│
├── infra/
│   └── docker/
│       ├── Dockerfile.api        # API container image
│       └── Dockerfile.worker     # Worker container image
│
└── tests/
    ├── conftest.py
    ├── test_api.py
    └── test_security.py

prisma/
└── schema.prisma                 # Database schema (8 models)

docker-compose.yml                # Full stack orchestration
```

---

## 13. What's Built (Complete)

End-to-end flow is fully implemented: PDF upload → validation → GCS storage → job queue → worker processing → LLM analysis → results storage.

| # | Feature | Status | Details |
|---|---------|--------|---------|
| 1 | **User Authentication** | Done | Login & register with JWT (HS256, 24h expiry). PBKDF2-SHA256 password hashing with bcrypt legacy support. |
| 2 | **Role-Based Access Control** | Done | Two roles (`USER`/`DOCTOR`). FastAPI `Depends` guards on every protected route. Doctor can view/create records for other users; patient-only routes for follow/connections. |
| 3 | **PDF Upload Pipeline** | Done | `POST /api/upload` — validates magic bytes, file size, filename. Computes SHA-256 for dedup. Uploads to GCS. Creates `File` + `Job` DB records. Enqueues job to Redis. |
| 4 | **Google Cloud Storage Client** | Done | Full GCS SDK integration — upload, download, delete, signed URLs, metadata, existence check. Singleton with credential fallback. |
| 5 | **Redis Job Queue** | Done | Enqueue/dequeue, DLQ (dead-letter queue), job status caching with TTL, queue/DLQ size monitoring, DLQ retry. |
| 6 | **Worker Service** | Done | Async loop with signal handling. Dequeues → downloads PDF from GCS → extracts text → validates JSON → calls Gemini → validates LLM response → stores results. Automatic retry up to 3 attempts, then DLQ. |
| 7 | **PDF Text Extraction** | Done | PyPDF2-based extraction of full text + metadata (page count, title, author). Document-type inference (invoice, receipt, contract, form, report, general). |
| 8 | **Gemini LLM Integration** | Done | Real `gemini-2.0-flash` API calls via Google GenAI SDK. Retry with exponential backoff (3 attempts, 2s delay). Timeout handling. Token estimation. API key validation. |
| 9 | **JSON Validation** | Done | Draft-07 JSON Schema enforcement on extracted data. LLM response parsing with JSON-from-text extraction. Merged prompt builder for LLM. |
| 10 | **Job Status & Results** | Done | `GET /api/status/{job_id}` — progress mapping (0/50/100). `GET /api/result/{job_id}` — returns extracted data + LLM result. Ownership verification on both. |
| 11 | **Health Records CRUD** | Done | `GET /api/records` (with optional `user_id` for doctor access), `POST /api/records`. Role-aware ownership resolution. |
| 12 | **Social Connections** | Done | `POST /api/follow` (by `health_id`), `GET /api/connections`. Self-follow and duplicate prevention. Auto-generated `HW-XXXXXXXX` health IDs. |
| 13 | **Rate Limiting** | Done | Redis-backed sliding window on `POST /api/upload`. Per-IP + per-user tracking. Default 100 req/hr. |
| 14 | **Middleware** | Done | `RequestContextMiddleware` (X-Request-ID, X-Process-Time, access logging). `ErrorHandlingMiddleware` (unhandled exception catch → 500 JSON). |
| 15 | **Security Utilities** | Done | Filename sanitization (path-traversal prevention), JSON injection prevention, PDF magic-byte validation, file-size validation, SHA-256 hashing, ID generators for all entities. |
| 16 | **Database (Prisma + PostgreSQL)** | Done | 8 models, full relational schema with cascading deletes, indexes, unique constraints. Singleton Prisma client with connection management. |
| 17 | **Structured Logging** | Done | JSON-formatted logs with contextual fields (user_id, job_id, request_id, duration_ms). Per-module logger factory. |
| 18 | **Docker Infrastructure** | Done | `docker-compose.yml` with PostgreSQL 15, Redis 7, API, Worker, optional pgAdmin. Health checks, persistent volumes, shared network. |
| 19 | **Health Check Endpoint** | Done | `GET /health` — DB connectivity test, optional auth with full user profile. Returns environment, version, DB status. |
| 20 | **Security Tests** | Done | 4 tests: JSON injection prevention, filename sanitization, PDF magic-bytes validation, file-hash consistency. |
| 21 | **Pydantic Schemas** | Done | Full request/response models with field validators for all endpoints. `EXTRACTED_JSON_SCHEMA` constant for extraction validation. |

---

## 14. What's Left to Build

| # | Feature | Current State | What's Needed |
|---|---------|---------------|---------------|
| 1 | **AI Insights** | `GET /api/insights` returns hardcoded `{ status: "pending", message: "Insights will be available once the model is ready" }`. | Implement real insight computation — aggregate extracted data, run LLM-powered summaries, trend analysis, or health recommendations. Wire to actual user/record data. |
| 2 | **PDF Table Detection** | Placeholder heuristic (line-splitting, hardcoded confidence `0.85`). Comment: *"This is a placeholder — real implementation would be more sophisticated."* | Integrate a proper table extraction library (e.g. `tabula-py`, `pdfplumber`, or `camelot-py`). Return structured table data instead of raw text. |
| 3 | **Virus Scanning** | `virus_scan_enabled` config exists (default `False`) but **no scanning code** in the upload flow. | Integrate ClamAV or a cloud-based file scanning service. Gate uploads behind scan result before enqueuing the job. |
| 4 | **HTTPS / TLS** | `enable_https` setting exists (default `False`), not wired. | Add TLS termination — either via reverse proxy (nginx/Caddy) or directly in uvicorn with cert paths. |
| 5 | **API Test Coverage** | 2 of 7 test functions in `test_api.py` are `pass` placeholders (*"needs valid auth token"*). | Implement `test_invalid_file_type()` and `test_file_size_validation()` with proper auth fixtures. Add integration tests for upload→status→result flow, records CRUD, and connections. |
| 6 | **Notification System** | Not started. | Push notifications or email alerts for job completion, failed jobs, new connections, or doctor-shared records. |
| 7 | **User Profile Management** | No update/delete endpoints. | Add `PATCH /api/users/me` (update name, phone, etc.), `DELETE /api/users/me`, and avatar/photo support. |
| 8 | **Password Reset** | Not started. | Add forgot-password flow (email OTP or reset link), `POST /api/auth/reset-password`. |
| 9 | **Pagination** | `GET /api/records` and `GET /api/connections` return all rows. | Add `limit`/`offset` or cursor-based pagination to list endpoints. |
| 10 | **File Management** | Users cannot list/delete their uploaded files. | Add `GET /api/files` (list uploads), `DELETE /api/files/{file_id}` (with GCS cleanup). |
| 11 | **Audit Logging** | Request logging exists, but no persistent audit trail. | Store security-relevant events (login, upload, role change) in a dedicated audit table. |
| 12 | **Admin Dashboard / Endpoints** | No admin routes. | Add admin-only routes for user management, DLQ inspection, processing metrics, and system stats. |
| 13 | **OpenAPI in Production** | Docs disabled when `api_env != "development"`. | Decide on production API docs strategy — enable with auth gate, or generate static docs. |
| 14 | **Prescription Summary Endpoint** | Frontend has a `PrescriptionSummaryScreen` but no dedicated backend route for it. | Either expose LLM results directly to that screen (already possible via `/api/result`) or add a purpose-built `GET /api/prescriptions/{job_id}/summary` route with formatted output. |
| 15 | **Consultation Chat** | Frontend has `ConsultationChatScreen` with no backend support. | Build a real-time or request/response chat endpoint — potentially WebSocket or polling-based — backed by Gemini for AI-assisted consultations. |

---

*Generated 2026-03-24. Source of truth: backend source code at `e:\famwell_v0.1\backend\`.*
