"""Security utilities for authentication, validation, and sanitization."""

import base64
import hashlib
import hmac
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
from passlib.context import CryptContext

from config.settings import settings


# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
PBKDF2_ITERATIONS = 600000
PBKDF2_PREFIX = "pbkdf2_sha256"


def _hash_password_pbkdf2(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "$".join(
        [
            PBKDF2_PREFIX,
            str(PBKDF2_ITERATIONS),
            base64.b64encode(salt).decode("ascii"),
            base64.b64encode(derived).decode("ascii"),
        ]
    )


def _verify_password_pbkdf2(plain_password: str, hashed_password: str) -> bool:
    try:
        _, iterations, salt_b64, hash_b64 = hashed_password.split("$", 3)
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected = base64.b64decode(hash_b64.encode("ascii"))
        derived = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(derived, expected)
    except Exception:
        return False


def hash_password(password: str) -> str:
    """Hash password using a stable built-in KDF."""
    return _hash_password_pbkdf2(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against current or legacy hashes."""
    if hashed_password.startswith(f"{PBKDF2_PREFIX}$"):
        return _verify_password_pbkdf2(plain_password, hashed_password)

    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_jwt_token(user_id: str, role: str = "USER", expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT token for user.

    Args:
        user_id: The user's unique identifier
        role: The user's role (USER or DOCTOR)
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    if expires_delta is None:
        expires_delta = timedelta(hours=settings.jwt_expiration_hours)

    expire = datetime.utcnow() + expires_delta
    payload = {
        "sub": user_id,
        "role": role,
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


def validate_filename(filename: str) -> bool:
    """Validate filename format.
    
    Args:
        filename: The filename to validate.
        
    Returns:
        True if valid, False otherwise.
    """
    if not filename:
        return False
        
    # Check extension
    if not filename.lower().endswith(".pdf"):
        return False
        
    # Check for invalid characters
    # Windows forbidden characters: < > : " / \ | ? *
    invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
    if any(c in filename for c in invalid_chars):
        return False
        
    return True


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
