"""Security utilities for authentication, validation, and sanitization."""

import hashlib
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
from passlib.context import CryptContext

from config.settings import settings


# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_jwt_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT token for user."""
    if expires_delta is None:
        expires_delta = timedelta(hours=settings.jwt_expiration_hours)

    expire = datetime.utcnow() + expires_delta
    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.utcnow(),
    }

    encoded_jwt = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )
    return encoded_jwt


def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def calculate_file_hash(file_content: bytes) -> str:
    """Calculate SHA256 hash of file content."""
    return hashlib.sha256(file_content).hexdigest()


def sanitize_json_for_injection(data: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize JSON data to prevent prompt injection attacks."""
    dangerous_patterns = [
        r"ignore.*previous.*instructions",
        r"system.*prompt",
        r"execute.*code",
        r"<script",
        r"javascript:",
        r"onerror=",
        r"onclick=",
    ]

    def sanitize_value(value):
        """Recursively sanitize values."""
        if isinstance(value, str):
            # Remove null bytes
            value = value.replace("\x00", "")

            # Check for dangerous patterns (case-insensitive)
            for pattern in dangerous_patterns:
                if re.search(pattern, value, re.IGNORECASE):
                    # Remove the dangerous pattern
                    value = re.sub(pattern, "", value, flags=re.IGNORECASE)

            # Limit length to prevent DoS
            if len(value) > 10000:
                value = value[:10000]

            return value
        elif isinstance(value, dict):
            return {k: sanitize_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [sanitize_value(item) for item in value]
        else:
            return value

    return sanitize_value(data)


def sanitize_filename(filename: str) -> str:
    """Sanitize uploaded filename."""
    # Remove path traversal attempts
    filename = filename.replace("..", "")
    filename = filename.replace("/", "_")
    filename = filename.replace("\\", "_")

    # Remove invalid characters
    filename = re.sub(r"[<>:\"|?*\x00-\x1f]", "", filename)

    # Limit length
    if len(filename) > 255:
        # Keep extension
        parts = filename.rsplit(".", 1)
        if len(parts) == 2:
            filename = parts[0][:250] + "." + parts[1]
        else:
            filename = filename[:255]

    return filename


def validate_pdf_magic_bytes(file_content: bytes) -> bool:
    """Validate that file starts with PDF magic bytes."""
    return file_content.startswith(b"%PDF")


def validate_file_size(file_size_bytes: int) -> bool:
    """Validate file size against configured limits."""
    return file_size_bytes <= settings.max_file_size_bytes


def generate_job_id() -> str:
    """Generate unique job ID."""
    return f"job_{uuid.uuid4().hex}"


def generate_file_id() -> str:
    """Generate unique file ID."""
    return f"file_{uuid.uuid4().hex}"


def generate_user_id() -> str:
    """Generate unique user ID."""
    return f"user_{uuid.uuid4().hex}"


def generate_extraction_id() -> str:
    """Generate unique extraction ID."""
    return f"extraction_{uuid.uuid4().hex}"


def generate_result_id() -> str:
    """Generate unique LLM result ID."""
    return f"result_{uuid.uuid4().hex}"


def generate_metric_id() -> str:
    """Generate unique metric ID."""
    return f"metric_{uuid.uuid4().hex}"


class RateLimitKey:
    """Generate rate limiting keys."""

    @staticmethod
    def user_upload_key(user_id: str) -> str:
        """Rate limit key for user uploads."""
        return f"ratelimit:upload:{user_id}"

    @staticmethod
    def ip_request_key(ip: str) -> str:
        """Rate limit key for IP address."""
        return f"ratelimit:request:{ip}"

    @staticmethod
    def user_api_key(user_id: str) -> str:
        """Rate limit key for user API requests."""
        return f"ratelimit:api:{user_id}"
