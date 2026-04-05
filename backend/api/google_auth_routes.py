"""Google OAuth redirect flow and Google Drive connection routes."""

import logging
from typing import Any, Dict
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, RedirectResponse

from api.auth import require_user
from config.settings import settings
from shared.database import get_prisma_client
from shared.feature_store import create_user, ensure_user_health_id, fetch_user_by_email
from shared.google_drive import ensure_drive_folder
from shared.security import create_jwt_token, hash_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/google", tags=["google-auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# Scopes
LOGIN_SCOPES = "openid email profile"
DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file"


def _success(data: Any, status_code: int = status.HTTP_200_OK) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": True, "data": data})


def _error(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": False, "message": message})


# ── TASK 1: Google Auth (redirect-based login) ────────────────────────────────


@router.get("/login")
async def google_login_redirect():
    """Redirect the user to Google's OAuth consent screen for login."""
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google client ID not configured")

    params = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": LOGIN_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": "login",
    })
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{params}")


@router.get("/callback")
async def google_callback(code: str = Query(...), state: str = Query(default="login")):
    """Handle the OAuth callback from Google.

    Exchanges the authorization code for tokens, retrieves the user profile,
    creates or looks up the user, and redirects to the frontend with a JWT.
    """
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    # Exchange code for tokens
    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        logger.error("Google token exchange failed: %s", token_resp.text)
        return _error("Failed to exchange authorization code", status.HTTP_400_BAD_REQUEST)

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        return _error("No access token received from Google", status.HTTP_400_BAD_REQUEST)

    # Get user info
    async with httpx.AsyncClient(timeout=10) as client:
        info_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if info_resp.status_code != 200:
        logger.error("Google userinfo failed: %s", info_resp.text)
        return _error("Failed to retrieve Google user info", status.HTTP_400_BAD_REQUEST)

    userinfo = info_resp.json()
    email = (userinfo.get("email") or "").strip().lower()
    if not email:
        return _error("Google account has no email address", status.HTTP_400_BAD_REQUEST)

    full_name = userinfo.get("name", "")
    google_sub = userinfo.get("sub", "")

    # DB operations
    prisma = get_prisma_client(settings.database_url)

    try:
        user = await fetch_user_by_email(prisma, email)

        if user:
            if not user.get("is_active", True):
                return _error("User account is inactive", status.HTTP_403_FORBIDDEN)
        else:
            # New user from Google — default to PATIENT role
            user = await create_user(
                prisma,
                email=email,
                password_hash=hash_password(google_sub),
                role="USER",
                full_name=full_name,
                phone_number="",
            )

        user_id = user["user_id"]
        await ensure_user_health_id(prisma, user_id)

        # Store Google tokens if provided (useful when user later connects Drive)
        refresh_token = token_data.get("refresh_token")
        if refresh_token:
            await prisma.execute_raw(
                "UPDATE users SET google_access_token = $1, google_refresh_token = $2 WHERE user_id = $3",
                access_token,
                refresh_token,
                user_id,
            )
        else:
            await prisma.execute_raw(
                "UPDATE users SET google_access_token = $1 WHERE user_id = $2",
                access_token,
                user_id,
            )

        jwt_token = create_jwt_token(user_id=user_id, role=user.get("role", "USER"))

        # Redirect to frontend with the token
        redirect_url = f"{settings.frontend_url}/auth/success?token={jwt_token}"
        return RedirectResponse(redirect_url)

    except Exception as error:
        logger.error("Google login callback failed: %s", error, exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── TASK 2: Google Drive permission (separate connect flow) ───────────────────


@router.get("/drive/connect")
async def drive_connect(current_user: Dict[str, Any] = Depends(require_user)):
    """Redirect the authenticated user to Google to grant Drive access."""
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google client ID not configured")

    drive_redirect_uri = settings.google_redirect_uri.replace("/callback", "/drive/callback")
    params = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": drive_redirect_uri,
        "response_type": "code",
        "scope": DRIVE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": current_user["user_id"],
    })
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{params}")


