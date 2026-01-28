"""Pydantic schemas for request/response validation."""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, validator
import re


class UserBase(BaseModel):
    """Base user schema."""
    email: str


class UserCreate(UserBase):
    """User creation schema."""
    pass


class UserResponse(UserBase):
    """User response schema."""
    user_id: str
    created_at: datetime
    is_active: bool

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
