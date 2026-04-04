# FamWell — Project Context

## Overview

FamWell is a healthcare platform that lets patients upload medical documents (prescriptions, lab reports), extract structured data using AI, track health metrics over time, and connect with doctors. A family-member sharing model allows patients to grant doctors read access to their records.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo SDK 54, TypeScript) |
| Navigation | React Navigation 7 (native stack) |
| State | React Context + `@tanstack/react-query` |
| Backend | FastAPI (Python 3.12) |
| ORM | Prisma Client Python v0.15 |
| Database | PostgreSQL on **Neon** serverless |
| Cache / Queue | **Upstash Redis** (TLS `rediss://`) |
| File Storage | Google Cloud Storage |
| AI | Azure OpenAI (GPT-4) |
| Auth | JWT HS256 + Google OAuth 2.0 |
| Deployment | Render (backend), Expo Go / EAS (mobile) |

---

## Repository Structure

```
famwell_v0.1/
├── .env                        # Single root env file (all secrets)
├── .python-version             # 3.12.3 — required for Prisma compat
├── build.sh                    # Render build: pip install + prisma generate
├── render.yaml                 # Render service config
├── docker-compose.yml          # Local dev compose
│
├── backend/                    # FastAPI application
│   ├── api/
│   │   ├── main.py             # App factory create_app(), lifespan, health
│   │   ├── feature_routes.py   # All business routes (/api/auth/*, /api/records, etc.)
│   │   ├── routes.py           # Upload, job status/result routes
│   │   ├── auth.py             # JWT decode, get_current_user, role guards
│   │   ├── middleware.py       # Request context, error handling middleware
│   │   └── rate_limit.py       # Redis sliding-window rate limiter
│   ├── config/
│   │   └── settings.py         # Pydantic BaseSettings (reads .env / ../env)
│   ├── shared/
│   │   ├── database.py         # Prisma singleton (get_prisma_client)
│   │   ├── feature_store.py    # All DB query helpers (CRUD for users, records, connections)
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── models.py           # Enum/dataclass models
│   │   ├── security.py         # JWT create/decode, password hash, file validation
│   │   ├── job_queue.py        # Redis job queue + DLQ (RPUSH/LPOP)
│   │   ├── gcs_client.py       # Google Cloud Storage upload/download
│   │   ├── gemini_client.py    # (legacy) Gemini client
│   │   ├── llm_client.py       # Azure OpenAI client
│   │   ├── medical_service.py  # Medical record upload business logic
│   │   ├── doctor_service.py   # Doctor search & recommendations
│   │   ├── chat_service.py     # Chat conversation persistence
│   │   ├── json_validator.py   # Extracted JSON schema validation
│   │   └── logger.py           # Structured logging setup
│   ├── worker/
│   │   ├── worker.py           # Background PDF processing worker
│   │   └── pdf_processor.py    # PDF text extraction (pdfplumber)
│   ├── requirements-api.txt
│   └── requirements-worker.txt
│
├── prisma/
│   ├── schema.prisma           # 13 models (see Database Models below)
│   └── .env                    # DATABASE_URL only (Prisma CLI)
│
└── frontend/                   # Expo React Native app
    ├── app.json                # EAS project: 9414b103-e658..., scheme: famwell-mobile
    ├── src/app/
    │   ├── RootNavigator.tsx   # Flow: Splash → Onboarding → Auth → Main
    │   ├── navigation.ts       # Screen param type definitions
    │   ├── lib/
    │   │   ├── api.ts          # All axios API calls + token storage
    │   │   ├── theme.ts        # Design tokens (colors, spacing, typography)
    │   │   └── format.ts       # Date/number formatting helpers
    │   ├── state/
    │   │   └── AppContext.tsx  # Global auth state, signIn/signUp/signInWithGoogle
    │   ├── screens/            # See Screen Inventory below
    │   ├── components/         # Shared UI primitives (Button, Card, Field, etc.)
    │   └── hooks/              # useJobStatus, useJobResult, useRecords, etc.
    └── src/
        ├── components/         # Legacy top-level components
        └── screens/            # Legacy screens (HomeDashboard, Login, etc.)
```

