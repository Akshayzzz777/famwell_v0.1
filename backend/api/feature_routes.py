"""Additional application routes for auth, records, connections, and insights."""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, status
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
    create_connection,
    create_record,
    create_user,
    ensure_user_health_id,
    fetch_user_by_email,
    fetch_user_profile,
    get_insights_payload,
    list_connections,
    list_records,
)
from shared.schemas import FollowRequest, LoginRequest, RecordCreateRequest, RegisterRequest, UiRoleSelection
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
    current_user: Dict[str, Any] = Depends(require_patient),
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


@router.get("/connections")
async def get_connections(current_user: Dict[str, Any] = Depends(require_patient)) -> JSONResponse:
    prisma = get_prisma_client(settings.database_url)

    try:
        connections = await list_connections(prisma, current_user["user_id"])
        return _success(connections)
    except FeatureStoreError as error:
        return _feature_error_response(error)
    except Exception as error:
        logger.error(f"Fetching connections failed: {error}", exc_info=True)
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
