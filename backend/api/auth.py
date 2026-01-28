"""Authentication and authorization utilities for FastAPI using Prisma."""

import logging
from typing import Optional, Dict, Any
from datetime import datetime
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials

from shared.security import decode_jwt_token
from shared.database import get_prisma_client
from config.settings import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()


async def verify_jwt_token(credentials: HTTPAuthCredentials = Depends(security)) -> str:
    """Verify JWT token and return user ID.

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        User ID from token

    Raises:
        HTTPException: If token is invalid
    """
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


async def get_current_user(user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
    """Get current authenticated user.

    Args:
        user_id: User ID from token

    Returns:
        User dictionary object

    Raises:
        HTTPException: If user not found
    """
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

        # Return user as dictionary
        return {
            "user_id": user.user_id,
            "email": user.email,
            "is_active": user.is_active,
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