---

## Database Models (Prisma)

| Model | Table | Key Fields |
|---|---|---|
| `User` | `users` | `user_id`, `email`, `role` (USER/DOCTOR), `health_id` (unique) |
| `File` | `files` | `file_id`, `user_id`, `gcs_path`, `file_hash` |
| `Job` | `jobs` | `job_id`, `file_id`, `status` (PENDING/PROCESSING/COMPLETED/FAILED) |
| `ExtractedJSON` | `extracted_json` | `job_id`, `extracted_data` (JSON), `validation_status` |
| `LLMResult` | `llm_results` | `job_id`, `llm_response`, `structured_output` (JSON) |
| `ProcessingMetric` | `processing_metrics` | `metric_type`, `metric_value` |
| `Record` | `records` | `record_id`, `user_id`, `record_type`, `data` (JSON) |
| `MedicalRecord` | `medical_records` | `medical_record_id`, `user_id`, `file_url`, `analysis_json` |
| `Connection` | `connections` | `follower_id`, `following_id`, `status` (pending/accepted/rejected) |
| `ChatConversation` | `chat_conversations` | `conversation_id`, `user_id`, `title` |
| `ChatMessage` | `chat_messages` | `message_id`, `conversation_id`, `role`, `content` |
| `Doctor` | `doctors` | `doctor_id`, `health_id`, `specialization`, `rating` |

---

## API Endpoints

### Auth (`/api`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Email/password login → JWT |
| `POST` | `/api/auth/register` | Register new user → JWT |
| `POST` | `/api/auth/google` | Google ID token → JWT (create or link account) |

### Records & Connections
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/records` | Any | List health records |
| `POST` | `/api/records` | Any | Create health record |
| `POST` | `/api/follow` | PATIENT | Follow doctor by health_id |
| `POST` | `/api/follow-action` | PATIENT | Accept/reject connection |
| `GET` | `/api/connections` | PATIENT | List accepted connections |
| `GET` | `/api/connections/pending` | PATIENT | List pending requests |
| `GET` | `/api/insights` | Any | Health insights summary |

### Medical Records & AI
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/medical-records/upload` | Multipart PDF upload → GCS + DB record |
| `GET` | `/api/medical-records` | List user's medical records |
| `POST` | `/api/medical-records/{record_id}/analyze` | Trigger AI analysis job |
| `GET` | `/api/health-insights/latest` | Latest AI analysis result |
| `GET` | `/api/health-insights/history` | Analysis history (paginated) |
| `POST` | `/api/health-insights/ask-ai` | Conversational AI query on health data |
| `GET` | `/api/health-insights/{record_id}` | Analysis for specific record |

### Jobs (routes.py)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/upload` | Direct file upload (legacy) |
| `GET` | `/api/status/{job_id}` | Poll job status |
| `GET` | `/api/result/{job_id}` | Get completed job result |

