"""Pydantic schemas for request/response validation."""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, validator
from enum import Enum
import re


class UserRole(str, Enum):
    """User role enumeration for RBAC."""
    USER = "USER"
    DOCTOR = "DOCTOR"


class UserBase(BaseModel):
    """Base user schema."""
    email: str


class UserCreate(UserBase):
    """User creation schema."""
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.USER


class UserResponse(UserBase):
    """User response schema."""
    user_id: str
    created_at: datetime
    is_active: bool
    role: str

    class Config:
        from_attributes = True


class FileResponse(BaseModel):
    """File response schema."""
    file_id: str
    filename: str
    file_size_bytes: int
    upload_timestamp: datetime
    scan_status: str

    class Config:
        from_attributes = True


class JobResponse(BaseModel):
    """Job response schema."""
    job_id: str
    file_id: str
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    retry_count: int
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class UploadRequest(BaseModel):
    """File upload request schema."""
    filename: str = Field(..., min_length=1, max_length=255)

    @validator("filename")
    def validate_filename(cls, v):
        """Validate filename format."""
        if not v.lower().endswith(".pdf"):
            raise ValueError("Only PDF files are allowed")
        if any(c in v for c in ['<', '>', ':', '"', '|', '?', '*']):
            raise ValueError("Filename contains invalid characters")
        return v


class UploadResponse(BaseModel):
    """File upload response schema."""
    file_id: str
    job_id: str
    upload_url: str
    expires_in_seconds: int
    filename: str


class StatusResponse(BaseModel):
    """Job status response schema."""
    job_id: str
    status: str
    file_id: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: float = Field(..., ge=0, le=100)
    error_message: Optional[str] = None


class ExtractedDataResponse(BaseModel):
    """Extracted data response schema."""
    extraction_id: str
    job_id: str
    extracted_data: Dict[str, Any]
    validation_status: str
    extracted_at: datetime

    class Config:
        from_attributes = True


class LLMResultResponse(BaseModel):
    """LLM result response schema."""
    result_id: str
    job_id: str
    llm_response: str
    structured_output: Optional[Dict[str, Any]] = None
    processing_time_seconds: float
    model_used: str
    created_at: datetime

    class Config:
        from_attributes = True


class ResultResponse(BaseModel):
    """Final result response schema."""
    job_id: str
    status: str
    file_id: str
    extracted_data: Optional[Dict[str, Any]] = None
    llm_result: Optional[LLMResultResponse] = None
    processing_time_seconds: Optional[float] = None
    completed_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    """Authentication token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ErrorResponse(BaseModel):
    """Error response schema."""
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime


# JSON Schema for extracted document data
EXTRACTED_JSON_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "document_type": {"type": "string", "maxLength": 100},
        "extracted_text": {"type": "string", "maxLength": 10000},
        "tables": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "headers": {"type": "array", "items": {"type": "string"}},
                    "rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}}
                }
            }
        },
        "metadata": {
            "type": "object",
            "properties": {
                "pages": {"type": "integer", "minimum": 1},
                "language": {"type": "string", "maxLength": 10},
                "extraction_confidence": {"type": "number", "minimum": 0, "maximum": 1}
            }
        }
    },
    "required": ["document_type", "extracted_text"],
    "additionalProperties": False
}


class ExtractedJSONValidator(BaseModel):
    """Validator for extracted JSON data."""
    document_type: str = Field(..., max_length=100)
    extracted_text: str = Field(..., max_length=10000)
    tables: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None

    @validator("document_type")
    def validate_document_type(cls, v):
        """Sanitize document type."""
        # Remove any potential injection attempts
        return re.sub(r"[^\w\s-]", "", v)[:100]

    @validator("extracted_text")
    def sanitize_text(cls, v):
        """Sanitize extracted text."""
        # Remove null bytes and other dangerous characters
        v = v.replace("\x00", "")
        # Limit length to prevent memory issues
        return v[:10000]

    class Config:
        from_attributes = True

class UiRoleSelection(str, Enum):
    """Frontend role selection values."""
    PATIENT = "PATIENT"
    DOCTOR = "DOCTOR"


class LoginRequest(BaseModel):
    """Authentication request schema."""
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8)
    selected_role: UiRoleSelection

    @validator("email")
    def normalize_login_email(cls, value):
        normalized = value.strip().lower()
        if "@" not in normalized:
            raise ValueError("Email address is invalid")
        return normalized


class RegisterRequest(BaseModel):
    """Registration request schema."""
    full_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=5, max_length=255)
    phone_number: str = Field(..., min_length=7, max_length=32)
    password: str = Field(..., min_length=8)
    selected_role: UiRoleSelection = UiRoleSelection.PATIENT

    @validator("full_name")
    def validate_full_name(cls, value):
        normalized = value.strip()
        if not normalized:
            raise ValueError("Full name is required")
        return normalized

    @validator("email")
    def normalize_register_email(cls, value):
        normalized = value.strip().lower()
        if "@" not in normalized:
            raise ValueError("Email address is invalid")
        return normalized

    @validator("phone_number")
    def validate_phone_number(cls, value):
        normalized = value.strip()
        if len(normalized) < 7:
            raise ValueError("Phone number is invalid")
        return normalized


class GoogleAuthRequest(BaseModel):
    """Google OAuth token verification request."""
    token: str = Field(..., min_length=1)
    selected_role: UiRoleSelection = UiRoleSelection.PATIENT


class RecordCreateRequest(BaseModel):
    """Record creation schema."""
    record_type: str = Field(..., min_length=1, max_length=100)
    data: Dict[str, Any]
    user_id: Optional[str] = None

    @validator("record_type")
    def validate_record_type(cls, value):
        normalized = value.strip()
        if not normalized:
            raise ValueError("Record type is required")
        return normalized


class FollowRequest(BaseModel):
    """Follow by Health ID request schema."""
    health_id: str = Field(..., min_length=5, max_length=32)

    @validator("health_id")
    def validate_health_id(cls, value):
        normalized = value.strip().upper()
        if not re.match(r"^[A-Z]{2}-[A-Z0-9]{4,28}$", normalized):
            raise ValueError("Health ID format is invalid")
        return normalized


class FollowActionRequest(BaseModel):
    """Accept or reject a follow request."""
    connection_id: str = Field(..., min_length=1, max_length=64)
    action: str = Field(..., pattern=r"^(accepted|rejected)$")

    @validator("action")
    def validate_action(cls, value):
        if value not in ("accepted", "rejected"):
            raise ValueError("Action must be 'accepted' or 'rejected'")
        return value


class ChatRequest(BaseModel):
    """Chat message request schema."""
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None

    @validator("message")
    def validate_message(cls, value):
        normalized = value.strip()
        if not normalized:
            raise ValueError("Message cannot be empty")
        return normalized


class MedicalRecordUploadResponse(BaseModel):
    """Medical record upload response."""
    medical_record_id: str
    user_id: str
    file_url: str
    file_name: str
    record_type: str
    upload_date: Optional[str] = None
