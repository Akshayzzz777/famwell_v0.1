"""Authentication and authorization utilities for FastAPI using Prisma."""

import logging
from typing import Optional, Dict, Any
from enum import Enum
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from shared.security import decode_jwt_token
from shared.database import get_prisma_client
from config.settings import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


class UserRole(str, Enum):
    """User role enumeration for RBAC."""
    USER = "USER"
    DOCTOR = "DOCTOR"


def _decode_user_id_from_credentials(credentials: HTTPAuthorizationCredentials) -> str:
    token = credentials.credentials
    payload = decode_jwt_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id


async def verify_jwt_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token and return user ID."""
    return _decode_user_id_from_credentials(credentials)


async def get_current_user(user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
    """Get current authenticated user."""
    prisma = get_prisma_client(settings.database_url)

    try:
        user = await prisma.user.find_unique(where={"user_id": user_id})

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive",
            )

        return {
            "user_id": user.user_id,
            "email": user.email,
            "is_active": user.is_active,
            "role": user.role,
            "created_at": user.created_at,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching user information",
        )


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
) -> Optional[Dict[str, Any]]:
    """Return the current user when a bearer token is present."""
    if credentials is None:
        return None

    user_id = _decode_user_id_from_credentials(credentials)
    return await get_current_user(user_id)


def require_role(*allowed_roles: UserRole):
    """Create a dependency that requires specific user roles."""

    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user.get("role", "USER")
        allowed_values = [role.value for role in allowed_roles]

        if user_role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed_values)}",
            )

        return current_user

    return role_checker


require_user = require_role(UserRole.USER, UserRole.DOCTOR)
require_doctor = require_role(UserRole.DOCTOR)
require_patient = require_role(UserRole.USER)