### Doctors & Users
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/doctors/recommended` | AI-recommended doctors based on health data |
| `GET` | `/api/doctors/search` | Search doctors by name/specialization |
| `POST` | `/api/doctors/seed` | Seed doctor data (dev only) |
| `GET` | `/api/users/search` | Search users by health_id or name |
| `POST` | `/api/users/seed` | Seed test users |

### System
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | DB connectivity + auth status check |
| `POST` | `/api/chat` | Send chat message, get AI response |
| `GET` | `/api/chat/conversations` | List chat conversations |
| `GET` | `/api/chat/history/{conversation_id}` | Full message history |

---

## Authentication

- **JWT HS256** — issued on login/register/google-auth, 24h expiry
- **Roles**: `USER` (patient) / `DOCTOR` — stored on token and DB
- **Frontend UI roles**: `PATIENT` / `DOCTOR` — mapped to backend roles on login
- **Google OAuth**: `expo-auth-session` browser flow → `id_token` → `POST /api/auth/google`
- **Token storage**: `AsyncStorage`-backed via `memoryStorage` fallback in `api.ts`
- **Unauthorized handler**: auto-clears token + triggers re-auth flow

---

## Frontend Screens

| Screen | Route Name | Description |
|---|---|---|
| `SplashScreen` | `Splash` | App loading, checks persisted auth |
| `OnboardingScreen` | `Onboarding` | First-launch onboarding |
| `AuthScreen` | `Auth` | Sign in / sign up / Google Sign-In |
| `HomeDashboardScreen` | `HomeDashboard` | Main dashboard with health score |
| `UploadDocumentsScreen` | `UploadDocuments` | PDF picker + upload trigger |
| `StatusScreen` | `StatusScreen` | Job polling (PENDING → COMPLETED) |
| `PrescriptionSummaryScreen` | `ResultScreen` | View extracted + LLM result |
| `PatientRecordsScreen` | `PatientRecords` | All uploaded records list |
| `AIInsightsScreen` | `AIInsights` | Health metrics from latest analysis |
| `StressAnalysisScreen` | `StressAnalysis` | Ask-AI parameter deep-dive |
| `ConsultationChatScreen` | `ConsultationChat` | AI chat assistant |
| `FindDoctorScreen` | `FindDoctor` | Search + recommended doctors |
| `FamilyProfilesScreen` | `FamilyProfiles` | Family member management |
| `FriendsAndFamilyScreen` | `FriendsAndFamily` | Connections/followers |

---

## Redis (Upstash) Usage

| Key Pattern | Type | TTL | Usage |
|---|---|---|---|
| `document_processing_jobs` | LIST | 24h | Job queue (RPUSH enqueue, LPOP dequeue) |
| `document_processing_dlq` | LIST | — | Dead letter queue for failed jobs |
| `job_status:{job_id}` | STRING | 1h | Cached job status string |
| `rate:user_upload:{user_id}` | STRING | window | Upload rate limit counter |
| `rate:ip_request:{ip}` | STRING | window | IP request rate limit counter |

**Connection**: `rediss://default:<token>@noble-hermit-67065.upstash.io:6379` (TLS)

---

## Environment Variables

All in root `.env` (read by backend settings, `prisma/.env` has `DATABASE_URL` only):

```
DATABASE_URL          Neon PostgreSQL connection string
REDIS_URL             Upstash Redis rediss:// URL
UPSTASH_REDIS_REST_URL  https://noble-hermit-67065.upstash.io
UPSTASH_REDIS_REST_TOKEN  <token>
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT   soundverse-saar-gpt-4.1
AZURE_OPENAI_API_VERSION  2025-01-01-preview
GOOGLE_CLIENT_ID      412498275721-iiihb961adjl9h0vvaif3fngbenh6ua8.apps.googleusercontent.com
JWT_SECRET_KEY
```

---

## Deployment (Render)

- **Build command**: `chmod +x build.sh && ./build.sh`
  - Installs `requirements-api.txt`
  - Copies `prisma/schema.prisma` → `backend/schema.prisma`
  - Runs `python -m prisma generate`
- **Start command**: `cd backend && uvicorn api.main:create_app --host 0.0.0.0 --port $PORT`
- **Python version**: `3.12.3` (pinned via `.python-version` — Prisma requires <3.14)
- **DB startup**: graceful retry (3 attempts, 2s/4s backoff) — server starts even if DB is unavailable

---

## Local Development

```bash
# Backend
cd backend
python -m prisma generate --schema=../prisma/schema.prisma
python -m uvicorn api.main:create_app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npx expo start --clear
```

**Test credentials**:
- `patient@test.com` / `Test123!` / PATIENT
- `testing1@gmail.com` / `12345678` / PATIENT

**API base URL** (physical device): `http://10.15.54.74:8000`

---

## Known Constraints

- Google Sign-In uses `expo-auth-session` browser flow (not native SDK) — works in Expo Go, requires `https://auth.expo.io/@ayush_karn.01/famwell-mobile` as authorized redirect URI in Google Cloud Console
- Prisma Client Python incompatible with Python ≥ 3.14 (Pydantic v1 compat issue)
- `frontend/src/app/lib/` is in `.gitignore` — `theme.ts` must be excluded from the ignore pattern for EAS builds
- Worker (`worker/worker.py`) runs as a separate process — not deployed on Render yet
