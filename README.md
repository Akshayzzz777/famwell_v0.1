# FamWell Document Processing Platform

**A production-ready AI document processing backend designed for mobile-first applications.**

## 🚀 For Frontend Developers (React Expo)

This project provides a **complete REST API** for intelligent document processing. Your React Expo app can upload PDFs and get AI-powered results.

### Quick Start for Expo Apps

**1. Get the API connection details:**
- Backend Base URL: `http://your-backend-url:8000`
- Documentation: See [frontend/REACT_EXPO_QUICK_REFERENCE.md](frontend/REACT_EXPO_QUICK_REFERENCE.md)

**2. Copy the Expo integration code:**
- Ready-to-use TypeScript template: [frontend/REACT_EXPO_TEMPLATE.ts](frontend/REACT_EXPO_TEMPLATE.ts)
- Full integration guide: [frontend/REACT_EXPO_INTEGRATION.md](frontend/REACT_EXPO_INTEGRATION.md)

**3. Key API Endpoints:**
```
POST   /api/upload              Upload a PDF document
GET    /api/status/{job_id}     Check processing status
GET    /api/result/{job_id}     Retrieve results
POST   /api/auth/login          Get authentication token
```

**4. Authentication:**
- Use JWT tokens (provided via `/api/auth/login`)
- Include in headers: `Authorization: Bearer <token>`
- Use `SecureStore` in Expo to save tokens securely

### 📱 Compatibility

✅ Full React Expo compatibility  
✅ REST API (no native modules required)  
✅ JWT authentication  
✅ Multipart file uploads  
✅ CORS pre-configured for mobile  

---

## 📦 Backend Setup (For DevOps/Backend Team)

### For Backend Developers

**Project Structure:**
```
backend/
├── api/              REST API endpoints
├── worker/           Background job processor
├── database/         Prisma ORM & migrations
├── config/           Configuration & settings
├── shared/           Shared utilities & clients
├── infra/            Docker & infrastructure
├── tests/            Test suite
├── requirements-*.txt  Python dependencies
└── docs/             Backend documentation
```

**Development Setup:**

```bash
cd backend

# Install dependencies
pip install -r requirements-api.txt
pip install -r requirements-worker.txt

# Setup environment
cp .env.example .env
# Edit .env with your PostgreSQL, Redis, GCS, and Gemini credentials

# Initialize database
prisma db push

# Run API server
uvicorn api.main:app --reload --port 8000

# In another terminal, run worker
python -m worker.worker
```

**Detailed Backend Docs:**
- [Backend Architecture](backend/docs/ARCHITECTURE.md)
- [Deployment Guide](backend/docs/DEPLOYMENT.md)
- [Quick Start](backend/docs/QUICKSTART.md)
- [Database Setup](backend/database/docs/PRISMA_SETUP.md)
- [Project Summary](backend/docs/PROJECT_SUMMARY.md)

### Docker Deployment

```bash
cd backend
docker-compose up -d
```

---

## 🛠️ Technology Stack

**Backend:**
- **FastAPI** v0.104.1 - REST API framework
- **Prisma ORM** v0.13.1 - Database ORM with async Python client
- **PostgreSQL** 15+ - Primary database
- **Redis** 7+ - Job queue and caching

**AI/ML:**
- **Google Gemini** - LLM for document analysis
- **PyPDF2** - PDF text extraction

**Infrastructure:**
- **Google Cloud Storage** - Secure file storage
- **Docker** - Containerization
- **Uvicorn** - ASGI server

**Frontend (Expo):**
- **React Expo** - Mobile framework
- **Axios/Fetch** - HTTP client (compatible)
- **SecureStore** - Secure token storage

---

## 📊 System Architecture

