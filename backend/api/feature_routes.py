"""Additional application routes for auth, records, connections, chat, and medical records."""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from api.auth import require_patient, require_user
from config.settings import settings
from shared.database import get_prisma_client
from shared.feature_store import (
    ConflictError,
    FeatureStoreError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    action_connection,
    create_connection,
    create_record,
    create_user,
    ensure_user_health_id,
    fetch_user_by_email,
    fetch_user_profile,
    get_insights_payload,
    list_connections,
    list_pending_requests,
    list_records,
)
from shared.schemas import (
    ChatRequest,
    FollowActionRequest,
    FollowRequest,
    LoginRequest,
    RecordCreateRequest,
    RegisterRequest,
    UiRoleSelection,
)
from shared.security import create_jwt_token, hash_password, verify_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["app"])


def _success(data: Any, status_code: int = status.HTTP_200_OK) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": True, "data": jsonable_encoder(data)})


def _error(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": False, "message": message})


def _map_selected_role(selected_role: UiRoleSelection) -> str:
    return "USER" if selected_role == UiRoleSelection.PATIENT else "DOCTOR"


def _serialize_user(user: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not user:
        return None
    return {
        "user_id": user.get("user_id"),
        "email": user.get("email"),
        "role": user.get("role"),
        "full_name": user.get("full_name"),
        "phone_number": user.get("phone_number"),
        "health_id": user.get("health_id"),
        "created_at": user.get("created_at"),
        "is_active": user.get("is_active"),
    }


def _feature_error_response(error: FeatureStoreError) -> JSONResponse:
    if isinstance(error, ForbiddenError):
        return _error(str(error), status.HTTP_403_FORBIDDEN)
    if isinstance(error, ConflictError):
        return _error(str(error), status.HTTP_409_CONFLICT)
    if isinstance(error, NotFoundError):
        return _error(str(error), status.HTTP_404_NOT_FOUND)
    if isinstance(error, ValidationError):
        return _error(str(error), status.HTTP_400_BAD_REQUEST)
    return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/auth/login")
async def login(payload: LoginRequest) -> JSONResponse:
    prisma = get_prisma_client(settings.database_url)

    try:
        user = await fetch_user_by_email(prisma, payload.email)
        if not user or not verify_password(payload.password, user["password"]):
            return _error("Invalid email or password.", status.HTTP_401_UNAUTHORIZED)

        if not user.get("is_active", True):
            return _error("User account is inactive.", status.HTTP_403_FORBIDDEN)

        expected_role = _map_selected_role(payload.selected_role)
        if user.get("role") != expected_role:
            return _error("The selected role does not match this account.", status.HTTP_403_FORBIDDEN)

        user["health_id"] = await ensure_user_health_id(prisma, user["user_id"])
        token = create_jwt_token(user_id=user["user_id"], role=user["role"])

        return _success(
            {
                "access_token": token,
                "token_type": "bearer",
                "expires_in": settings.jwt_expiration_hours * 3600,
                "user": _serialize_user(user),
            }
        )
    except FeatureStoreError as error:
        return _feature_error_response(error)
    except Exception as error:
        logger.error(f"Login failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/auth/register")
async def register(payload: RegisterRequest) -> JSONResponse:
    prisma = get_prisma_client(settings.database_url)

    try:
        existing_user = await fetch_user_by_email(prisma, payload.email)
        if existing_user:
            return _error("An account with this email already exists.", status.HTTP_409_CONFLICT)

        created_user = await create_user(
            prisma,
            email=payload.email,
            password_hash=hash_password(payload.password),
            role=_map_selected_role(payload.selected_role),
            full_name=payload.full_name,
            phone_number=payload.phone_number,
        )
        token = create_jwt_token(user_id=created_user["user_id"], role=created_user["role"])

        return _success(
            {
                "access_token": token,
                "token_type": "bearer",
                "expires_in": settings.jwt_expiration_hours * 3600,
                "user": _serialize_user(created_user),
            },
            status_code=status.HTTP_201_CREATED,
        )
    except FeatureStoreError as error:
        return _feature_error_response(error)
    except Exception as error:
        logger.error(f"Registration failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/records")
async def get_records(
    user_id: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    prisma = get_prisma_client(settings.database_url)

    try:
        records = await list_records(prisma, current_user, user_id)
        return _success(records)
    except FeatureStoreError as error:
        return _feature_error_response(error)
    except Exception as error:
        logger.error(f"Fetching records failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/records")
async def post_record(
    payload: RecordCreateRequest,
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    prisma = get_prisma_client(settings.database_url)

    try:
        record = await create_record(
            prisma,
            current_user,
            record_type=payload.record_type,
            data=payload.data,
            target_user_id=payload.user_id,
        )
        return _success(record, status_code=status.HTTP_201_CREATED)
    except FeatureStoreError as error:
        return _feature_error_response(error)
    except Exception as error:
        logger.error(f"Creating record failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/follow")
async def follow_user(
    payload: FollowRequest,
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    prisma = get_prisma_client(settings.database_url)

    try:
        connection = await create_connection(prisma, current_user["user_id"], payload.health_id)
        return _success(connection, status_code=status.HTTP_201_CREATED)
    except FeatureStoreError as error:
        return _feature_error_response(error)
    except Exception as error:
        logger.error(f"Creating connection failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/follow-action")
async def follow_action(
    payload: FollowActionRequest,
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    prisma = get_prisma_client(settings.database_url)

    try:
        result = await action_connection(prisma, current_user["user_id"], payload.connection_id, payload.action)
        return _success(result)
    except FeatureStoreError as error:
        return _feature_error_response(error)
    except Exception as error:
        logger.error(f"Follow action failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/connections")
async def get_connections(current_user: Dict[str, Any] = Depends(require_user)) -> JSONResponse:
    prisma = get_prisma_client(settings.database_url)

    try:
        connections = await list_connections(prisma, current_user["user_id"])
        return _success(connections)
    except FeatureStoreError as error:
        return _feature_error_response(error)
    except Exception as error:
        logger.error(f"Fetching connections failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/connections/pending")
async def get_pending_requests(current_user: Dict[str, Any] = Depends(require_user)) -> JSONResponse:
    prisma = get_prisma_client(settings.database_url)

    try:
        requests = await list_pending_requests(prisma, current_user["user_id"])
        return _success(requests)
    except FeatureStoreError as error:
        return _feature_error_response(error)
    except Exception as error:
        logger.error(f"Fetching pending requests failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/insights")
async def get_insights(current_user: Dict[str, Any] = Depends(require_user)) -> JSONResponse:
    prisma = get_prisma_client(settings.database_url)

    try:
        user = await fetch_user_profile(prisma, current_user["user_id"])
        if not user:
            return _error("User not found.", status.HTTP_404_NOT_FOUND)

        await ensure_user_health_id(prisma, current_user["user_id"])
        return _success(get_insights_payload())
    except FeatureStoreError as error:
        return _feature_error_response(error)
    except Exception as error:
        logger.error(f"Fetching insights failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Chat Endpoints ──


@router.post("/chat")
async def post_chat(
    payload: ChatRequest,
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    from shared.chat_service import chat

    prisma = get_prisma_client(settings.database_url)

    try:
        result = await chat(prisma, current_user["user_id"], payload.message, payload.conversation_id)
        return _success(result)
    except Exception as error:
        logger.error(f"Chat failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/chat/conversations")
async def get_conversations(current_user: Dict[str, Any] = Depends(require_user)) -> JSONResponse:
    from shared.chat_service import list_conversations

    prisma = get_prisma_client(settings.database_url)

    try:
        conversations = await list_conversations(prisma, current_user["user_id"])
        return _success({"conversations": conversations})
    except Exception as error:
        logger.error(f"Fetching conversations failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/chat/history/{conversation_id}")
async def get_chat_history(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    from shared.chat_service import get_conversation_history, get_or_create_conversation

    prisma = get_prisma_client(settings.database_url)

    try:
        # Verify conversation belongs to user
        conv = await get_or_create_conversation(prisma, current_user["user_id"], conversation_id)
        if conv["user_id"] != current_user["user_id"]:
            return _error("Access denied", status.HTTP_403_FORBIDDEN)

        messages = await get_conversation_history(prisma, conversation_id)
        return _success({"conversation_id": conversation_id, "messages": messages})
    except Exception as error:
        logger.error(f"Fetching chat history failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Medical Record Endpoints ──


@router.post("/medical-records/upload")
async def upload_medical_record_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    record_type: str = Form(default="general"),
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    from shared.medical_service import upload_medical_record, trigger_background_analysis

    prisma = get_prisma_client(settings.database_url)

    try:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            return _error("Only PDF files are accepted.", status.HTTP_400_BAD_REQUEST)

        content = await file.read()
        logger.info("Upload request: user_id=%s, file=%s, size=%d bytes, record_type=%s",
                     current_user["user_id"], file.filename, len(content), record_type)

        if len(content) > settings.max_file_size_bytes:
            return _error(f"File exceeds maximum size of {settings.max_file_size_mb}MB.", status.HTTP_400_BAD_REQUEST)

        if not content[:5].startswith(b"%PDF"):
            return _error("Invalid PDF file.", status.HTTP_400_BAD_REQUEST)

        record = await upload_medical_record(
            prisma,
            user_id=current_user["user_id"],
            file_name=file.filename,
            file_content=content,
            record_type=record_type,
        )

        # Pre-cache the LLM analysis in the background so the insights
        # screen loads instantly when the user navigates there.
        logger.info("Scheduling background analysis: record_id=%s, user_id=%s",
                     record["medical_record_id"], current_user["user_id"])
        background_tasks.add_task(
            trigger_background_analysis,
            settings.database_url,
            record["medical_record_id"],
            current_user["user_id"],
        )

        return _success(record, status_code=status.HTTP_201_CREATED)
    except Exception as error:
        logger.error(f"Medical record upload failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/medical-records")
async def get_medical_records(current_user: Dict[str, Any] = Depends(require_user)) -> JSONResponse:
    from shared.medical_service import list_medical_records

    prisma = get_prisma_client(settings.database_url)

    try:
        records = await list_medical_records(prisma, current_user["user_id"])
        return _success({"records": records})
    except Exception as error:
        logger.error(f"Fetching medical records failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/medical-records/{record_id}/analyze")
async def analyze_medical_record_endpoint(
    record_id: str,
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    from shared.medical_service import analyze_medical_record

    prisma = get_prisma_client(settings.database_url)
    logger.info("POST /medical-records/%s/analyze: user_id=%s", record_id, current_user["user_id"])

    try:
        analysis = await analyze_medical_record(prisma, record_id, current_user["user_id"])
        logger.info("Analysis returned: record_id=%s, health_score=%s", record_id, analysis.get("health_score"))
        return _success(analysis)
    except ValueError as error:
        return _error(str(error), status.HTTP_404_NOT_FOUND)
    except Exception as error:
        logger.error(f"Medical record analysis failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Health Insights Endpoints ──


@router.get("/health-insights/latest")
async def get_latest_health_insights(
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    """Get health insights from the user's most recent medical record."""
    from shared.medical_service import get_health_insights_for_user

    prisma = get_prisma_client(settings.database_url)
    logger.info("GET /health-insights/latest: user_id=%s", current_user["user_id"])

    try:
        insights = await get_health_insights_for_user(prisma, current_user["user_id"])
        logger.info("Health insights returned: user_id=%s, health_score=%s, stress_score=%s",
                     current_user["user_id"], insights.get("health_score"), insights.get("stress_score"))
        return _success(insights)
    except Exception as error:
        logger.error(f"Fetching latest health insights failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/health-insights/history")
async def get_health_insights_history_endpoint(
    limit: int = Query(default=10, ge=1, le=50),
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    """Get historical health analyses for the current user."""
    from shared.medical_service import get_health_insights_history

    prisma = get_prisma_client(settings.database_url)
    logger.info("GET /health-insights/history: user_id=%s, limit=%d", current_user["user_id"], limit)

    try:
        history = await get_health_insights_history(prisma, current_user["user_id"], limit)
        return _success({"history": history, "count": len(history)})
    except Exception as error:
        logger.error(f"Fetching health insights history failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/health-insights/ask-ai")
async def ask_ai_insight_endpoint(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    """Ask AI for a contextual insight on a specific health parameter."""
    from shared.medical_service import ask_ai_contextual_insight

    prisma = get_prisma_client(settings.database_url)
    parameter = payload.get("parameter", "stress_score")
    conversation_id = payload.get("conversation_id")
    logger.info("POST /health-insights/ask-ai: user_id=%s, parameter=%s", current_user["user_id"], parameter)

    try:
        result = await ask_ai_contextual_insight(
            prisma,
            current_user["user_id"],
            parameter,
            conversation_id,
        )
        return _success(result)
    except Exception as error:
        logger.error(f"Ask AI insight failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/health-insights/{record_id}")
async def get_health_insights(
    record_id: str,
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    """Get health insights for a specific medical record."""
    from shared.medical_service import get_health_insights_for_user

    prisma = get_prisma_client(settings.database_url)
    logger.info("GET /health-insights/%s: user_id=%s", record_id, current_user["user_id"])

    try:
        insights = await get_health_insights_for_user(prisma, current_user["user_id"], record_id)
        logger.info("Health insights returned: record_id=%s, health_score=%s, stress_score=%s",
                     record_id, insights.get("health_score"), insights.get("stress_score"))
        return _success(insights)
    except ValueError as error:
        return _error(str(error), status.HTTP_404_NOT_FOUND)
    except Exception as error:
        logger.error(f"Fetching health insights failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Doctor Endpoints ──


@router.get("/doctors/recommended")
async def get_recommended_doctors_endpoint(
    record_id: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    """Get doctors recommended based on the user's health analysis."""
    from shared.doctor_service import get_recommended_doctors

    prisma = get_prisma_client(settings.database_url)
    logger.info("GET /doctors/recommended: user_id=%s, record_id=%s", current_user["user_id"], record_id)

    try:
        result = await get_recommended_doctors(prisma, current_user["user_id"], record_id)
        return _success(result)
    except Exception as error:
        logger.error(f"Fetching recommended doctors failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/doctors/search")
async def search_doctors_endpoint(
    q: str = Query(default=""),
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    """Search doctors by name, specialization, or health ID."""
    from shared.doctor_service import search_doctors

    prisma = get_prisma_client(settings.database_url)
    logger.info("GET /doctors/search: q=%s", q)

    try:
        doctors = await search_doctors(prisma, q)
        return _success({"doctors": doctors})
    except Exception as error:
        logger.error(f"Doctor search failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/doctors/seed")
async def seed_doctors_endpoint(
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    """Seed the doctors table with mock data."""
    from shared.doctor_service import seed_doctors

    prisma = get_prisma_client(settings.database_url)
    logger.info("POST /doctors/seed: triggered by user_id=%s", current_user["user_id"])

    try:
        count = await seed_doctors(prisma)
        return _success({"seeded": count, "message": f"Inserted {count} doctors"})
    except Exception as error:
        logger.error(f"Doctor seeding failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── User Search Endpoints ──


@router.get("/users/search")
async def search_users_endpoint(
    health_id: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    """Search users by health_id (exact/partial) or name."""
    prisma = get_prisma_client(settings.database_url)
    my_id = current_user["user_id"]

    try:
        # Exact health_id match first
        if health_id:
            hid = health_id.strip().upper()
            rows = await prisma.query_raw(
                "SELECT user_id, email, role, full_name, phone_number, health_id "
                "FROM users WHERE UPPER(health_id) = $1 AND user_id != $2 LIMIT 10",
                hid, my_id,
            )
            # If no exact match, try partial
            if not rows:
                rows = await prisma.query_raw(
                    "SELECT user_id, email, role, full_name, phone_number, health_id "
                    "FROM users WHERE UPPER(health_id) LIKE $1 AND user_id != $2 ORDER BY full_name LIMIT 10",
                    f"%{hid}%", my_id,
                )
        elif q:
            term = q.strip()
            rows = await prisma.query_raw(
                "SELECT user_id, email, role, full_name, phone_number, health_id "
                "FROM users WHERE (LOWER(full_name) LIKE $1 OR LOWER(email) LIKE $1) AND user_id != $2 "
                "ORDER BY full_name LIMIT 10",
                f"%{term.lower()}%", my_id,
            )
        else:
            rows = []

        # Attach connection status for each result
        results = []
        for row in rows:
            # Check outgoing connection
            conn_rows = await prisma.query_raw(
                "SELECT connection_id, status FROM connections "
                "WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1) LIMIT 1",
                my_id, row["user_id"],
            )
            conn_status = "none"
            conn_id = None
            if conn_rows:
                conn_status = conn_rows[0].get("status", "none")
                conn_id = conn_rows[0].get("connection_id")

            results.append({
                "user_id": row["user_id"],
                "role": row["role"],
                "full_name": row.get("full_name"),
                "health_id": row.get("health_id"),
                "connection_status": conn_status,
                "connection_id": conn_id,
            })

        return _success({"users": results})
    except Exception as error:
        logger.error(f"User search failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/users/seed")
async def seed_users_endpoint(
    current_user: Dict[str, Any] = Depends(require_user),
) -> JSONResponse:
    """Seed mock users for testing."""
    prisma = get_prisma_client(settings.database_url)
    logger.info("POST /users/seed: triggered by user_id=%s", current_user["user_id"])

    from shared.security import hash_password

    MOCK_USERS = [
        {"email": "rahul.sharma@test.com", "full_name": "Rahul Sharma", "role": "USER", "phone": "9876543210"},
        {"email": "priya.patel@test.com", "full_name": "Priya Patel", "role": "USER", "phone": "9876543211"},
        {"email": "amit.singh@test.com", "full_name": "Amit Singh", "role": "USER", "phone": "9876543212"},
        {"email": "neha.gupta@test.com", "full_name": "Neha Gupta", "role": "USER", "phone": "9876543213"},
        {"email": "vikram.roy@test.com", "full_name": "Vikram Roy", "role": "USER", "phone": "9876543214"},
        {"email": "simran.kaur@test.com", "full_name": "Simran Kaur", "role": "USER", "phone": "9876543215"},
        {"email": "arjun.nair@test.com", "full_name": "Arjun Nair", "role": "USER", "phone": "9876543216"},
        {"email": "meera.reddy@test.com", "full_name": "Meera Reddy", "role": "USER", "phone": "9876543217"},
        {"email": "kabir.khan@test.com", "full_name": "Kabir Khan", "role": "USER", "phone": "9876543218"},
        {"email": "ananya.joshi@test.com", "full_name": "Ananya Joshi", "role": "USER", "phone": "9876543219"},
        {"email": "doc.julian@test.com", "full_name": "Dr. Julian Thorne", "role": "DOCTOR", "phone": "9876543300"},
        {"email": "doc.sarah@test.com", "full_name": "Dr. Sarah Jenkins", "role": "DOCTOR", "phone": "9876543301"},
    ]

    pwd_hash = hash_password("Test123!")
    count = 0
    try:
        for u in MOCK_USERS:
            existing = await prisma.query_raw(
                "SELECT user_id FROM users WHERE email = $1 LIMIT 1", u["email"],
            )
            if existing:
                continue
            user_row = await create_user(
                prisma, email=u["email"], password_hash=pwd_hash,
                role=u["role"], full_name=u["full_name"], phone_number=u["phone"],
            )
            count += 1

        return _success({"seeded": count, "message": f"Inserted {count} users"})
    except Exception as error:
        logger.error(f"User seeding failed: {error}", exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)
