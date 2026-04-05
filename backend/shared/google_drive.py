"""Google Drive integration — folder creation, file upload, token refresh."""

import logging
from typing import Any, Dict, Optional, Tuple

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_FILES_URL = "https://www.googleapis.com/upload/drive/v3/files"
DRIVE_METADATA_URL = "https://www.googleapis.com/drive/v3/files"


async def refresh_access_token(refresh_token: str) -> Optional[str]:
    """Exchange a refresh token for a new access token.

    Returns the new access_token or None on failure.
    """
    if not settings.google_client_id or not settings.google_client_secret:
        logger.error("Google client credentials not configured")
        return None

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )

    if resp.status_code != 200:
        logger.error("Token refresh failed: %s %s", resp.status_code, resp.text)
        return None

    data = resp.json()
    return data.get("access_token")


async def _get_valid_token(prisma, user_id: str) -> Optional[str]:
    """Return a usable access token, refreshing if necessary.

    Updates the DB with the new access token after a successful refresh.
    """
    rows = await prisma.query_raw(
        "SELECT google_access_token, google_refresh_token FROM users WHERE user_id = $1 LIMIT 1",
        user_id,
    )
    if not rows:
        return None

    access_token = rows[0].get("google_access_token")
    refresh_token = rows[0].get("google_refresh_token")

    if not access_token and not refresh_token:
        return None

    # Quick validity check — try a simple request
    if access_token:
        async with httpx.AsyncClient(timeout=10) as client:
            probe = await client.get(
                "https://www.googleapis.com/drive/v3/about?fields=user",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if probe.status_code == 200:
            return access_token

    # Token expired or invalid — refresh
    if not refresh_token:
        logger.warning("No refresh token for user %s — cannot refresh", user_id)
        return None

    new_token = await refresh_access_token(refresh_token)
    if new_token:
        await prisma.execute_raw(
            "UPDATE users SET google_access_token = $1 WHERE user_id = $2",
            new_token,
            user_id,
        )
        return new_token

    return None


async def create_drive_folder(
    access_token: str,
    folder_name: str,
) -> Optional[str]:
    """Create a folder in Google Drive and return its ID."""
    metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            DRIVE_METADATA_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=metadata,
        )

    if resp.status_code not in (200, 201):
        logger.error("Drive folder creation failed: %s %s", resp.status_code, resp.text)
        return None

    folder_id = resp.json().get("id")
    logger.info("Created Drive folder '%s' → %s", folder_name, folder_id)
    return folder_id


async def ensure_drive_folder(prisma, user_id: str, access_token: str) -> Optional[str]:
    """Return the user's Drive folder ID, creating one if necessary."""
    rows = await prisma.query_raw(
        "SELECT google_drive_folder_id, full_name, email FROM users WHERE user_id = $1 LIMIT 1",
        user_id,
    )
    if not rows:
        return None

    folder_id = rows[0].get("google_drive_folder_id")
    if folder_id:
        return folder_id

    display_name = rows[0].get("full_name") or rows[0].get("email", "User")
    folder_name = f"FamWell Reports - {display_name}"
    folder_id = await create_drive_folder(access_token, folder_name)
    if not folder_id:
        return None

    await prisma.execute_raw(
        "UPDATE users SET google_drive_folder_id = $1 WHERE user_id = $2",
        folder_id,
        user_id,
    )
    return folder_id


async def upload_file_to_drive(
    access_token: str,
    file_content: bytes,
    filename: str,
    folder_id: str,
    mime_type: str = "application/pdf",
) -> Optional[Dict[str, Any]]:
    """Upload a file to a specific Google Drive folder.

    Returns dict with 'id' (Drive file ID) and 'webViewLink' on success.
    """
    import json as _json

    metadata = _json.dumps({"name": filename, "parents": [folder_id]})

    boundary = "famwell_boundary"
    body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{metadata}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {mime_type}\r\n\r\n"
    ).encode("utf-8") + file_content + f"\r\n--{boundary}--\r\n".encode("utf-8")

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{DRIVE_FILES_URL}?uploadType=multipart&fields=id,webViewLink",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": f"multipart/related; boundary={boundary}",
            },
            content=body,
        )

    if resp.status_code not in (200, 201):
        logger.error("Drive upload failed: %s %s", resp.status_code, resp.text)
        return None

    result = resp.json()
    logger.info("Uploaded to Drive: file_id=%s", result.get("id"))
    return result


async def upload_to_user_drive(
    prisma,
    user_id: str,
    file_content: bytes,
    filename: str,
    mime_type: str = "application/pdf",
) -> Optional[Dict[str, Any]]:
    """High-level helper: get token → ensure folder → upload.

    Returns dict with Drive file info, or None if Drive is not connected.
    """
    access_token = await _get_valid_token(prisma, user_id)
    if not access_token:
        logger.info("Drive not connected for user %s — skipping Drive upload", user_id)
        return None

    folder_id = await ensure_drive_folder(prisma, user_id, access_token)
    if not folder_id:
        logger.warning("Could not ensure Drive folder for user %s", user_id)
        return None

    return await upload_file_to_drive(access_token, file_content, filename, folder_id, mime_type)