```
┌─────────────────────┐
│  Expo Mobile App    │  JWT Auth + File Upload
│  (Frontend)         │
└────────┬────────────┘
         │ REST API
         │
┌────────▼────────────────┐
│   FastAPI REST API      │   /api/upload
│   - Authentication      │   /api/status/{id}
│   - File Validation     │   /api/result/{id}
│   - Rate Limiting       │
└────────┬────────────────┘
         │
    ┌────┴─────────────────────┐
    │                          │
┌───▼────────┐          ┌─────▼────┐
│Google Cloud│          │ PostgreSQL│
│  Storage   │          │ Database  │
│ (GCS)      │          │           │
└────────────┘          └─────┬─────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
            ┌───────▼───┐  ┌───▼─────┐  │
            │   Redis   │  │ Workers │  │
            │Queue/Cache│  │(process)│  │
            └───────────┘  └───┬─────┘  │
                                │        │
                           ┌────▼────────▼───┐
                           │ Gemini LLM API  │
                           │ (AI Analysis)   │
                           └─────────────────┘
```

**Data Flow:**
1. User uploads PDF via Expo app
2. API validates and stores in GCS
3. Job created in PostgreSQL
4. Message pushed to Redis queue
5. Workers process PDF → extract text → call Gemini
6. Results stored in PostgreSQL
7. Frontend polls `/api/status` → `/api/result` for completion

---

## 🔒 Security Features

- JWT token-based authentication
- Rate limiting per user/IP
- Input validation & sanitization
- Secure file storage with signed URLs
- Error message sanitization
- CORS properly configured
- Database connection pooling

---

## 📋 Key Features

- ✅ Async/await for high performance
- ✅ Automatic retry logic for failures
- ✅ Dead letter queue for error tracking
- ✅ Job status tracking
- ✅ Structured JSON logging
- ✅ OpenAPI/Swagger documentation
- ✅ Comprehensive test coverage
- ✅ Docker/Docker Compose support

---

## 🔧 Environment Configuration

Required environment variables in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/famwell

# Redis
REDIS_URL=redis://localhost:6379

# Google Cloud
GCS_BUCKET_NAME=your-bucket
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# Gemini LLM
GEMINI_API_KEY=your-gemini-key

# API
JWT_SECRET_KEY=your-secret-key
ALGORITHM=HS256

# CORS (for Expo)
ALLOWED_ORIGINS=http://localhost:8081,exp://yourmobilapp.local
```

---

## 📚 Documentation Map

### For Expo/Frontend Developers:
- [Expo Quick Reference](frontend/REACT_EXPO_QUICK_REFERENCE.md) ⭐ **START HERE**
- [Expo Code Template](frontend/REACT_EXPO_TEMPLATE.ts) - Ready to copy/paste
- [Expo Full Integration Guide](frontend/REACT_EXPO_INTEGRATION.md)
- [API Compatibility Details](frontend/REACT_EXPO_COMPATIBILITY.md)

### For Backend Developers:
- [Architecture Overview](backend/docs/ARCHITECTURE.md)
- [Backend Quick Start](backend/docs/QUICKSTART.md)
- [Deployment Guide](backend/docs/DEPLOYMENT.md)
- [Database Schema (Prisma)](backend/database/docs/PRISMA_SETUP.md)
- [Project Summary](backend/docs/PROJECT_SUMMARY.md)

---

## 🚀 Deployment Options

- **Local**: Docker Compose (included)
- **Cloud**: Google Cloud Run, AWS ECS, DigitalOcean App Platform
- **Kubernetes**: Helm charts available in `backend/infra/`

See [Deployment Guide](backend/docs/DEPLOYMENT.md) for detailed instructions.

---

## 📞 Support

- **Backend Issues**: See `backend/docs/`
- **Frontend/Expo Integration**: See `frontend/REACT_EXPO_*.md`
- **Database Questions**: See `backend/database/docs/`
- **General Architecture**: See `backend/docs/ARCHITECTURE.md`

---

## ✨ Project Status

**Completed Features:**
- ✅ FastAPI REST API with 3 endpoints
- ✅ JWT authentication & authorization
- ✅ PDF upload with validation
- ✅ Background job processing (Redis queue)
- ✅ AI analysis (Gemini LLM integration)
- ✅ Database (Prisma ORM with PostgreSQL)
- ✅ Google Cloud Storage integration
- ✅ CORS configured for mobile apps
- ✅ Rate limiting & security
- ✅ Comprehensive test suite
- ✅ Docker containerization
- ✅ React Expo integration guides

**Ready for Production:** ✅ Yes - All core features implemented and tested

---

## 📄 License

This project is provided as-is for use in your application.