@router.get("/drive/callback")
async def drive_callback(code: str = Query(...), state: str = Query(...)):
    """Handle the Drive OAuth callback.

    Stores the Drive access/refresh tokens and creates the user's folder.
    """
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    user_id = state
    drive_redirect_uri = settings.google_redirect_uri.replace("/callback", "/drive/callback")

    # Exchange code for tokens
    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": drive_redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        logger.error("Drive token exchange failed: %s", token_resp.text)
        return _error("Failed to exchange authorization code for Drive", status.HTTP_400_BAD_REQUEST)

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")

    if not access_token:
        return _error("No access token received", status.HTTP_400_BAD_REQUEST)

    prisma = get_prisma_client(settings.database_url)

    try:
        # Store tokens
        await prisma.execute_raw(
            "UPDATE users SET google_access_token = $1, google_refresh_token = $2 WHERE user_id = $3",
            access_token,
            refresh_token or "",
            user_id,
        )

        # Create the user's Drive folder
        folder_id = await ensure_drive_folder(prisma, user_id, access_token)

        redirect_url = f"{settings.frontend_url}/drive/connected?folder_id={folder_id or ''}"
        return RedirectResponse(redirect_url)

    except Exception as error:
        logger.error("Drive callback failed: %s", error, exc_info=True)
        return _error("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── TASK 2 supplement: Drive status endpoint ──────────────────────────────────


@router.get("/drive/status")
async def drive_status(current_user: Dict[str, Any] = Depends(require_user)):
    """Check whether the current user has connected Google Drive."""
    prisma = get_prisma_client(settings.database_url)

    rows = await prisma.query_raw(
        "SELECT google_drive_folder_id, google_refresh_token FROM users WHERE user_id = $1 LIMIT 1",
        current_user["user_id"],
    )
    if not rows:
        return _success({"connected": False})

    connected = bool(rows[0].get("google_refresh_token"))
    folder_id = rows[0].get("google_drive_folder_id")
    return _success({"connected": connected, "folder_id": folder_id})


# ── TASK 5: File access control ──────────────────────────────────────────────


@router.get("/drive/files/{record_id}")
async def get_file_access(record_id: str, current_user: Dict[str, Any] = Depends(require_user)):
    """Return a Drive view link for a medical record, enforcing access control.

    Access rules:
    - Owner → allowed
    - Doctor with accepted connection → allowed
    """
    prisma = get_prisma_client(settings.database_url)
    user_id = current_user["user_id"]
    user_role = current_user.get("role", "USER")

    rows = await prisma.query_raw(
        "SELECT user_id, drive_file_id, file_url, file_name FROM medical_records WHERE medical_record_id = $1 LIMIT 1",
        record_id,
    )
    if not rows:
        return _error("Record not found", status.HTTP_404_NOT_FOUND)

    record = rows[0]
    owner_id = record["user_id"]

    # Check ownership
    if owner_id != user_id:
        # Check if doctor has accepted connection with the patient
        if user_role != "DOCTOR":
            return _error("Access denied", status.HTTP_403_FORBIDDEN)

        conn_rows = await prisma.query_raw(
            "SELECT connection_id FROM connections "
            "WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1",
            owner_id,
            user_id,
        )
        if not conn_rows:
            return _error("Access denied — no accepted connection with this patient", status.HTTP_403_FORBIDDEN)

    drive_file_id = record.get("drive_file_id")
    if drive_file_id:
        view_url = f"https://drive.google.com/file/d/{drive_file_id}/view"
        return _success({
            "record_id": record_id,
            "file_name": record.get("file_name"),
            "drive_file_id": drive_file_id,
            "view_url": view_url,
        })

    # Fallback — file is in local/GCS storage
    return _success({
        "record_id": record_id,
        "file_name": record.get("file_name"),
        "file_url": record.get("file_url"),
        "drive_file_id": None,
    })
